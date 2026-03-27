# AI Company

Selbst-evolvierende KI-Plattform, aufgebaut wie eine virtuelle Firma. KI-Agenten arbeiten als Team: sie recherchieren, programmieren, analysieren Finanzen, trainieren ML-Modelle und koordinieren Projekte autonom.

**Live**: [aicompany.macherwerkstatt.cc](https://aicompany.macherwerkstatt.cc)

## Features

- **5 KI-Agenten** mit spezialisierten Rollen (CEO, Developer, Researcher, ML Engineer, Finance Manager)
- **Projekt-Koordination**: ARIA (CEO) analysiert Projekte, erstellt Aufgaben und delegiert an das Team
- **Task-Pipeline**: Automatische Klassifizierung und Ausführung (Research, Code, ML, Finanzen, Planung)
- **GPU-Support**: NVIDIA RTX 2080 Super fur ML-Training und Benchmarks (PyTorch + CUDA)
- **Web-Recherche**: DuckDuckGo + Semantic Scholar fur wissenschaftliche Quellen
- **GeldAlchemie**: Simulations-Engine fur Compound Growth, Arbitrage, Content und Mixed-Strategien
- **Live Dashboard**: Echtzeit-Updates, Activity Feed, System-Monitoring
- **PWA**: Installierbar auf Handy/Desktop, Offline-fähig

## Tech Stack

| Komponente | Technologie |
|-----------|-------------|
| Frontend | Next.js 14, TypeScript, TailwindCSS |
| Backend | Next.js API Routes |
| AI Worker | Python 3.12, FastAPI, PyTorch, Transformers |
| Datenbank | PostgreSQL 16 |
| Cache/Queue | Redis 7 |
| Deployment | Docker Compose, NVIDIA Container Toolkit |
| GPU | NVIDIA RTX 2080 Super (8GB VRAM, CUDA 12.4) |

## Schnellstart

### Voraussetzungen

- Docker + Docker Compose
- NVIDIA GPU + Container Toolkit (optional, fur ML-Tasks)

### Installation

```bash
git clone https://github.com/NoMadAndy/aiCompany.git
cd aiCompany
docker compose up -d --build
```

Die App läuft auf **http://localhost:3002**.

### Konfiguration

Ports und URLs können in `docker-compose.yml` angepasst werden:

- Frontend: Port 3002 (intern 3000)
- Worker: Port 8080 (intern, nicht exponiert)
- PostgreSQL: Port 5432 (intern)
- Redis: Port 6379 (intern)

## Architektur

```
                    +------------------+
                    |   Browser/PWA    |
                    +--------+---------+
                             |
                    +--------v---------+
                    |  Next.js Frontend |
                    |  Port 3002        |
                    |  - Dashboard      |
                    |  - Projekte       |
                    |  - KI-Agenten     |
                    |  - API Routes     |
                    +---+----------+---+
                        |          |
               +--------v--+  +---v-----------+
               | PostgreSQL |  | Python Worker |
               |  Port 5432 |  |  Port 8080    |
               |  - Users   |  |  - Tasks      |
               |  - Projects|  |  - Research   |
               |  - Tasks   |  |  - Code Gen   |
               |  - Logs    |  |  - ML/GPU     |
               +------------+  |  - Finance    |
                               |  - Coordinate |
               +------------+  +---------------+
               |   Redis    |        |
               |  Port 6379 |    +---v---+
               |  - Cache   |   |  GPU  |
               |  - Queue   |   | CUDA  |
               +------------+   +-------+
```

## KI-Agenten

| Agent | Rolle | Abteilung | Spezialgebiet |
|-------|-------|-----------|---------------|
| **ARIA** | Chief AI Officer | Management | Strategie, Planung, Projektkoordination |
| **NEXUS** | Senior Developer | Engineering | Code-Generierung, Architektur, Docker |
| **SCOUT** | Research Analyst | Research | Web-Recherche, Datenanalyse, Paper |
| **FORGE** | ML Engineer | AI Lab | PyTorch, GPU-Training, Modelldesign |
| **VAULT** | Finance Manager | Finance | Budgets, Risiko-Analyse, Trading |

## Nutzung

### Projekt erstellen und koordinieren

1. **Projekte** Seite offnen
2. "Neues Projekt" klicken
3. Name und **detaillierte Beschreibung** eingeben (je mehr Details, desto bessere Tasks)
4. **"An ARIA ubergeben"** klicken
5. ARIA analysiert das Projekt und verteilt Aufgaben automatisch an das Team
6. Fortschritt live verfolgen

### Direkte Task-Zuweisung

1. **KI-Agenten** Seite offnen
2. Agent auswählen (z.B. SCOUT fur Recherche)
3. Aufgabe eintippen und absenden
4. Ergebnis erscheint im Task-Feed

### Beispiel-Aufgaben

| Agent | Beispiel |
|-------|---------|
| SCOUT | "Recherchiere aktuelle KI-Trends 2026" |
| NEXUS | "Erstelle ein Python-Script fur Datenanalyse" |
| FORGE | "Starte GPU-Benchmark und zeige VRAM-Info" |
| VAULT | "Erstelle Finanzbericht fur alle Projekte" |
| ARIA | "Analysiere Team-Auslastung und offene Tasks" |

## Befehle

```bash
# Starten
docker compose up -d --build

# Logs anzeigen
docker compose logs -f

# Einzelnen Service neustarten
docker compose restart frontend
docker compose restart worker

# Komplett neu bauen
docker compose down && docker compose up -d --build

# GPU-Status prufen
docker exec aicompany-worker-1 python3 -c "import torch; print(torch.cuda.is_available())"
```

## Projektstruktur

```
aiCompany/
├── CLAUDE.md              # KI-Agenten Anweisungen
├── CHANGELOG.md           # Versionierung
├── README.md              # Diese Datei
├── docker-compose.yml     # Deployment
├── version.json           # Aktuelle Version
├── frontend/              # Next.js App
│   ├── src/
│   │   ├── app/           # Pages + API Routes
│   │   ├── components/    # UI (Sidebar, StatusBar)
│   │   └── lib/           # DB, Utilities
│   ├── public/            # PWA Assets, Favicon
│   └── Dockerfile
├── worker/                # Python AI Worker
│   ├── main.py            # FastAPI + Task Dispatcher
│   ├── tasks/             # Research, Code Gen
│   ├── agents/            # BaseAgent Klasse
│   └── Dockerfile
├── scripts/
│   ├── init.sql           # DB Schema + Seed Data
│   ├── deploy.sh          # Deploy Script
│   └── version-bump.sh    # Versionierung
└── docs/                  # Dokumentation
```

## Versionierung

Jede Änderung wird versioniert nach [Semantic Versioning](https://semver.org/):

| Version | Codename | Beschreibung |
|---------|----------|-------------|
| 0.3.0 | Conductor | ARIA Projektkoordinator, Task-Delegation |
| 0.2.0 | Synapse | Task-Pipeline, PWA, GPU-Fix |
| 0.1.0 | Genesis | Initiale Plattform |

Siehe [CHANGELOG.md](CHANGELOG.md) fur Details.

## Lizenz

Privates Projekt von Andy / MacherWerkstatt.
