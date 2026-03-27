# API-Dokumentation

## Base URLs

- **Frontend API**: `https://aicompany.macherwerkstatt.cc/api/` (oder `http://localhost:3002/api/`)
- **Worker API**: `http://worker:8080/` (nur intern erreichbar)

---

## Frontend API Routes

### GET /api/dashboard

Aggregierte Dashboard-Daten.

**Response:**
```json
{
  "stats": {
    "employees": 5,
    "projects": 2,
    "tasks": 12,
    "budget": 5100.00
  },
  "activities": [
    { "id": 1, "type": "system", "message": "...", "created_at": "..." }
  ],
  "employees": [
    { "id": 1, "name": "ARIA", "role": "Chief AI Officer", "status": "active" }
  ],
  "projects": [
    { "id": 1, "name": "GeldAlchemie", "status": "active", "budget": 100, "spent": 0 }
  ]
}
```

---

### GET /api/status

System-Status fur die StatusBar.

**Response:**
```json
{
  "cpu": 0,
  "gpu": "RTX 2080S",
  "tasks": 3,
  "uptime": 1234.56,
  "version": "0.3.0"
}
```

---

### GET /api/projects

Liste aller Projekte mit Task-Counts.

**Response:**
```json
{
  "projects": [
    {
      "id": 1,
      "name": "GeldAlchemie",
      "description": "...",
      "status": "active",
      "budget": 100.00,
      "spent": 0.00,
      "config": { "target": 100000, "strategies": [...] },
      "task_count": 6,
      "completed_tasks": 6,
      "created_at": "2026-03-27T..."
    }
  ]
}
```

### POST /api/projects

Neues Projekt erstellen.

**Request:**
```json
{
  "name": "Mein Projekt",
  "description": "Detaillierte Beschreibung...",
  "budget": 5000
}
```

---

### POST /api/projects/coordinate

Projekt an ARIA (Koordinator) ubergeben. ARIA analysiert das Projekt, erstellt Tasks und delegiert an das Team.

**Request:**
```json
{
  "project_id": 3
}
```

**Response:**
```json
{
  "status": "coordinating",
  "project_id": 3
}
```

Tasks werden asynchron im Worker erstellt und ausgefuhrt.

---

### GET /api/tasks

Tasks auflisten. Optional nach Projekt filtern.

**Query Parameter:**
- `project_id` (optional): Nur Tasks dieses Projekts
- `task_id` (optional): Einzelnen Task abrufen

**Response:**
```json
{
  "tasks": [
    {
      "id": 1,
      "title": "Recherche: Marktanalyse...",
      "status": "completed",
      "result": { "type": "research", "summary": "..." },
      "employee_name": "SCOUT",
      "created_at": "...",
      "completed_at": "..."
    }
  ]
}
```

### POST /api/tasks

Neuen Task erstellen und automatisch an Worker senden.

**Request:**
```json
{
  "employee_id": 3,
  "title": "Recherchiere KI-Trends 2026",
  "description": "Optional",
  "project_id": null,
  "priority": 5
}
```

---

### GET /api/employees

Alle Agenten mit Task-Statistiken.

**Response:**
```json
{
  "employees": [
    {
      "id": 1,
      "name": "ARIA",
      "role": "Chief AI Officer",
      "department": "Management",
      "skills": ["planning", "strategy", "delegation"],
      "status": "active",
      "system_prompt": "...",
      "model": "claude-sonnet-4-6",
      "total_tasks": 5,
      "completed_tasks": 5
    }
  ]
}
```

---

### GET /api/changelog

Changelog aus CHANGELOG.md geparst.

**Response:**
```json
{
  "entries": [
    {
      "id": 1,
      "version": "0.3.0",
      "title": "Conductor",
      "changes": [
        { "type": "added", "text": "ARIA Projektkoordinator..." }
      ],
      "created_at": "2026-03-27"
    }
  ],
  "markdown": "# Changelog\n..."
}
```

---

### GET /api/logs

Activity Log mit Paginierung und Filter.

**Query Parameter:**
- `type` (optional): system, project, task, error, ai, finance
- `limit` (default: 100)
- `offset` (default: 0)

**Response:**
```json
{
  "logs": [
    { "id": 1, "type": "ai", "message": "[ARIA] ...", "created_at": "..." }
  ],
  "total": 42
}
```

---

### GET /api/live

Neue Events seit letztem Aufruf (fur Live-View).

**Query Parameter:**
- `since` (optional): ISO timestamp

---

### POST /api/lab/run

Experiment an den Worker senden.

**Request:**
```json
{
  "prompt": "GPU Matrix Benchmark",
  "type": "experiment"
}
```

---

### POST /api/geld-alchemie

GeldAlchemie-Simulation starten.

**Request:**
```json
{
  "start_capital": 100,
  "target": 100000,
  "weeks": 52,
  "strategy": "compound"
}
```

**Strategies:** `compound`, `arbitrage`, `content`, `mixed`
