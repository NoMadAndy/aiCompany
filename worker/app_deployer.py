"""
App Deployer — Docker-basiertes Deployment fuer generierte Apps.

Verwaltet den gesamten Lifecycle: Port-Pruefung, Container-Erstellung,
Start, Stop, Restart und Entfernung.

Port-Range: 4000-4100 (konfigurierbar ueber APP_PORT_MIN / APP_PORT_MAX)
"""

import os
import socket
import shutil
import tempfile
import logging
import subprocess
import json
from typing import Optional

import psycopg2

logger = logging.getLogger("app_deployer")

# ─── Konfiguration ──────────────────────────────────────────────

APP_PORT_MIN = int(os.getenv("APP_PORT_MIN", "4000"))
APP_PORT_MAX = int(os.getenv("APP_PORT_MAX", "4100"))
APP_NETWORK = os.getenv("APP_NETWORK", "aicompany_aicompany")
APP_LABEL = "aicompany.app"
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://aicompany:aicompany@db:5432/aicompany")


def get_db():
    return psycopg2.connect(DATABASE_URL)


# ─── Port-Management ────────────────────────────────────────────

def is_port_available(port: int) -> bool:
    """Prueft ob ein Port auf dem Host verfuegbar ist (TCP)."""
    try:
        # Pruefe via Docker: laufende Container mit dem Port
        result = subprocess.run(
            ["docker", "ps", "--format", "{{.Ports}}", "-q"],
            capture_output=True, text=True, timeout=5
        )
        # Pruefe ob der Port bereits von einem Docker-Container belegt ist
        result_ports = subprocess.run(
            ["docker", "ps", "--format", "{{.Ports}}"],
            capture_output=True, text=True, timeout=5
        )
        if f":{port}->" in result_ports.stdout:
            return False

        # Pruefe ob der Port lokal bereits belegt ist
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(1)
            result_code = s.connect_ex(("0.0.0.0", port))
            return result_code != 0
    except Exception as e:
        logger.warning(f"Port-Check fuer {port} fehlgeschlagen: {e}")
        return False


def find_available_port() -> Optional[int]:
    """Findet den naechsten freien Port im konfigurierten Bereich."""
    # Hole bereits vergebene Ports aus der DB
    used_ports = set()
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            "SELECT port FROM deployed_apps WHERE port IS NOT NULL AND container_status IN ('running', 'building', 'stopped')"
        )
        used_ports = {row[0] for row in cur.fetchall()}
        cur.close()
        conn.close()
    except Exception as e:
        logger.warning(f"DB-Port-Abfrage fehlgeschlagen: {e}")

    for port in range(APP_PORT_MIN, APP_PORT_MAX + 1):
        if port in used_ports:
            continue
        if is_port_available(port):
            return port

    logger.error(f"Kein freier Port im Bereich {APP_PORT_MIN}-{APP_PORT_MAX} gefunden!")
    return None


# ─── Docker-Operationen ────────────────────────────────────────

def _run_docker(args: list[str], timeout: int = 120) -> subprocess.CompletedProcess:
    """Fuehrt einen Docker-Befehl aus."""
    cmd = ["docker"] + args
    logger.info(f"Docker-Befehl: {' '.join(cmd)}")
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)


def _update_app_status(app_id: int, **fields):
    """Aktualisiert Felder einer deployed_app in der DB."""
    if not fields:
        return
    set_parts = []
    values = []
    for key, val in fields.items():
        set_parts.append(f"{key} = %s")
        values.append(val)
    set_parts.append("updated_at = NOW()")
    values.append(app_id)

    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            f"UPDATE deployed_apps SET {', '.join(set_parts)} WHERE id = %s",
            values
        )
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        logger.error(f"Status-Update fuer App #{app_id} fehlgeschlagen: {e}")


def _container_name(app_id: int) -> str:
    return f"aicompany-app-{app_id}"


# ─── Templates ──────────────────────────────────────────────────

def _create_html_app(build_dir: str, code: str, app_name: str):
    """Erstellt eine statische HTML-App mit nginx."""
    # HTML-Datei schreiben
    html_dir = os.path.join(build_dir, "html")
    os.makedirs(html_dir, exist_ok=True)
    with open(os.path.join(html_dir, "index.html"), "w") as f:
        f.write(code)

    # nginx.conf
    with open(os.path.join(build_dir, "nginx.conf"), "w") as f:
        f.write("""server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "ALLOWALL";
    add_header X-Content-Type-Options "nosniff";

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
}
""")

    # Dockerfile
    with open(os.path.join(build_dir, "Dockerfile"), "w") as f:
        f.write(f"""FROM nginx:alpine
LABEL {APP_LABEL}="true"
LABEL {APP_LABEL}.name="{app_name}"
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY html/ /usr/share/nginx/html/
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1/ || exit 1
""")

    return "nginx:alpine"


