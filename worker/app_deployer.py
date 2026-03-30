"""
App Deployer — Docker-basiertes Deployment fuer generierte Apps.

Verwaltet den gesamten Lifecycle: Port-Pruefung, Container-Erstellung,
Start, Stop, Restart und Entfernung.

Port-Range: 4000-4100 (konfigurierbar ueber APP_PORT_MIN / APP_PORT_MAX)
"""

import os
import re
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


def _sanitize_code(code: str, language: str) -> str:
    """Bereinigt typische KI-Generierungsfehler im Code."""
    lines = code.splitlines()
    cleaned = []
    for line in lines:
        stripped = line.strip()
        # Entferne Shell-Befehle die keine Python/JS-Statements sind
        if stripped.startswith("pip install ") or stripped.startswith("pip3 install "):
            continue
        if stripped.startswith("npm install ") or stripped.startswith("yarn add "):
            continue
        if stripped.startswith("$ ") or stripped.startswith("% "):
            continue
        # Entferne Shell-Startbefehle die keine Code-Statements sind
        if stripped.startswith("uvicorn ") or stripped.startswith("python ") or stripped.startswith("python3 "):
            if "import" not in stripped and "=" not in stripped:
                continue
        if stripped.startswith("node ") or stripped.startswith("flask run"):
            continue
        # Entferne Markdown-Artefakte
        if stripped.startswith("```"):
            continue
        if language == "python":
            # Ersetze JSON-null/true/false durch Python-Aequivalente
            if "null" in line and "None" not in line:
                line = line.replace("null,", "None,").replace("null}", "None}").replace("null)", "None)")
                line = line.replace(": null", ": None").replace("=null", "=None")
            if re.match(r'.*[^"\']true[^"\']', line) and "True" not in line:
                line = re.sub(r'\btrue\b', 'True', line)
            if re.match(r'.*[^"\']false[^"\']', line) and "False" not in line:
                line = re.sub(r'\bfalse\b', 'False', line)
        cleaned.append(line)
    return "\n".join(cleaned)


def _extract_python_deps(code: str) -> list[str]:
    """Extrahiert pip-Pakete aus import-Statements."""
    # Mapping von import-Namen zu pip-Paketnamen
    IMPORT_TO_PIP = {
        "fastapi": "fastapi uvicorn",
        "flask": "flask",
        "django": "django",
        "requests": "requests",
        "httpx": "httpx",
        "pydantic": "pydantic",
        "sqlalchemy": "sqlalchemy",
        "sqlmodel": "sqlmodel",
        "pandas": "pandas",
        "numpy": "numpy",
        "aiohttp": "aiohttp",
        "starlette": "starlette",
        "jinja2": "jinja2",
        "bs4": "beautifulsoup4",
        "PIL": "pillow",
        "sklearn": "scikit-learn",
        "matplotlib": "matplotlib",
        "redis": "redis",
        "celery": "celery",
        "pyyaml": "pyyaml",
        "dotenv": "python-dotenv",
        "jwt": "pyjwt",
        "cryptography": "cryptography",
        "passlib": "passlib",
    }
    deps = set()
    for line in code.splitlines():
        line = line.strip()
        if line.startswith("import ") or line.startswith("from "):
            # Extrahiere Modulname
            parts = line.replace("import ", "").replace("from ", "").split()[0].split(".")[0]
            if parts in IMPORT_TO_PIP:
                for pkg in IMPORT_TO_PIP[parts].split():
                    deps.add(pkg)
    return sorted(deps)


def _detect_python_framework(code: str) -> str:
    """Erkennt welches Web-Framework der Python-Code nutzt."""
    code_lower = code.lower()
    if "fastapi" in code_lower and ("app = fastapi" in code_lower or "app=fastapi" in code_lower
                                     or "= fastapi(" in code_lower):
        return "fastapi"
    if "flask" in code_lower and ("app = flask" in code_lower or "app=flask" in code_lower
                                   or "= flask(" in code_lower):
        return "flask"
    if "django" in code_lower:
        return "django"
    if "http.server" in code_lower or "socketserver" in code_lower:
        return "stdlib_http"
    return "script"


