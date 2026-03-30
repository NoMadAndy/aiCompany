# AI Company - Agentenanweisungen

## Projektübersicht
AI Company ist eine selbst-evolvierende KI-Plattform, die wie eine virtuelle Firma aufgebaut ist.
Sie verwaltet KI-Agenten, Projekte, Budgets und Assets. Die App kann selbstständig Code schreiben,
KI-Modelle trainieren und große Aufgaben im Hintergrund abarbeiten.

**Live URL**: https://aicompany.macherwerkstatt.cc
**Ports**: Frontend 3002, Backend API 8002 (hinter Reverse Proxy), App-Container 4000-4100
**GPU**: NVIDIA RTX 2080 Super (8GB VRAM)

## Tech Stack
- **Frontend**: Next.js 14 + TypeScript + TailwindCSS + shadcn/ui
- **Backend**: Next.js API Routes + Socket.IO WebSocket
- **AI Worker**: Python 3.12 + PyTorch + Transformers (GPU-enabled)
- **Database**: PostgreSQL 16
- **Queue/Cache**: Redis 7
- **Deployment**: Docker Compose mit NVIDIA Container Toolkit
- **Auto-Reload**: Chokidar File Watcher → Auto-Rebuild → Docker Restart

## Architektur
```
┌─────────────────────────────────────────────┐
│  Next.js App (Port 3002)                    │
│  ├── Dashboard (WebSocket Live-View)        │
│  ├── Projekte & Aufgaben                    │
│  ├── KI-Agenten Verwaltung                  │
│  ├── Changelog & Logs                       │
│  ├── Mitarbeiter & Budgets                  │
│  └── API Routes (/api/*)                    │
├─────────────────────────────────────────────┤
│  Python AI Worker (GPU)                     │
│  ├── Task Queue (Redis/Celery)              │
│  ├── Code Generation                        │
│  ├── Web Research                           │
│  ├── Model Training                         │
│  ├── Background Jobs                        │
│  └── App Deployer (Docker CLI)              │
├─────────────────────────────────────────────┤
│  Docker App-Container (Port 4000-4100)      │
│  ├── nginx:alpine (HTML/JS Apps)            │
│  ├── python:3.12-slim (Python Apps)         │
│  └── node:18-alpine (Node.js Apps)          │
├─────────────────────────────────────────────┤
│  PostgreSQL │ Redis │ File Watcher          │
└─────────────────────────────────────────────┘
```

## Projektstruktur
```
/home/andy/aiCompany/
├── CLAUDE.md              # Diese Datei
├── CHANGELOG.md           # Versionierung
├── docker-compose.yml     # Deployment
├── frontend/              # Next.js App
│   ├── src/
│   │   ├── app/           # App Router Pages
│   │   ├── components/    # UI Komponenten
│   │   ├── lib/           # Utilities
│   │   └── types/         # TypeScript Types
│   ├── Dockerfile
│   └── package.json
├── worker/                # Python AI Worker
│   ├── tasks/             # Celery Tasks
│   ├── agents/            # KI-Agenten
│   ├── app_deployer.py    # Docker App-Deployment
│   ├── Dockerfile
│   └── requirements.txt
├── docs/                  # Dokumentation
│   └── APP-DEPLOYMENT.md  # Docker-Deploy-Doku
└── scripts/               # Helper Scripts
```

## Regeln
1. **Jede Änderung** wird versioniert und im Changelog dokumentiert
2. **Jeder Push** geht direkt nach GitHub
3. **Auto-Reload** bei Code-Änderungen
4. **GPU** wird für KI-Aufgaben genutzt (PyTorch CUDA)
5. **Wissenschaftliche Quellen** bei Recherchen bevorzugen
6. **WebSocket** für alle Live-Updates verwenden
7. **Responsive Design** - Mobile First

## Aktive Projekte
- **GeldAlchemie**: 100€ → 100.000€ (Simulation + Real-Modus)
  - KI-gestützte digitale Arbitrage und Asset-Generierung
  - Compound Growth Strategien

## Befehle
```bash
# Starten
docker compose up -d --build

# Logs
docker compose logs -f

# Neustart
docker compose restart

# Komplett neu bauen
docker compose down && docker compose up -d --build
```
