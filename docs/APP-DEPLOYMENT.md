# App-Deployment — Docker-Container-basiert

> Version 0.6.0 "Atlas" — 2026-03-30

## Uebersicht

Generierte Apps werden als isolierte Docker-Container deployed. Jede App bekommt einen eigenen Port, eigene Ressourcen und einen eigenen Lebenszyklus.

## Architektur

```
┌──────────────────────────────────────────────┐
│  AI Company Worker                           │
│  ├── app_deployer.py                         │
│  │   ├── Port-Manager (4000-4100)            │
│  │   ├── Docker CLI (via Socket)             │
│  │   └── Container-Lifecycle                 │
│  └── /apps/* Endpoints                       │
├──────────────────────────────────────────────┤
│  Docker Host                                 │
│  ├── aicompany-app-{id} (nginx:alpine)       │  ← HTML/JS Apps
│  ├── aicompany-app-{id} (python:3.12-slim)   │  ← Python Apps
│  └── aicompany-app-{id} (node:18-alpine)     │  ← Node.js Apps
├──────────────────────────────────────────────┤
│  Host-Ports: 4000-4100                       │
│  Netzwerk: aicompany_aicompany               │
│  Ressourcen: 256MB RAM, 0.5 CPU pro App      │
└──────────────────────────────────────────────┘
```

## Deployment-Ablauf

```
1. Code-Generierung (Worker → Claude API / Qwen)
2. Auto-Save in deployed_apps (DB)
3. User klickt "Deployen" auf der Apps-Seite
4. Worker prueft Port-Verfuegbarkeit:
   a. DB: Bereits vergebene Ports
   b. Docker: Laufende Container mit dem Port
   c. Socket: TCP-Verbindungstest
5. Build-Verzeichnis mit App-Code + Dockerfile
6. docker build → docker run
7. DB-Status-Update (container_id, port, status)
8. App erreichbar unter http://host:{port}
```

## App-Templates

### HTML/JS (nginx:alpine)
- Statische Dateien werden per nginx ausgeliefert
- `try_files` mit Fallback auf `index.html`
- Gzip-Kompression aktiviert
- Ideal fuer: Calculator, Dashboard, Visualisierungen

### Python (python:3.12-slim)
- Script wird in Sandbox ausgefuehrt (30s Timeout)
- Output als HTML gerendert
- Fehler werden sichtbar angezeigt
- Ideal fuer: Berechnungen, Datenverarbeitung, Skripte

### Node.js (node:18-alpine)
- Script wird pro Request ausgefuehrt (30s Timeout)
- Stdout als HTML gerendert
- Ideal fuer: Logik, API-Prototypen, Berechnungen

## API-Referenz

| Endpoint | Methode | Beschreibung |
|----------|---------|-------------|
| `/apps/deploy` | POST | `{ "app_id": 1 }` — Container starten |
| `/apps/stop` | POST | `{ "app_id": 1 }` — Container stoppen |
| `/apps/restart` | POST | `{ "app_id": 1 }` — Container neustarten |
| `/apps/remove` | POST | `{ "app_id": 1 }` — Container + Image entfernen |
| `/apps/{id}/status` | GET | Container-Status abfragen |
| `/apps/{id}/logs` | GET | `?tail=50` — Container-Logs |
| `/apps/ports/available` | GET | Naechsten freien Port finden |
| `/apps/cleanup` | POST | Verwaiste Container aufraeumen |

## Port-Management

- **Bereich**: 4000-4100 (konfigurierbar via `APP_PORT_MIN`/`APP_PORT_MAX`)
- **Dreifache Pruefung**:
  1. DB-Abfrage: Bereits zugewiesene Ports (Status running/building/stopped)
  2. Docker-Check: `docker ps` nach Port-Mappings
  3. Socket-Check: TCP-Verbindungstest auf `0.0.0.0:{port}`
- **Unique-Index**: DB erzwingt Port-Einmaligkeit

## Container-Ressourcen

| Ressource | Limit |
|-----------|-------|
| RAM | 256 MB |
| CPU | 0.5 Cores |
| Restart-Policy | unless-stopped |
| Health-Check | alle 10s, 3 Retries |
| Netzwerk | aicompany_aicompany |

## Datenbank-Schema (deployed_apps)

```sql
-- Neue Spalten (Migration 004)
container_id      VARCHAR(64)    -- Docker Container ID
port              INTEGER        -- Host-Port (4000-4100)
deploy_type       VARCHAR(20)    -- 'inline' oder 'docker'
container_status  VARCHAR(30)    -- 'none','building','running','stopped','error'
docker_image      VARCHAR(255)   -- z.B. 'aicompany-app-42:latest'
error_log         TEXT           -- Letzte Fehlermeldung
updated_at        TIMESTAMP      -- Letztes Update
```

## Troubleshooting

### Kein freier Port
```bash
# Laufende App-Container anzeigen
docker ps --filter label=aicompany.app=true

# Verwaiste Container aufraeumen
curl -X POST http://localhost:8080/apps/cleanup
```

### Container startet nicht
```bash
# Logs pruefen
docker logs aicompany-app-{id}

# Container manuell pruefen
docker inspect aicompany-app-{id}
```

### Docker-Socket nicht verfuegbar
Sicherstellen, dass in `docker-compose.yml` der Socket gemountet ist:
```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

### Port-Bereich aendern
In `.env` oder als Environment-Variable:
```env
APP_PORT_MIN=5000
APP_PORT_MAX=5100
```

## Sicherheitshinweise

- Container laufen mit Ressourcen-Limits (kein OOM des Hosts)
- Docker-Socket-Mount gibt dem Worker Root-Zugriff auf Docker — nur in vertrauenswuerdigen Umgebungen
- App-Container haben keinen Zugriff auf andere Services (ausser Netzwerk)
- Python/Node-Apps haben ein 30s Execution-Timeout