def _create_python_app(build_dir: str, code: str, app_name: str):
    """Erstellt eine Python-App mit eingebettetem HTTP-Server."""
    with open(os.path.join(build_dir, "app.py"), "w") as f:
        f.write(code)

    # Einfacher Wrapper der die App ausfuehrt und Ergebnis zeigt
    with open(os.path.join(build_dir, "server.py"), "w") as f:
        f.write("""#!/usr/bin/env python3
import http.server
import socketserver
import subprocess
import sys
import html as html_module

PORT = 80

class AppHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"ok")
            return

        try:
            result = subprocess.run(
                [sys.executable, "/app/app.py"],
                capture_output=True, text=True, timeout=30, cwd="/app"
            )
            output = result.stdout
            errors = result.stderr
        except subprocess.TimeoutExpired:
            output = ""
            errors = "Timeout: Script hat laenger als 30s gebraucht."
        except Exception as e:
            output = ""
            errors = str(e)

        escaped_out = html_module.escape(output)
        escaped_err = html_module.escape(errors)

        page = f\"\"\"<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>APP_NAME_PLACEHOLDER</title>
<style>
* {{ margin:0; padding:0; box-sizing:border-box; }}
body {{ font-family:'JetBrains Mono',monospace; background:#0f1117; color:#e2e8f0; padding:2rem; }}
h1 {{ background:linear-gradient(135deg,#818cf8,#a78bfa); -webkit-background-clip:text; -webkit-text-fill-color:transparent; margin-bottom:1rem; }}
.output {{ background:#1a1b26; padding:1.5rem; border-radius:0.75rem; white-space:pre-wrap; font-size:0.875rem; line-height:1.6; border:1px solid #2d2d3d; }}
.error {{ border-color:#ef4444; color:#fca5a5; margin-top:1rem; }}
.meta {{ color:#64748b; font-size:0.8rem; margin-bottom:1.5rem; }}
</style>
</head>
<body>
<h1>APP_NAME_PLACEHOLDER</h1>
<p class="meta">Python App — AI Company Docker Deploy</p>
<div class="output">{escaped_out if escaped_out else '<em style="color:#64748b;">Keine Ausgabe</em>'}</div>
{f'<div class="output error">{escaped_err}</div>' if escaped_err else ''}
</body>
</html>\"\"\"

        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        self.wfile.write(page.encode())

with socketserver.TCPServer(("", PORT), AppHandler) as httpd:
    print(f"Python App Server auf Port {PORT}")
    httpd.serve_forever()
""".replace("APP_NAME_PLACEHOLDER", app_name.replace('"', '\\"')))

    with open(os.path.join(build_dir, "Dockerfile"), "w") as f:
        f.write(f"""FROM python:3.12-slim
LABEL {APP_LABEL}="true"
LABEL {APP_LABEL}.name="{app_name}"
WORKDIR /app
COPY app.py .
COPY server.py .
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1/health')" || exit 1
CMD ["python3", "server.py"]
""")

    return "python:3.12-slim"


