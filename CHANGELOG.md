# Changelog

Alle wichtigen Änderungen an AI Company werden hier dokumentiert.

Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/),
Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).

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