def _create_python_app(build_dir: str, code: str, app_name: str):
    """Erstellt eine Python-App — erkennt Framework und deployed entsprechend."""
    framework = _detect_python_framework(code)
    deps = _extract_python_deps(code)

    with open(os.path.join(build_dir, "app.py"), "w") as f:
        f.write(code)

    # Requirements-Datei
    if deps:
        with open(os.path.join(build_dir, "requirements.txt"), "w") as f:
            f.write("\n".join(deps) + "\n")

    if framework == "fastapi":
        # FastAPI — direkt mit uvicorn starten
        cmd = '["python3", "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "80"]'
        if "uvicorn" not in deps:
            deps.append("uvicorn")
            with open(os.path.join(build_dir, "requirements.txt"), "w") as f:
                f.write("\n".join(sorted(set(deps))) + "\n")
    elif framework == "flask":
        # Flask — mit flask run starten
        cmd = '["python3", "-m", "flask", "run", "--host", "0.0.0.0", "--port", "80"]'
    elif framework == "stdlib_http":
        # Eigener HTTP-Server — direkt starten
        cmd = '["python3", "app.py"]'
    else:
        # Normales Script — mit HTTP-Wrapper ausfuehren
        _write_python_wrapper(build_dir, app_name)
        cmd = '["python3", "server.py"]'

    # Dockerfile
    install_deps = ""
    if deps:
        install_deps = "COPY requirements.txt .\nRUN pip install --no-cache-dir -r requirements.txt\n"

    with open(os.path.join(build_dir, "Dockerfile"), "w") as f:
        f.write(f"""FROM python:3.12-slim
LABEL {APP_LABEL}="true"
LABEL {APP_LABEL}.name="{app_name}"
WORKDIR /app
{install_deps}COPY . .
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1/')" || exit 1
CMD {cmd}
""")

    return "python:3.12-slim"


def _write_python_wrapper(build_dir: str, app_name: str):
    """Schreibt einen HTTP-Wrapper fuer einfache Python-Scripts."""
    safe_name = app_name.replace("'", "").replace('"', '').replace("\\", "")
    server_code = (
        '#!/usr/bin/env python3\n'
        'import http.server, socketserver, subprocess, sys, html as html_module\n'
        'PORT = 80\n'
        'APP_NAME = "' + safe_name + '"\n'
        'TEMPLATE = """<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1.0">\n'
        '<title>{name}</title>\n'
        '<style>*{{margin:0;padding:0;box-sizing:border-box}}body{{font-family:system-ui,sans-serif;background:#0f1117;color:#e2e8f0;padding:2rem}}\n'
        'h1{{background:linear-gradient(135deg,#818cf8,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:1rem}}\n'
        '.out{{background:#1a1b26;padding:1.5rem;border-radius:.75rem;white-space:pre-wrap;font-size:.875rem;line-height:1.6;border:1px solid #2d2d3d;font-family:monospace}}\n'
        '.err{{border-color:#ef4444;color:#fca5a5;margin-top:1rem}}</style></head>\n'
        '<body><h1>{name}</h1>\n'
        '<div class="out">{output}</div>{error_div}</body></html>"""\n'
        '\n'
        'class H(http.server.SimpleHTTPRequestHandler):\n'
        '    def do_GET(self):\n'
        '        if self.path == "/health":\n'
        '            self.send_response(200)\n'
        '            self.send_header("Content-Type", "text/plain")\n'
        '            self.end_headers()\n'
        '            self.wfile.write(b"ok")\n'
        '            return\n'
        '        try:\n'
        '            r = subprocess.run([sys.executable, "/app/app.py"], capture_output=True, text=True, timeout=30, cwd="/app")\n'
        '            out, err = r.stdout, r.stderr\n'
        '        except subprocess.TimeoutExpired:\n'
        '            out, err = "", "Timeout (30s)"\n'
        '        except Exception as e:\n'
        '            out, err = "", str(e)\n'
        '        eo = html_module.escape(out) if out else \'<em style="color:#64748b;">Keine Ausgabe</em>\'\n'
        '        ee = f\'<div class="out err">{html_module.escape(err)}</div>\' if err else ""\n'
        '        page = TEMPLATE.format(name=APP_NAME, output=eo, error_div=ee)\n'
        '        self.send_response(200)\n'
        '        self.send_header("Content-Type", "text/html; charset=utf-8")\n'
        '        self.end_headers()\n'
        '        self.wfile.write(page.encode())\n'
        '    def log_message(self, *a): pass\n'
        '\n'
        'with socketserver.TCPServer(("", PORT), H) as s:\n'
        '    s.serve_forever()\n'
    )
    with open(os.path.join(build_dir, "server.py"), "w") as f:
        f.write(server_code)



def _detect_node_framework(code: str) -> str:
    """Erkennt ob der JS-Code ein eigener Web-Server ist."""
    code_lower = code.lower()
    if "express" in code_lower and ("listen(" in code_lower or "createserver" in code_lower):
        return "express"
    if "createserver" in code_lower and ".listen(" in code_lower:
        return "http_server"
    if "koa" in code_lower and ".listen(" in code_lower:
        return "koa"
    return "script"


