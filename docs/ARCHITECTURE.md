# Architektur-Dokumentation

## Systemubersicht

AI Company ist eine Microservice-Architektur mit vier Hauptkomponenten:

1. **Frontend** (Next.js) — UI + API Gateway
2. **Worker** (Python/FastAPI) — KI-Task-Verarbeitung + GPU
3. **PostgreSQL** — Persistenz
4. **Redis** — Cache und Task Queue

## Datenfluss

### Projekt-Koordination (Hauptflow)

```
User erstellt Projekt
    │
    ▼
POST /api/projects          → INSERT INTO projects
    │
    ▼
User klickt "An ARIA ubergeben"
    │
    ▼
POST /api/projects/coordinate
    │
    ▼
Frontend → POST worker:8080/coordinate
    │
    ▼
Worker: ARIA analysiert Projekt
    ├── Liest project.name, description, config
    ├── classify_task() bestimmt Aufgabentypen
    └── generate_project_tasks() erzeugt Task-Liste
    │
    ▼
Worker: Tasks in DB anlegen
    ├── INSERT INTO tasks (fur jeden Task)
    └── INSERT INTO activity_log (Delegation)
    │
    ▼
Worker: Tasks sequenziell ausfuhren
    ├── execute_research()      → SCOUT
    ├── execute_code_generation() → NEXUS
    ├── execute_ml_training()   → FORGE
    ├── execute_finance()       → VAULT
    └── execute_planning()      → ARIA
    │
    ▼
Worker: Ergebnisse speichern
    ├── UPDATE tasks SET result = ...
    └── INSERT INTO activity_log
    │
    ▼
Frontend pollt /api/tasks?project_id=X
    └── Zeigt Live-Fortschritt
```

### Direkte Task-Zuweisung

```
User wahlt Agent → tippt Aufgabe
    │
    ▼
POST /api/tasks
    ├── INSERT INTO tasks
    └── POST worker:8080/task (async)
    │
    ▼
Worker: classify_task()
    └── Wahlt Executor basierend auf Keywords + Department
    │
    ▼
Worker: execute_*()
    └── UPDATE tasks SET result, status
    │
    ▼
Frontend pollt /api/tasks (alle 2s bei laufenden Tasks)
```

## Task-Klassifizierung

Der Worker klassifiziert Tasks anhand von Keywords im Titel:

| Keywords | Typ | Agent |
|----------|-----|-------|
| recherch, such, find, paper | research | SCOUT |
| code, programm, implement | code_generation | NEXUS |
| daten, statistik, bericht | analysis | SCOUT |
| budget, finanz, invest | finance | VAULT |
| train, model, gpu, neural | ml_training | FORGE |
| (Fallback nach Department) | varies | varies |

## Datenbank-Schema

### Tabellen

- **users** — App-Benutzer (aktuell 1 Admin)
- **employees** — KI-Agenten (5 Stuck) mit system_prompt, model, skills
- **projects** — Projekte mit budget, config (JSONB), status
- **tasks** — Aufgaben mit result (JSONB), verknupft mit employee + project
- **assets** — Projekt-Assets und Ressourcen
- **activity_log** — Alle System-Events (der Live-Feed)
- **changelog** — Versionseinträge (initial, danach CHANGELOG.md als Source)

### Beziehungen

```
users (1) ──< projects (N) ──< tasks (N) >── employees (1)
                  │                │
                  ├──< assets      ├──< activity_log
                  └──< activity_log
```

## API-Endpunkte

### Frontend API Routes (Next.js)

| Method | Pfad | Beschreibung |
|--------|------|-------------|
| GET | /api/dashboard | Aggregierte Stats |
| GET | /api/status | System-Status, GPU, Tasks |
| GET/POST | /api/projects | Projekte lesen/erstellen |
| POST | /api/projects/coordinate | Projekt an ARIA delegieren |
| GET/POST | /api/tasks | Tasks lesen/erstellen (triggert Worker) |
| GET | /api/employees | Agenten mit Task-Stats |
| GET | /api/changelog | Changelog aus CHANGELOG.md |
| GET | /api/logs | Activity Log mit Filter |
| GET | /api/live | Neue Events seit letztem Poll |
| GET | /api/assets | Projekt-Assets |
| POST | /api/lab/run | Experiment an Worker senden |
| POST | /api/geld-alchemie | Simulation starten |

### Worker API (FastAPI)

| Method | Pfad | Beschreibung |
|--------|------|-------------|
| GET | /health | Health Check + GPU Status |
| GET | /gpu | GPU-Details |
| POST | /task | Task ausfuhren (async) |
| POST | /coordinate | Projekt koordinieren (async) |
| POST | /run | Experiment starten |
| POST | /research | Web-Recherche |
| POST | /geld-alchemie/simulate | Finanz-Simulation |

## GPU-Integration

- **Hardware**: NVIDIA RTX 2080 Super (8GB VRAM)
- **Runtime**: nvidia/cuda:12.4.0-runtime-ubuntu22.04
- **Framework**: PyTorch 2.5.1 + CUDA 12.4
- **Docker**: NVIDIA Container Toolkit mit GPU Reservation
- **Nutzung**: ML-Benchmarks, Tensor-Operationen, Model Training

## Sicherheit

- Datenbank nur intern erreichbar (kein exponierter Port)
- Redis nur intern
- Worker nur uber Frontend-API erreichbar
- Keine Secrets in Git (.env in .gitignore)
- Docker Bridge Network isoliert alle Services

## Auto-Reload

- Worker: uvicorn `--reload` Flag + Volume Mount (`./worker:/app`)
- Frontend: Erfordert Docker Rebuild (production build)
- Watcher-Service: Chokidar uberwacht Dateianderungen
