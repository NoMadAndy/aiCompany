# Changelog

Alle wichtigen Änderungen an AI Company werden hier dokumentiert.

Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/),
Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).

## [0.7.1] - 2026-03-31

### Hinzugefuegt
- **Claude-Modell auswaehlbar**: Auf der Einstellungen-Seite (Tab "API-Schluessel") kann das Claude-Modell per Dropdown gewaehlt werden
  - Verfuegbare Modelle werden live von der Anthropic API synchronisiert (5min Cache)
  - "Synchronisieren" Button laedt aktuelle Modell-Liste direkt von Anthropic
  - Auswahl wird in der Datenbank gespeichert und vom Worker automatisch uebernommen (60s Cache)
  - Anzeige des aktiven Modells auch im System-Tab
- **Worker liest Modell aus DB**: Kein hardcoded Modell mehr — `_get_claude_model()` liest aus Admin-Settings mit Fallback auf Env-Variable `CLAUDE_MODEL` und Default
- **`GET /ai/models`**: Neuer Worker-Endpoint gibt verfuegbare Modelle aus (live + Fallback)

### Behoben
- **Falsche Modell-IDs**: `claude-sonnet-4-6-20250514` und aehnliche nicht-existierende IDs entfernt — korrekte IDs: `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`
- **Settings-Seite**: KI-Modell Konfiguration war veraltet und zeigte statische Werte — jetzt dynamisch und interaktiv
- **version.json**: War auf 0.5.0 stehen geblieben — jetzt synchron mit CHANGELOG

## [0.7.0] - 2026-03-30 — "Argus"

### Hinzugefuegt
- **System-Monitoring Dashboard** (/monitoring): Echtzeit-Ueberwachung aller Systeme
  - Aktives KI-Modell (Claude API / Lokal) mit Status-Anzeige
  - GPU-Auslastung: VRAM-Verbrauch, CUDA-Version, Geraet
  - Server-Metriken: CPU, RAM, Uptime mit Fortschrittsbalken
  - Projekt-Fortschritt: Tasks pro Projekt mit Completion-Rate
  - Agenten-Performance: Erfolgsrate, aktive/erledigte/fehlgeschlagene Tasks
  - Container-Uebersicht: Running/Stopped/Building/Error Zaehler
  - Auto-Refresh alle 10 Sekunden
- **Worker-Endpoint /system/metrics**: Aggregiert alle Metriken in einem Aufruf

### Verbessert
- **Code-Generierung**: KI erzeugt jetzt echte FastAPI/Express-Server statt HTML
  - NEXUS-Prompt mit Beispiel-Struktur und 15 strengen Regeln
  - Pflicht: mindestens 2 API-Endpunkte mit Backend-Logik
  - Pflicht: interaktive HTML-Seite mit fetch()-Aufrufen