def _extract_node_deps(code: str) -> list[str]:
    """Extrahiert npm-Pakete aus require/import-Statements."""
    KNOWN_PACKAGES = {
        "express", "koa", "fastify", "hapi", "axios", "node-fetch",
        "cors", "body-parser", "dotenv", "lodash", "moment", "dayjs",
        "uuid", "ws", "socket.io", "mongoose", "sequelize", "pg",
        "mysql2", "redis", "jsonwebtoken", "bcrypt", "chalk",
    }
    deps = set()
    for line in code.splitlines():
        line = line.strip()
        # require('package') oder require("package")
        if "require(" in line:
            for q in ["'", '"']:
                start = line.find(f"require({q}")
                if start >= 0:
                    start += len(f"require({q}")
                    end = line.find(q, start)
                    if end > start:
                        pkg = line[start:end].split("/")[0]
                        if pkg in KNOWN_PACKAGES:
                            deps.add(pkg)
        # import ... from 'package'
        if "from " in line and ("'" in line or '"' in line):
            for q in ["'", '"']:
                idx = line.rfind(f"from {q}")
                if idx >= 0:
                    start = idx + len(f"from {q}")
                    end = line.find(q, start)
                    if end > start:
                        pkg = line[start:end].split("/")[0]
                        if pkg in KNOWN_PACKAGES:
                            deps.add(pkg)
    return sorted(deps)


def _create_node_app(build_dir: str, code: str, app_name: str):
    """Erstellt eine Node.js-App — erkennt Framework und deployed entsprechend."""
    framework = _detect_node_framework(code)
    deps = _extract_node_deps(code)

    # Wenn der Code einen eigenen Server hat, Port auf 80 patchen
    if framework in ("express", "http_server", "koa"):
        # Ersetze gaengige Port-Definitionen durch 80
        code = re.sub(r'(listen\s*\(\s*)(3000|8080|8000|5000|4000)', r'\g<1>80', code)
        code = re.sub(r"(PORT\s*=\s*(?:process\.env\.PORT\s*\|\|\s*)?)(3000|8080|8000|5000|4000)", r"\g<1>80", code)

    with open(os.path.join(build_dir, "app.js"), "w") as f:
        f.write(code)

    # package.json fuer deps
    if deps:
        pkg_json = {"name": "aicompany-app", "version": "1.0.0", "dependencies": {d: "*" for d in deps}}
        with open(os.path.join(build_dir, "package.json"), "w") as f:
            json.dump(pkg_json, f)

    if framework in ("express", "http_server", "koa"):
        # Eigener Server — direkt starten
        cmd = '["node", "app.js"]'
    else:
        # Script — mit HTTP-Wrapper ausfuehren
        _write_node_wrapper(build_dir, app_name)
        cmd = '["node", "server.js"]'

    install_deps = ""
    if deps:
        install_deps = "COPY package.json .\nRUN npm install --production\n"

    with open(os.path.join(build_dir, "Dockerfile"), "w") as f:
        f.write(f"""FROM node:18-alpine
LABEL {APP_LABEL}="true"
LABEL {APP_LABEL}.name="{app_name}"
WORKDIR /app
{install_deps}COPY . .
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1/health || exit 1
CMD {cmd}
""")

    return "node:18-alpine"


def _write_node_wrapper(build_dir: str, app_name: str):
    """Schreibt einen HTTP-Wrapper fuer einfache Node.js-Scripts."""
    with open(os.path.join(build_dir, "server.js"), "w") as f:
        f.write(f"""const http = require('http');
const {{ execSync }} = require('child_process');
const PORT = 80;
const APP_NAME = {json.dumps(app_name)};
const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

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
  const page = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${{APP_NAME}}</title>
<style>*{{margin:0;padding:0;box-sizing:border-box}}body{{font-family:system-ui,sans-serif;background:#0f1117;color:#e2e8f0;padding:2rem}}
h1{{background:linear-gradient(135deg,#818cf8,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:1rem}}
.out{{background:#1a1b26;padding:1.5rem;border-radius:.75rem;white-space:pre-wrap;font-size:.875rem;line-height:1.6;border:1px solid #2d2d3d;font-family:monospace}}
.err{{border-color:#ef4444;color:#fca5a5;margin-top:1rem}}</style></head>
<body><h1>${{APP_NAME}}</h1>
<div class="out">${{output ? esc(output) : '<em style="color:#64748b;">Keine Ausgabe</em>'}}</div>
${{errors ? '<div class="out err">'+esc(errors)+'</div>' : ''}}</body></html>`;
  res.writeHead(200, {{ 'Content-Type': 'text/html; charset=utf-8' }});
  res.end(page);
}});
server.listen(PORT);
""")



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
        # Template-Auswahl: Sprache aus DB + Inhaltserkennung.
        # Neue Apps speichern rohen Code mit korrektem language-Tag.
        # Alte Apps (vor v0.7) haben alles in HTML gewrapped.
        code_lower = code.strip().lower()
        is_html = code_lower.startswith("<!doctype") or code_lower.startswith("<html") or "<html" in code_lower[:500]

        # Code bereinigen (KI-Artefakte entfernen)
        if not is_html:
            code = _sanitize_code(code, language)

        if language in ("python", "py") and not is_html:
            base_image = _create_python_app(build_dir, code, app_name)
        elif language in ("javascript", "js", "typescript", "ts") and not is_html:
            base_image = _create_node_app(build_dir, code, app_name)
        elif is_html:
            base_image = _create_html_app(build_dir, code, app_name)
        elif language == "code" and not is_html:
            # Alte "code"-Apps die keinen HTML-Wrapper haben — als Node.js versuchen
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
