# KI-Agenten Dokumentation

## Ubersicht

AI Company hat 5 spezialisierte KI-Agenten, die als Team zusammenarbeiten. Jeder Agent hat eine Rolle, Abteilung und spezialisierte Fähigkeiten.

## Agenten

### ARIA — Chief AI Officer (Management)

**Employee ID:** 1
**Skills:** Planning, Strategy, Delegation
**System Prompt:** "Du bist ARIA, die KI-Chefin von AI Company. Du planst Strategien, delegierst Aufgaben und uberwachst den Fortschritt."

**Aufgaben:**
- Projektkoordination: Analysiert Projekte und verteilt Tasks an das Team
- Strategische Planung: Team-Auslastung, Meilensteine, Prioritäten
- Zusammenfassungen: Fasst Teilergebnisse zusammen

**Koordinator-Funktion:**
Wenn ein Projekt an ARIA ubergeben wird (`/coordinate`):
1. Liest Projektname, Beschreibung und Config
2. Analysiert Keywords fur Task-Generierung
3. Erstellt Tasks mit Prioritäten (1 = höchste)
4. Weist Tasks den spezialisierten Agenten zu
5. Fuhrt Tasks sequenziell aus
6. Erstellt abschließende Zusammenfassung

---

### NEXUS — Senior Developer (Engineering)

**Employee ID:** 2
**Skills:** Python, TypeScript, Docker, GPU
**System Prompt:** "Du bist NEXUS, ein erfahrener Entwickler. Du schreibst Code, debuggst und optimierst Systeme."

**Aufgaben:**
- Code-Generierung (Python, TypeScript, JavaScript)
- Technische Architektur und Implementierungspläne
- Automatische Spracherkennung aus Aufgabenbeschreibung

**Keywords:** code, programm, script, implement, develop, build, erstell, schreib

---

### SCOUT — Research Analyst (Research)

**Employee ID:** 3
**Skills:** Web Research, Data Analysis, Scientific Papers
**System Prompt:** "Du bist SCOUT, ein Forschungsanalyst. Du recherchierst im Web, analysierst Daten und findest wissenschaftliche Quellen."

**Aufgaben:**
- Web-Recherche via DuckDuckGo HTML Search
- Wissenschaftliche Paper-Suche via Semantic Scholar API
- Datenanalyse: System-Metriken, Task-Statistiken, GPU-Status
- Content-Strategie und Marktanalyse

**Keywords:** recherch, such, find, research, analys, paper, studie, quelle, daten, statistik

**APIs:**
- DuckDuckGo HTML: `https://html.duckduckgo.com/html/`
- Semantic Scholar: `https://api.semanticscholar.org/graph/v1/paper/search`

---

### FORGE — ML Engineer (AI Lab)

**Employee ID:** 4
**Skills:** PyTorch, Training, Model Design, CUDA
**System Prompt:** "Du bist FORGE, ein ML-Ingenieur. Du trainierst Modelle, designst Architekturen und nutzt die GPU."

**Aufgaben:**
- GPU-Benchmarks (Matrix-Multiplikation in verschiedenen Grossen)
- VRAM-Monitoring und GPU-Status
- ML-Konzepte und Modellauswahl
- Training-Vorbereitung

**Keywords:** train, model, gpu, neural, ml, ki-modell, machine learning

**GPU-Benchmark:**
- 512x512, 1024x1024, 2048x2048 Matrix-Multiplikation
- Misst GFLOPS und Latenz
- Zeigt VRAM-Verbrauch

---

### VAULT — Finance Manager (Finance)

**Employee ID:** 5
**Skills:** Budgeting, Trading, Risk Analysis
**System Prompt:** "Du bist VAULT, der Finanzmanager. Du verwaltest Budgets, analysierst Risiken und optimierst Gelströme."

**Aufgaben:**
- Finanzberichte: Budget-Ubersicht aller Projekte
- Budget-Analyse: Ausgaben vs. Verfugbar
- Asset-Ubersicht nach Typ
- Risiko-Bewertung

**Keywords:** budget, geld, finanz, kosten, invest, rendite, profit

## Task-Lebenszyklus

```
pending → running → completed
                  → failed
```

1. **pending**: Task wurde erstellt, wartet auf Worker
2. **running**: Worker hat Task ubernommen, Ausfuhrung läuft
3. **completed**: Ergebnis in `tasks.result` (JSONB) gespeichert
4. **failed**: Fehler aufgetreten, Error in `tasks.result`

## Ergebnis-Format

Jeder Task speichert sein Ergebnis als JSONB mit folgendem Schema:

```json
{
  "type": "research|code_generation|analysis|finance|ml_training|planning|general",
  "task_type": "...",
  "summary": "Markdown-formatierter Text mit Ergebnis",
  // Typ-spezifische Felder:
  "web_results": [...],           // research
  "scientific_results": [...],    // research
  "sources_count": 8,             // research
  "code": "...",                  // code_generation
  "language": "python",           // code_generation
  "gpu": {...}                    // ml_training
}
```
