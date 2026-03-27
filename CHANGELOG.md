# Changelog

Alle wichtigen Änderungen an AI Company werden hier dokumentiert.

Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/),
Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).

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