- **Sprach-Erkennung**: Python/JS haben Prioritaet ueber HTML bei Deployment
  - Explizites Sprach-Tag (```python) wird bevorzugt
  - Content-Sniffing nur fuer ungetaggte Code-Bloecke
- **Code-Qualitaets-Check**: Prueft /health Endpunkt, Port 80, Framework vor Deploy
- **Health-Check**: 60s Timeout (statt 30s), 8s Boot-Delay, 5s Poll-Intervall
- **Lokales Modell**: Token-Limit von 1024 auf 2048 erhoeht

## [0.6.1] - 2026-03-30 — "Atlas"

### Hinzugefuegt
- **Build-Test-Fix Pipeline**: Automatische Code-Validierung und Reparatur
  - Syntax-Validierung vor Deployment (Python ast.parse, JS Klammern-Check)
  - Docker-Deploy → Health-Check → KI-Fehleranalyse → Auto-Fix (max 3 Versuche)
  - KI repariert fehlerhaften Code automatisch basierend auf Container-Logs
  - Pipeline laeuft automatisch nach jeder Code-Generierung

## [0.6.0] - 2026-03-30 — "Atlas"

### Hinzugefuegt
- **Docker-basiertes App-Deployment**: Apps werden als isolierte Docker-Container deployed
  - Automatische Port-Pruefung und -Zuweisung (Bereich 4000-4100)
  - Port-Verfuegbarkeit wird vor Deployment geprueft (TCP + Docker)
  - Container-Lifecycle: Deploy, Stop, Restart, Remove
  - Ressourcen-Limits: 256MB RAM, 0.5 CPU pro App
  - Health-Checks fuer alle App-Container
- **3 App-Templates**: Automatische Template-Auswahl nach Sprache
  - HTML/JS: nginx:alpine fuer statische Apps
  - Python: python:3.12-slim mit HTTP-Wrapper
  - Node.js: node:18-alpine mit HTTP-Server
- **Container-Management-UI**: Erweiterte Apps-Seite
  - Live-Status-Anzeige (Running/Stopped/Building/Error)
  - Deploy, Stop, Restart, Remove Buttons
  - Container-Log-Viewer
  - Direkter Link zu Docker-App (host:port)
- **Worker App-Deployer** (`app_deployer.py`): Vollstaendiger Deployment-Service
  - Port-Manager mit DB + Socket-Check
  - Docker CLI Integration (via Socket-Mount)
  - Orphaned-Container-Cleanup
- **API-Endpoints fuer App-Management**:
  - `POST /apps/deploy` — App als Docker-Container starten
  - `POST /apps/stop` — Container stoppen
  - `POST /apps/restart` — Container neustarten
  - `POST /apps/remove` — Container und Image entfernen
  - `GET /apps/{id}/status` — Container-Status abfragen
  - `GET /apps/{id}/logs` — Container-Logs abrufen
  - `GET /apps/ports/available` — Naechsten freien Port finden
  - `POST /apps/cleanup` — Verwaiste Container aufraeumen
- **Dokumentation**: `docs/APP-DEPLOYMENT.md` mit Architektur, Ablauf, Troubleshooting

### Geaendert
- Worker Dockerfile: Docker CLI installiert fuer Container-Management
- docker-compose.yml: Docker-Socket gemountet, Migration 004 eingebunden
- Apps-Seite: Komplett ueberarbeitet mit Docker-Controls
- Apps-API: Erweitert um Docker-Felder (container_id, port, deploy_type, container_status)

### Datenbank
- Migration 004: `deployed_apps` erweitert um `container_id`, `port`, `deploy_type`, `container_status`, `docker_image`, `error_log`, `updated_at`
- Unique-Index auf `port` (nur fuer laufende Apps)

## [0.5.0] - 2026-03-28 — "Prometheus"

### Hinzugefügt
- **Login & Auth-System**: Session-basierte Authentifizierung mit Cookie-Sessions
  - Login-Seite (`/login`) mit E-Mail + Passwort
  - Auth-Middleware (`requireAuth`, `requireAdmin`) für geschützte Endpoints
  - AuthProvider-Komponente mit automatischer Redirect-Logik
  - AES-256-GCM-Verschlüsselung für API-Schlüssel
- **Benutzerverwaltung** (Admin): Benutzer erstellen, bearbeiten, löschen
  - Rollen: Admin, Manager, Betrachter
  - Passwort-Hashing mit SHA-256 + Salt
- **Einstellungsseite** komplett überarbeitet mit 4 Tabs:
  - Allgemein (System-Info, Endpoints)
  - API-Schlüssel (verschlüsselte Verwaltung)
  - Benutzer (CRUD mit Rollenmanagement)
  - System (Services, KI-Engine Status, .env Konfiguration)
- **Agent-Memory-System**: Agenten lernen aus vergangenen Aufgaben
  - Automatische Erkenntnis-Extraktion nach jeder abgeschlossenen Aufgabe
  - Relevante Erinnerungen werden in System-Prompts injiziert
  - Agenten-Metriken: Erfolgsrate, Lernfortschritt
- **Self-Evolution-System**: AI Company kann eigenen Code verbessern
  - Vorschlag-Genehmigung-Anwendung Pipeline
  - Sicherheitsvalidierung: Nur erlaubte Pfade, keine Secrets
  - Rollback-Möglichkeit für jede Änderung
  - Evolution-Seite (`/evolution`) mit Diff-Ansicht und Memory-Browser
- **.env-Konfigurationsdatei**: Alle Einstellungen zentral konfigurierbar
  - Ports, Datenbank, Redis, API-Keys, Modelle
  - Docker Compose referenziert `.env` mit Fallback-Defaults

### Geändert
- Docker Compose: Alle Werte über `${VAR:-default}` konfigurierbar
- Worker: Frontend-Source als Volume gemountet für Self-Evolution
- Sidebar: Neuer "Evolution"-Menüpunkt
- Layout: AuthProvider umschließt alle Seiten

### Datenbank
- `sessions` Tabelle für Auth
- `agent_memory` Tabelle für Lern-System
- `agent_metrics` Tabelle für Erfolgsmetriken
- `code_changes` Tabelle für Self-Evolution
- `users` erweitert: `password_hash`, `api_keys`, `settings`, `last_login`

## [0.4.0] - 2026-03-27 — "Cortex"

### Hinzugefügt
- **AI Engine** (`ai_engine.py`): Zentrales KI-Gehirn mit dreistufiger Fallback-Kette
  - Claude API (höchste Qualität, wenn ANTHROPIC_API_KEY gesetzt)
  - Lokales GPU-Modell (Qwen2.5-3B-Instruct auf RTX 2080 Super)
  - CPU-Fallback für Verfügbarkeit ohne GPU
- **Echte KI-Agenten**: Alle 5 Agenten nutzen jetzt echte LLM-Inferenz
  - ARIA: Strategische Planung mit strukturierter JSON-Ausgabe
  - SCOUT: Web-Recherche + KI-Analyse der Ergebnisse
  - NEXUS: Echte Code-Generierung mit funktionierendem Output
  - FORGE: GPU-Benchmarks + KI-gestützte ML-Empfehlungen
  - VAULT: Finanzanalysen mit echten Daten + KI-Interpretation
- **Strukturierte KI-Ausgabe** (`think_structured`): JSON-Extraktion aus LLM-Antworten
- **Agent-Persönlichkeiten**: Detaillierte System-Prompts für jeden Agenten (deutsch)
- **`/ai-status` Endpoint**: Echtzeit-Status des KI-Backends (GPU, Modell, API)
- **`/ai/preload` Endpoint**: Modell vorab laden für schnellere erste Antwort
- **Model-Cache Volume**: Heruntergeladene Modelle bleiben über Docker-Rebuilds erhalten

### Geändert
- Worker komplett neugeschrieben für echte KI-Integration
- Alle Task-Executors nutzen `think()` statt regelbasierter Templates
- Koordination nutzt `think_structured()` für intelligente Aufgabenzerlegung
- Docker Compose: ANTHROPIC_API_KEY, LOCAL_MODEL, HF_HOME Environment-Variablen

### Abhängigkeiten
- `anthropic==0.42.0` — Claude API SDK
- `bitsandbytes==0.45.4` — GPU-Speicheroptimierung
- `sentencepiece==0.2.0` — Tokenizer-Backend
- `protobuf==5.29.3` — Serialisierung

## [0.3.1] - 2026-03-27

### Behoben
- **Gradient-Border blockiert Klicks**: `pointer-events: none` auf `::before` Pseudo-Element — "An ARIA übergeben" und alle Buttons in Projektkarten sind jetzt klickbar
- **Changelog**: Zeigt jetzt alle Versionen aus CHANGELOG.md (statt nur DB-Eintrag v0.1.0)
- **Logs**: Neueste Einträge oben, Auto-Scroll zum Anfang statt zum Ende
- **Agent-Karten**: Input-Feld klappt Karte nicht mehr zu (stopPropagation)

### Hinzugefügt
- **README.md**: Vollständige Projektdokumentation mit Schnellstart, Architektur, Agenten-Ubersicht
- **docs/ARCHITECTURE.md**: Technische Architektur, Datenflüsse, Schema, Sicherheit
- **docs/AGENTS.md**: Agenten-Dokumentation mit Skills, Keywords, Ergebnis-Formate
- **docs/API.md**: Komplette API-Referenz aller Endpunkte

### Geändert
- Changelog-API parst CHANGELOG.md direkt statt DB-Fallback
- Log-Icon von ArrowDown zu ArrowUp (neueste oben)

## [0.3.0] - 2026-03-27

### Hinzugefügt
- **ARIA Projektkoordinator**: Projekte können an ARIA übergeben werden
  - Automatische Projektanalyse basierend auf Name, Beschreibung und Config
  - Intelligente Task-Generierung (Research, Code, ML, Finanzen, Planung)
  - Automatische Delegation an spezialisierte Agenten (SCOUT, NEXUS, FORGE, VAULT)
  - Sequenzielle Ausführung nach Priorität
- **Worker `/coordinate` Endpoint**: Neue API für Projektkoordination
- **"An ARIA übergeben" Button**: Auf der Projektseite für jedes Projekt
- **Live Task-Ansicht pro Projekt**: Aufklappbare Task-Liste mit Ergebnissen
- **Verbessertes Projekt-Formular**: Textarea für Beschreibung, besseres Layout
- **Echtzeit-Fortschritt**: Polling für laufende Koordinationen

### Geändert
- Projektseite von Grid zu vertikalem Layout (bessere Task-Darstellung)
- Projekt-Status wird automatisch auf "active" gesetzt bei Koordination

## [0.2.0] - 2026-03-27

### Hinzugefügt
- **Task-Execution-Pipeline**: Aufgaben werden automatisch an Worker weitergeleitet
- **Agent-Routing**: Tasks werden nach Typ klassifiziert (Research, Code, Analyse, Finanzen, ML, Planung)
- **Live Task-Feed**: Echtzeit-Statusanzeige auf der Agenten-Seite mit Ergebnis-Rendering
- **Web-Recherche**: DuckDuckGo + Semantic Scholar Integration für SCOUT
- **GPU-Benchmarks**: FORGE kann GPU-Performance testen (Matrix-Multiplikation)
- **Finanzberichte**: VAULT generiert automatische Budget-Übersichten
- **Planungsmodul**: ARIA analysiert Team-Auslastung und offene Tasks
- **PWA-Support**: Web App Manifest, Service Worker, Offline-Caching
- **App-Icons**: Favicon (ICO + SVG), PWA-Icons (192px, 512px)
- **GitHub-Repository**: Automatischer Push nach NoMadAndy/aiCompany

### Behoben
- GPU-Erkennung fehlgeschlagen wegen `total_mem` → `total_memory` (PyTorch API)
- favicon.ico 404-Fehler (fehlte im public-Verzeichnis)
- version.json 404-Fehler (lag nicht im public-Verzeichnis)

## [0.1.0] - 2026-03-27

### Hinzugefügt
- Initiale Projektstruktur erstellt
- Docker Compose Setup mit PostgreSQL, Redis, Next.js, Python Worker
- Dashboard mit WebSocket Live-View
- Changelog-Ansicht in der App
- Log-Viewer mit Echtzeit-Updates
- Benutzerverwaltung (Grundstruktur)
- Projektverwaltung mit KI-Agenten
- "GeldAlchemie" Projekt: 100€ → 100.000€ Simulation
- GPU-Support für NVIDIA RTX 2080 Super
- Auto-Reload bei Code-Änderungen
- Responsive Design (Mobile + Desktop)
- Firmenstruktur: Mitarbeiter, Budgets, Assets
- Wissenschaftliche Recherche-Engine