def _create_node_app(build_dir: str, code: str, app_name: str):
    """Erstellt eine Node.js-App mit Express."""
    with open(os.path.join(build_dir, "app.js"), "w") as f:
        f.write(code)

    with open(os.path.join(build_dir, "server.js"), "w") as f:
        f.write(f"""const http = require('http');
const {{ execSync }} = require('child_process');
const fs = require('fs');

const PORT = 80;
const APP_NAME = {json.dumps(app_name)};

const server = http.createServer((req, res) => {{
  if (req.url === '/health') {{
    res.writeHead(200, {{ 'Content-Type': 'text/plain' }});
    return res.end('ok');
  }}

  let output = '', errors = '';
  try {{
    output = execSync('node /app/app.js', {{ timeout: 30000, cwd: '/app' }}).toString();
  }} catch (e) {{
    errors = e.stderr ? e.stderr.toString() : e.message;
    output = e.stdout ? e.stdout.toString() : '';
  }}

  const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const page = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${{APP_NAME}}</title>
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{font-family:'JetBrains Mono',monospace;background:#0f1117;color:#e2e8f0;padding:2rem}}
h1{{background:linear-gradient(135deg,#818cf8,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:1rem}}
.output{{background:#1a1b26;padding:1.5rem;border-radius:0.75rem;white-space:pre-wrap;font-size:.875rem;line-height:1.6;border:1px solid #2d2d3d}}
.error{{border-color:#ef4444;color:#fca5a5;margin-top:1rem}}
.meta{{color:#64748b;font-size:.8rem;margin-bottom:1.5rem}}
</style>
</head>
<body>
<h1>${{APP_NAME}}</h1>
<p class="meta">Node.js App — AI Company Docker Deploy</p>
<div class="output">${{output ? esc(output) : '<em style="color:#64748b;">Keine Ausgabe</em>'}}</div>
${{errors ? '<div class="output error">'+esc(errors)+'</div>' : ''}}
</body>
</html>`;

  res.writeHead(200, {{ 'Content-Type': 'text/html; charset=utf-8' }});
  res.end(page);
}});

server.listen(PORT, () => console.log('Node App Server auf Port ' + PORT));
""")

    with open(os.path.join(build_dir, "Dockerfile"), "w") as f:
        f.write(f"""FROM node:18-alpine
LABEL {APP_LABEL}="true"
LABEL {APP_LABEL}.name="{app_name}"
WORKDIR /app
COPY app.js .
COPY server.js .
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1/health || exit 1
CMD ["node", "server.js"]
""")

    return "node:18-alpine"


# ─── Haupt-Deployment-Funktionen ────────────────────────────────

def deploy_app(app_id: int) -> dict:
    """
    Deployed eine App aus der DB als Docker-Container.

    1. Liest App-Daten aus der DB
    2. Prueft Port-Verfuegbarkeit
    3. Erstellt Build-Verzeichnis mit Dockerfile
    4. Baut Docker-Image
    5. Startet Container
    6. Aktualisiert DB-Status

    Returns: {"success": bool, "port": int, "container_id": str, "error": str}
    """
    # 1. App-Daten laden
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            "SELECT id, name, code, language, container_id, port, container_status FROM deployed_apps WHERE id = %s",
            (app_id,)
        )
        row = cur.fetchone()
        cur.close()
        conn.close()
    except Exception as e:
        return {"success": False, "error": f"DB-Fehler: {e}"}

    if not row:
        return {"success": False, "error": f"App #{app_id} nicht gefunden"}

    app_id, app_name, code, language, old_container, old_port, container_status = row

    # Falls bereits ein Container laeuft, stoppe ihn zuerst
    if old_container and container_status == "running":
        stop_app(app_id)

    # 2. Port finden
    _update_app_status(app_id, container_status="building")

    port = find_available_port()
    if not port:
        _update_app_status(app_id, container_status="error", error_log="Kein freier Port verfuegbar")
        return {"success": False, "error": "Kein freier Port im Bereich verfuegbar"}

    # 3. Build-Verzeichnis erstellen
    build_dir = tempfile.mkdtemp(prefix=f"aicompany-app-{app_id}-")
    container_name = _container_name(app_id)

    try:
        # Template basierend auf tatsaechlichem Inhalt waehlen.
        # deploy_generated_app() in main.py wrapped ALLEN Code in HTML bevor
        # er in die DB geschrieben wird. Daher: wenn der Code HTML enthaelt,
        # immer als HTML-App deployen (nginx). Nur reiner Python/JS-Code
        # ohne HTML-Wrapper bekommt einen Laufzeit-Container.
        code_lower = code.strip().lower()
        is_html = code_lower.startswith("<!doctype") or code_lower.startswith("<html") or "<html" in code_lower[:500]

        if is_html:
            base_image = _create_html_app(build_dir, code, app_name)
        elif language in ("python", "py"):
            base_image = _create_python_app(build_dir, code, app_name)
        elif language in ("javascript", "js", "typescript", "ts", "code"):
            base_image = _create_node_app(build_dir, code, app_name)
        else:
            base_image = _create_html_app(build_dir, code, app_name)

        image_name = f"aicompany-app-{app_id}:latest"

        # 4. Alten Container entfernen falls vorhanden
        _run_docker(["rm", "-f", container_name])

        # 5. Docker-Image bauen
        result = _run_docker(["build", "-t", image_name, build_dir], timeout=180)
        if result.returncode != 0:
            error_msg = result.stderr[:1000]
            _update_app_status(app_id, container_status="error", error_log=f"Build fehlgeschlagen: {error_msg}")
            return {"success": False, "error": f"Docker Build fehlgeschlagen: {error_msg}"}

        # 6. Container starten
        run_args = [
            "run", "-d",
            "--name", container_name,
            "--label", f"{APP_LABEL}=true",
            "--label", f"{APP_LABEL}.id={app_id}",
            "--network", APP_NETWORK,
            "-p", f"{port}:80",
            "--restart", "unless-stopped",
            "--memory", "256m",
            "--cpus", "0.5",
            image_name
        ]
        result = _run_docker(run_args)

        if result.returncode != 0:
            error_msg = result.stderr[:1000]
            _update_app_status(app_id, container_status="error", error_log=f"Start fehlgeschlagen: {error_msg}")
            return {"success": False, "error": f"Container-Start fehlgeschlagen: {error_msg}"}

        container_id = result.stdout.strip()[:12]

        # 7. DB aktualisieren
        _update_app_status(
            app_id,
            container_id=container_id,
            port=port,
            deploy_type="docker",
            container_status="running",
            docker_image=image_name,
            error_log=None
        )

        logger.info(f"App #{app_id} ({app_name}) deployed auf Port {port} — Container {container_id}")
        return {"success": True, "port": port, "container_id": container_id}

    except Exception as e:
        _update_app_status(app_id, container_status="error", error_log=str(e))
        return {"success": False, "error": str(e)}
    finally:
        # Build-Verzeichnis aufraeumen
        shutil.rmtree(build_dir, ignore_errors=True)


def stop_app(app_id: int) -> dict:
    """Stoppt den Docker-Container einer App."""
    container_name = _container_name(app_id)
    result = _run_docker(["stop", container_name])

    if result.returncode != 0:
        return {"success": False, "error": result.stderr.strip()}

    _update_app_status(app_id, container_status="stopped")
    logger.info(f"App #{app_id} gestoppt")
    return {"success": True}


def restart_app(app_id: int) -> dict:
    """Startet den Docker-Container einer App neu."""
    container_name = _container_name(app_id)
    result = _run_docker(["restart", container_name])

    if result.returncode != 0:
        # Falls Container nicht existiert, neu deployen
        return deploy_app(app_id)

    _update_app_status(app_id, container_status="running", error_log=None)
    logger.info(f"App #{app_id} neugestartet")
    return {"success": True}


def remove_app(app_id: int) -> dict:
    """Entfernt den Docker-Container und das Image einer App."""
    container_name = _container_name(app_id)
    image_name = f"aicompany-app-{app_id}:latest"

    # Container stoppen und entfernen
    _run_docker(["rm", "-f", container_name])

    # Image entfernen
    _run_docker(["rmi", "-f", image_name])

    _update_app_status(
        app_id,
        container_id=None,
        port=None,
        container_status="none",
        deploy_type="inline",
        docker_image=None,
        error_log=None
    )

    logger.info(f"App #{app_id} Docker-Ressourcen entfernt")
    return {"success": True}


def get_app_status(app_id: int) -> dict:
    """Holt den aktuellen Status eines App-Containers."""
    container_name = _container_name(app_id)

    result = _run_docker(["inspect", "--format",
                          "{{.State.Status}}|{{.State.Health.Status}}|{{.NetworkSettings.Ports}}",
                          container_name])

    if result.returncode != 0:
        return {"running": False, "status": "not_found"}

    parts = result.stdout.strip().split("|")
    status = parts[0] if parts else "unknown"
    health = parts[1] if len(parts) > 1 else "unknown"

    return {
        "running": status == "running",
        "status": status,
        "health": health,
        "container_name": container_name
    }


def get_container_logs(app_id: int, tail: int = 50) -> str:
    """Holt die letzten Log-Zeilen eines App-Containers."""
    container_name = _container_name(app_id)
    result = _run_docker(["logs", "--tail", str(tail), container_name])
    return result.stdout + result.stderr


def cleanup_orphaned_containers():
    """Entfernt Container die nicht mehr in der DB referenziert sind."""
    result = _run_docker([
        "ps", "-a", "--filter", f"label={APP_LABEL}=true",
        "--format", "{{.Names}}"
    ])
    if result.returncode != 0:
        return

    container_names = [n.strip() for n in result.stdout.strip().split("\n") if n.strip()]

    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id FROM deployed_apps WHERE deploy_type = 'docker'")
        valid_ids = {row[0] for row in cur.fetchall()}
        cur.close()
        conn.close()
    except Exception:
        return

    for name in container_names:
        # Extrahiere App-ID aus Container-Name
        try:
            app_id = int(name.replace("aicompany-app-", ""))
            if app_id not in valid_ids:
                _run_docker(["rm", "-f", name])
                logger.info(f"Verwaisten Container entfernt: {name}")
        except ValueError:
            continue
