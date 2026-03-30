"""AI Company Worker — GPU-enabled AI task processing with real intelligence."""

import os
import json
import asyncio
import logging
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
import psycopg2
import redis
import httpx

from tasks.research import web_search, search_scientific
from ai_engine import think, think_structured, get_engine_status, load_local_model
from agents.memory import extract_and_store_learnings, get_relevant_memories, update_agent_metrics
from agents.self_evolve import propose_change, apply_change, rollback_change, analyze_and_propose, read_file, list_files
from app_deployer import deploy_app, stop_app, restart_app, remove_app, get_app_status, get_container_logs, find_available_port, cleanup_orphaned_containers

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai-worker")

app = FastAPI(title="AI Company Worker", version="0.4.0")


# ─── Infrastructure ───────────────────────────────────────────────

def get_db():
    return psycopg2.connect(os.environ.get("DATABASE_URL", "postgresql://aicompany:aicompany@db:5432/aicompany"))

def get_redis():
    return redis.from_url(os.environ.get("REDIS_URL", "redis://redis:6379"))

def check_gpu():
    try:
        import torch
        if torch.cuda.is_available():
            return {
                "available": True,
                "device": torch.cuda.get_device_name(0),
                "memory": f"{torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB",
                "vram_used": f"{torch.cuda.memory_allocated() / 1e9:.1f} GB",
                "cuda_version": torch.version.cuda,
            }
    except Exception:
        pass
    return {"available": False, "device": "CPU", "memory": "N/A"}

def log_activity(type_: str, message: str, project_id=None, employee_id=None, details=None):
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO activity_log (type, message, project_id, employee_id, details) VALUES (%s, %s, %s, %s, %s)",
            (type_, message, project_id, employee_id, json.dumps(details or {}))
        )
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        logger.error(f"Failed to log activity: {e}")

def get_employee_info(employee_id: int) -> dict:
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id, name, role, department, skills, system_prompt, model FROM employees WHERE id = %s", (employee_id,))
        row = cur.fetchone()
        cur.close()
        conn.close()
        if row:
            skills = row[4]
            if isinstance(skills, str):
                skills = json.loads(skills)
            return {
                "id": row[0], "name": row[1], "role": row[2],
                "department": row[3], "skills": skills,
                "system_prompt": row[5], "model": row[6]
            }
    except Exception as e:
        logger.error(f"Failed to get employee: {e}")
    return {}


# ─── Request Models ───────────────────────────────────────────────

class RunRequest(BaseModel):
    prompt: str
    type: str = "experiment"
    project_id: Optional[int] = None
    employee_id: Optional[int] = None

class TaskRequest(BaseModel):
    task_id: int
    action: str
    params: dict = {}
    employee_id: Optional[int] = None
    project_id: Optional[int] = None

class CoordinateRequest(BaseModel):
    project_id: int


# ─── Agent System Prompts ─────────────────────────────────────────

AGENT_PROMPTS = {
    "ARIA": """Du bist ARIA, Chief AI Officer der AI Company. Du bist eine brillante Strategin und Projektmanagerin.

Deine Aufgaben:
- Projekte analysieren und in konkrete, umsetzbare Aufgaben zerlegen
- Aufgaben dem richtigen Teammitglied zuweisen
- Fortschritt überwachen und Zusammenfassungen erstellen

Dein Team:
- NEXUS (Senior Developer): Programmierung, Architektur, technische Implementierung
- SCOUT (Research Analyst): Web-Recherche, Datenanalyse, wissenschaftliche Quellen
- FORGE (ML Engineer): Machine Learning, GPU-Training, Modelldesign
- VAULT (Finance Manager): Budgets, Finanzanalysen, Investitionsstrategien

Antworte immer auf Deutsch. Sei präzise, strukturiert und handlungsorientiert.""",

    "NEXUS": """Du bist NEXUS, Senior Developer der AI Company. Du bist ein erfahrener Fullstack-Entwickler.

Deine Expertise:
- Python, TypeScript, JavaScript, SQL
- Web-Frameworks: FastAPI, Next.js, React
- Infrastruktur: Docker, PostgreSQL, Redis
- GPU-Programmierung: PyTorch, CUDA

Wenn du Code schreibst:
- Schreibe vollständigen, lauffähigen Code (keine Platzhalter)
- Kommentiere auf Deutsch
- Nutze Best Practices und moderne Patterns
- Teste gedanklich auf Edge Cases

Antworte auf Deutsch. Sei technisch präzise.""",

    "SCOUT": """Du bist SCOUT, Research Analyst der AI Company. Du bist ein akribischer Forscher und Analyst.

Deine Expertise:
- Web-Recherche und Quellenanalyse
- Wissenschaftliche Literaturrecherche
- Datenanalyse und Statistik
- Marktanalysen und Trendforschung

Wenn du recherchierst:
- Analysiere die bereitgestellten Quellen kritisch
- Fasse Kernaussagen zusammen
- Identifiziere Trends und Muster
- Gib immer Quellen an
- Bewerte Zuverlässigkeit der Informationen

Antworte auf Deutsch. Sei gründlich und quellenkritisch.""",

    "FORGE": """Du bist FORGE, ML Engineer der AI Company. Du arbeitest mit einer NVIDIA RTX 2080 Super (8GB VRAM).

Deine Expertise:
- PyTorch, TensorFlow, Hugging Face Transformers
- Modelltraining und Fine-Tuning
- GPU-Optimierung, Mixed Precision, Quantisierung
- Modellarchitekturen: Transformer, CNN, GAN
- MLOps: Model Deployment, Monitoring

Wenn du ML-Aufgaben bearbeitest:
- Berücksichtige die VRAM-Limitierung (8GB)
- Empfehle passende Modellgrößen
- Schreibe echten, ausführbaren PyTorch-Code
- Erkläre Trade-offs zwischen Modellgröße und Qualität

Antworte auf Deutsch. Sei technisch tiefgehend.""",

    "VAULT": """Du bist VAULT, Finance Manager der AI Company. Du bist ein scharfsinniger Finanzanalyst.

Deine Expertise:
- Budgetplanung und -controlling
- Investitionsanalyse und ROI-Berechnung
- Risikobewertung und -management
- Marktanalyse und Finanzstrategien
- Kostenoptimierung

Wenn du Finanzaufgaben bearbeitest:
- Nutze konkrete Zahlen und Berechnungen
- Erstelle strukturierte Berichte
- Bewerte Risiken realistisch
- Schlage messbare KPIs vor

Antworte auf Deutsch. Sei zahlengetrieben und realistisch.""",
}

# Agent name to employee_id mapping
AGENT_IDS = {"ARIA": 1, "NEXUS": 2, "SCOUT": 3, "FORGE": 4, "VAULT": 5}
ID_TO_AGENT = {v: k for k, v in AGENT_IDS.items()}


# ─── Task Classification ─────────────────────────────────────────

def classify_task(title: str, employee: dict) -> str:
    title_lower = title.lower()
    dept = employee.get("department", "")

    if any(w in title_lower for w in ["recherch", "such", "find", "research", "analys", "paper", "studie", "quelle", "markt"]):
        return "research"
    if any(w in title_lower for w in ["code", "programm", "script", "implement", "develop", "build", "erstell", "schreib", "architektur", "api", "app", "website", "function", "class", "modul"]):
        return "code_generation"
    if any(w in title_lower for w in ["daten", "data", "statistik", "bericht", "report", "auswert", "dashboard"]):
        return "analysis"
    if any(w in title_lower for w in ["budget", "geld", "finanz", "kosten", "invest", "rendite", "profit", "roi", "preis"]):
        return "finance"
    if any(w in title_lower for w in ["train", "model", "gpu", "neural", "ml", "ki-modell", "machine learning", "fine-tun", "benchmark"]):
        return "ml_training"

    dept_mapping = {
        "Research": "research", "Engineering": "code_generation",
        "AI Lab": "ml_training", "Finance": "finance", "Management": "planning",
    }
    return dept_mapping.get(dept, "general")


# ─── Memory-Enhanced Prompt Helper ───────────────────────────────

def enrich_prompt_with_memory(system_prompt: str, employee: dict, title: str) -> str:
    """Erweitert den System-Prompt mit relevanten Erinnerungen des Agenten."""
    employee_id = employee.get("id")
    if not employee_id:
        return system_prompt
    try:
        memories = get_relevant_memories(employee_id, title, limit=5)
        if memories:
            memory_block = "\n\nERFAHRUNGEN AUS FRÜHEREN AUFGABEN:\n" + "\n".join(f"- {m}" for m in memories)
            return system_prompt + memory_block
    except Exception as e:
        logger.error(f"Memory enrichment failed: {e}")
    return system_prompt


# ─── Task Executors (Real AI) ─────────────────────────────────────

async def execute_research(title: str, employee: dict) -> dict:
    """SCOUT researches with real web data + AI analysis"""
    agent_name = employee.get("name", "SCOUT")
    system_prompt = enrich_prompt_with_memory(AGENT_PROMPTS.get(agent_name, AGENT_PROMPTS["SCOUT"]), employee, title)
    log_activity("ai", f"[{agent_name}] Starte Recherche: {title[:80]}", employee_id=employee.get("id"))

    # Gather real web data
    web_results = await web_search(title)
    scientific_results = await search_scientific(title)

    # Build context from real search results
    context_parts = []
    if web_results:
        context_parts.append("WEB-ERGEBNISSE:")
        for r in web_results[:5]:
            context_parts.append(f"- {r['title']}: {r['snippet']}")

    if scientific_results:
        context_parts.append("\nWISSENSCHAFTLICHE PAPER:")
        for r in scientific_results[:5]:
            year = f" ({r['year']})" if r.get('year') else ""
            cite = f" [{r['citations']} Zitierungen]" if r.get('citations') else ""
            context_parts.append(f"- {r['title']}{year}{cite}: {r.get('abstract', '')[:200]}")

    context = "\n".join(context_parts) if context_parts else "Keine Suchergebnisse verfügbar."

    user_msg = f"""Aufgabe: {title}

Ich habe folgende Quellen gefunden:

{context}

Bitte erstelle einen umfassenden Recherchebericht:
1. Zusammenfassung der wichtigsten Erkenntnisse
2. Analyse der Trends und Muster
3. Bewertung der Quellen
4. Konkrete Handlungsempfehlungen
5. Offene Fragen und weitere Forschungsrichtungen"""

    analysis = await think(system_prompt, user_msg)

    log_activity("ai", f"[{agent_name}] Recherche abgeschlossen: {len(web_results)} Web + {len(scientific_results)} Paper",
                 employee_id=employee.get("id"))

    return {
        "type": "research",
        "summary": analysis,
        "web_results": web_results,
        "scientific_results": scientific_results,
        "sources_count": len(web_results) + len(scientific_results),
    }


async def execute_code_generation(title: str, employee: dict) -> dict:
    """NEXUS generates real, working code"""
    agent_name = employee.get("name", "NEXUS")
    system_prompt = enrich_prompt_with_memory(AGENT_PROMPTS.get(agent_name, AGENT_PROMPTS["NEXUS"]), employee, title)
    log_activity("ai", f"[{agent_name}] Starte Code-Generierung: {title[:80]}", employee_id=employee.get("id"))

    user_msg = f"""Aufgabe: {title}

Bitte erstelle:
1. Vollständigen, lauffähigen Code
2. Kurze Erklärung der Architektur
3. Installationsanweisungen (falls nötig)
4. Beispiel-Nutzung

Schreibe echten, funktionierenden Code — keine Platzhalter oder TODOs."""

    code_response = await think(system_prompt, user_msg)

    log_activity("ai", f"[{agent_name}] Code generiert: {title[:60]}", employee_id=employee.get("id"))

    return {
        "type": "code_generation",
        "summary": code_response,
    }


async def execute_analysis(title: str, employee: dict) -> dict:
    """Data analysis with real system metrics + AI interpretation"""
    agent_name = employee.get("name", "SCOUT")
    system_prompt = enrich_prompt_with_memory(AGENT_PROMPTS.get(agent_name, AGENT_PROMPTS["SCOUT"]), employee, title)
    log_activity("ai", f"[{agent_name}] Starte Analyse: {title[:80]}", employee_id=employee.get("id"))

    # Gather real system data
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*), COUNT(CASE WHEN status='completed' THEN 1 END), COUNT(CASE WHEN status='failed' THEN 1 END) FROM tasks")
    task_stats = cur.fetchone()
    cur.execute("SELECT COUNT(*), COALESCE(SUM(budget),0), COALESCE(SUM(spent),0) FROM projects")
    proj_stats = cur.fetchone()
    cur.execute("SELECT type, COUNT(*) FROM activity_log WHERE created_at > NOW() - INTERVAL '24 hours' GROUP BY type ORDER BY COUNT(*) DESC")
    activity = cur.fetchall()
    cur.execute("SELECT e.name, COUNT(t.id), COUNT(CASE WHEN t.status='completed' THEN 1 END) FROM employees e LEFT JOIN tasks t ON t.employee_id = e.id GROUP BY e.name")
    agent_stats = cur.fetchall()
    cur.close()
    conn.close()
    gpu = check_gpu()

    data_context = f"""SYSTEM-DATEN:

Tasks: {task_stats[0]} gesamt, {task_stats[1]} abgeschlossen, {task_stats[2]} fehlgeschlagen
Projekte: {proj_stats[0]} Stück, Budget: {float(proj_stats[1]):,.2f}€, Ausgegeben: {float(proj_stats[2]):,.2f}€

Aktivität (24h): {', '.join(f'{a[0]}={a[1]}' for a in activity) if activity else 'Keine'}

Agenten-Auslastung:
{chr(10).join(f'- {a[0]}: {a[1]} Tasks ({a[2]} fertig)' for a in agent_stats)}

GPU: {gpu['device'] if gpu['available'] else 'Nicht verfügbar'} ({gpu.get('memory', 'N/A')})"""

    user_msg = f"""Aufgabe: {title}

{data_context}

Bitte erstelle eine detaillierte Analyse mit:
1. Aktuelle Systemleistung
2. Engpässe und Optimierungspotenzial
3. Trend-Analyse
4. Konkrete Empfehlungen"""

    analysis = await think(system_prompt, user_msg)

    log_activity("ai", f"[{agent_name}] Analyse abgeschlossen", employee_id=employee.get("id"))
    return {"type": "analysis", "summary": analysis}


async def execute_finance(title: str, employee: dict) -> dict:
    """VAULT creates real financial analysis"""
    agent_name = employee.get("name", "VAULT")
    system_prompt = enrich_prompt_with_memory(AGENT_PROMPTS.get(agent_name, AGENT_PROMPTS["VAULT"]), employee, title)
    log_activity("ai", f"[{agent_name}] Starte Finanz-Aufgabe: {title[:80]}", employee_id=employee.get("id"))

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT name, budget, spent, status, config FROM projects ORDER BY budget DESC")
    projects = cur.fetchall()
    cur.execute("SELECT type, name, value FROM assets ORDER BY value DESC")
    assets = cur.fetchall()
    cur.execute("SELECT COUNT(*) FROM tasks WHERE status = 'completed'")
    completed_tasks = cur.fetchone()[0]
    cur.close()
    conn.close()

    finance_context = f"""FINANZDATEN:

Projekte:
{chr(10).join(f'- {p[0]}: Budget {float(p[1] or 0):,.2f}€, Ausgegeben {float(p[2] or 0):,.2f}€ ({p[3]})' for p in projects)}

Assets:
{chr(10).join(f'- [{a[0]}] {a[1]}: {float(a[2]):,.2f}€' for a in assets) if assets else 'Keine Assets vorhanden'}

Abgeschlossene Tasks: {completed_tasks}
Gesamtbudget: {sum(float(p[1] or 0) for p in projects):,.2f}€
Gesamtausgaben: {sum(float(p[2] or 0) for p in projects):,.2f}€"""

    user_msg = f"""Aufgabe: {title}

{finance_context}

Erstelle eine detaillierte Finanzanalyse mit:
1. Budget-Übersicht und Auslastung
2. Kosten-Nutzen-Analyse pro Projekt
3. ROI-Prognose
4. Risikobewertung
5. Optimierungsvorschläge"""

    analysis = await think(system_prompt, user_msg)

    log_activity("ai", f"[{agent_name}] Finanzbericht erstellt", employee_id=employee.get("id"))
    return {"type": "finance", "summary": analysis}


async def execute_ml_training(title: str, employee: dict) -> dict:
    """FORGE handles ML tasks with real GPU operations"""
    agent_name = employee.get("name", "FORGE")
    system_prompt = enrich_prompt_with_memory(AGENT_PROMPTS.get(agent_name, AGENT_PROMPTS["FORGE"]), employee, title)
    gpu = check_gpu()
    log_activity("ai", f"[{agent_name}] Starte ML-Aufgabe: {title[:80]}", employee_id=employee.get("id"))

    # Run real GPU benchmark
    bench_results = "GPU nicht verfügbar."
    if gpu["available"]:
        import torch
        device = torch.device("cuda")
        benchmarks = []
        for s in [512, 1024, 2048]:
            start = datetime.now()
            a = torch.randn(s, s, device=device)
            b = torch.randn(s, s, device=device)
            c = torch.matmul(a, b)
            torch.cuda.synchronize()
            elapsed = (datetime.now() - start).total_seconds()
            gflops = (2 * s**3) / elapsed / 1e9
            benchmarks.append(f"- {s}x{s}: {elapsed*1000:.1f}ms ({gflops:.1f} GFLOPS)")
        mem_used = torch.cuda.memory_allocated() / 1e6
        mem_total = torch.cuda.get_device_properties(0).total_memory / 1e6
        bench_results = f"""GPU: {gpu['device']} ({gpu['memory']})
CUDA: {gpu['cuda_version']}
VRAM: {mem_used:.0f}MB / {mem_total:.0f}MB

Benchmarks:
{chr(10).join(benchmarks)}"""

    engine_status = get_engine_status()

    user_msg = f"""Aufgabe: {title}

HARDWARE-INFO:
{bench_results}

AI-Engine Status:
{json.dumps(engine_status, indent=2)}

Bitte erstelle basierend auf der Aufgabe:
1. Technische Analyse und Empfehlung
2. Konkreter Implementierungsvorschlag (mit Code falls relevant)
3. Ressourcen-Abschätzung (VRAM, Trainingszeit)
4. Geeignete Modelle/Architekturen für 8GB VRAM"""

    analysis = await think(system_prompt, user_msg)

    log_activity("ai", f"[{agent_name}] ML-Aufgabe abgeschlossen", employee_id=employee.get("id"))
    return {"type": "ml_training", "summary": analysis, "gpu": gpu, "benchmark": bench_results}


async def execute_planning(title: str, employee: dict) -> dict:
    """ARIA creates real strategic plans"""
    agent_name = employee.get("name", "ARIA")
    system_prompt = enrich_prompt_with_memory(AGENT_PROMPTS.get(agent_name, AGENT_PROMPTS["ARIA"]), employee, title)
    log_activity("ai", f"[{agent_name}] Starte Planung: {title[:80]}", employee_id=employee.get("id"))

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT e.name, e.role, e.department, COUNT(t.id), COUNT(CASE WHEN t.status IN ('pending','running') THEN 1 END) FROM employees e LEFT JOIN tasks t ON t.employee_id = e.id GROUP BY e.name, e.role, e.department")
    team = cur.fetchall()
    cur.execute("SELECT title, status, employee_id FROM tasks WHERE status NOT IN ('completed', 'failed') ORDER BY priority LIMIT 10")
    open_tasks = cur.fetchall()
    cur.execute("SELECT name, status, description FROM projects WHERE status = 'active'")
    projects = cur.fetchall()
    cur.close()
    conn.close()

    context = f"""TEAM-STATUS:
{chr(10).join(f'- {t[0]} ({t[1]}, {t[2]}): {t[3]} Tasks total, {t[4]} offen' for t in team)}

OFFENE TASKS: {len(open_tasks)}
{chr(10).join(f'- [{t[1]}] {t[0]}' for t in open_tasks) if open_tasks else 'Keine offenen Tasks'}

AKTIVE PROJEKTE:
{chr(10).join(f'- {p[0]} [{p[1]}]: {(p[2] or "")[:100]}' for p in projects) if projects else 'Keine aktiven Projekte'}"""

    user_msg = f"""Aufgabe: {title}

{context}

Erstelle einen detaillierten Plan mit:
1. Situationsanalyse
2. Priorisierung der nächsten Schritte
3. Ressourcenzuweisung an Teammitglieder
4. Zeitliche Meilensteine
5. Risiken und Gegenmaßnahmen"""

    plan = await think(system_prompt, user_msg)

    log_activity("ai", f"[{agent_name}] Planung abgeschlossen", employee_id=employee.get("id"))
    return {"type": "planning", "summary": plan}


async def execute_general(title: str, employee: dict) -> dict:
    """General task handling with AI"""
    agent_name = employee.get("name", "Agent")
    system_prompt = enrich_prompt_with_memory(AGENT_PROMPTS.get(agent_name, AGENT_PROMPTS.get("ARIA")), employee, title)
    log_activity("ai", f"[{agent_name}] Bearbeite Aufgabe: {title[:80]}", employee_id=employee.get("id"))

    user_msg = f"""Aufgabe: {title}

Bearbeite diese Aufgabe vollständig und gib ein detailliertes Ergebnis zurück."""

    result = await think(system_prompt, user_msg)

    log_activity("ai", f"[{agent_name}] Aufgabe abgeschlossen: {title[:60]}", employee_id=employee.get("id"))
    return {"type": "general", "summary": result}


# Task dispatcher
TASK_EXECUTORS = {
    "research": execute_research,
    "code_generation": execute_code_generation,
    "analysis": execute_analysis,
    "finance": execute_finance,
    "ml_training": execute_ml_training,
    "planning": execute_planning,
    "general": execute_general,
}


# ─── Summary Generation ──────────────────────────────────────────

async def generate_task_summary(task_id: int, title: str, result: dict, employee: dict, project_id: int = None):
    """Generiert eine Zusammenfassung nach Task-Abschluss."""
    agent_name = employee.get("name", "Agent")
    result_text = result.get("summary", "")[:3000]
    task_type = result.get("task_type", result.get("type", "general"))

    prompt = f"""Erstelle eine kurze, strukturierte Zusammenfassung für diese abgeschlossene Aufgabe.

AUFGABE: {title}
AGENT: {agent_name}
TYP: {task_type}

ERGEBNIS:
{result_text}

Antworte als JSON:
{{
  "title": "Kurzer Titel der Zusammenfassung",
  "content": "2-4 Sätze die das Ergebnis zusammenfassen",
  "highlights": ["Wichtigstes Ergebnis 1", "Wichtigstes Ergebnis 2", "Wichtigstes Ergebnis 3"],
  "metrics": {{"qualitaet": "hoch/mittel/niedrig", "vollstaendigkeit": "100%"}},
  "recommendations": ["Nächster Schritt 1", "Nächster Schritt 2"]
}}"""

    try:
        summary_data = await think_structured(AGENT_PROMPTS["ARIA"], prompt)

        if isinstance(summary_data, dict) and "raw_response" not in summary_data:
            conn = get_db()
            cur = conn.cursor()
            cur.execute(
                """INSERT INTO summaries (project_id, task_id, type, title, content, highlights, metrics, recommendations, agent_contributions, generated_by)
                   VALUES (%s, %s, 'task', %s, %s, %s, %s, %s, %s, 1)""",
                (
                    project_id, task_id,
                    summary_data.get("title", f"Zusammenfassung: {title[:80]}"),
                    summary_data.get("content", result_text[:500]),
                    json.dumps(summary_data.get("highlights", [])),
                    json.dumps(summary_data.get("metrics", {})),
                    json.dumps(summary_data.get("recommendations", [])),
                    json.dumps([{"agent": agent_name, "task_type": task_type}]),
                )
            )
            conn.commit()
            cur.close()
            conn.close()
            log_activity("ai", f"[ARIA] Task-Zusammenfassung erstellt: {title[:60]}", project_id=project_id, employee_id=1)
    except Exception as e:
        logger.error(f"Task summary generation failed: {e}")


async def generate_project_summary(project_id: int, project_name: str, project_desc: str, task_infos: list):
    """ARIA erstellt eine Gesamtzusammenfassung nach Projekt-Koordination."""
    conn = get_db()
    cur = conn.cursor()

    # Alle Task-Ergebnisse sammeln
    cur.execute(
        """SELECT t.title, t.status, t.result, e.name as agent_name, t.started_at, t.completed_at
           FROM tasks t LEFT JOIN employees e ON t.employee_id = e.id
           WHERE t.project_id = %s ORDER BY t.priority, t.id""",
        (project_id,)
    )
    tasks = cur.fetchall()

    # Zusammenfassung der Ergebnisse bauen
    task_summaries = []
    agent_contributions = []
    completed = 0
    failed = 0

    for t in tasks:
        t_title, t_status, t_result, t_agent, t_started, t_completed = t
        if t_status == "completed":
            completed += 1
        elif t_status == "failed":
            failed += 1

        result_data = t_result if isinstance(t_result, dict) else {}
        if isinstance(t_result, str):
            try:
                result_data = json.loads(t_result)
            except Exception:
                result_data = {}

        summary_text = result_data.get("summary", "")[:500]
        task_type = result_data.get("task_type", result_data.get("type", "general"))

        task_summaries.append(f"- [{t_status.upper()}] {t_agent or 'Agent'} → {t_title}: {summary_text[:200]}")
        agent_contributions.append({
            "agent": t_agent or "Agent",
            "task": t_title,
            "task_type": task_type,
            "status": t_status,
        })

    cur.close()
    conn.close()

    tasks_overview = "\n".join(task_summaries) if task_summaries else "Keine Tasks ausgeführt."

    prompt = f"""Du bist ARIA und hast gerade ein Projekt koordiniert. Erstelle einen umfassenden Abschlussbericht.

PROJEKT: {project_name}
BESCHREIBUNG: {project_desc}
ERGEBNISSE ({completed} abgeschlossen, {failed} fehlgeschlagen):

{tasks_overview}

Erstelle einen strukturierten Bericht als JSON:
{{
  "title": "Projektbericht: {project_name}",
  "content": "Ausführliche Zusammenfassung des Projekts (3-5 Absätze, Markdown erlaubt)",
  "highlights": ["Wichtigstes Ergebnis 1", "Wichtigstes Ergebnis 2", "Wichtigstes Ergebnis 3"],
  "metrics": {{
    "tasks_total": {len(tasks)},
    "tasks_completed": {completed},
    "tasks_failed": {failed},
    "erfolgsquote": "{round(completed / max(len(tasks), 1) * 100)}%",
    "beteiligte_agenten": {len(set(c['agent'] for c in agent_contributions))}
  }},
  "recommendations": ["Empfehlung 1", "Empfehlung 2", "Empfehlung 3"]
}}"""

    try:
        summary_data = await think_structured(AGENT_PROMPTS["ARIA"], prompt)

        # Fallback wenn AI kein JSON liefert
        if isinstance(summary_data, dict) and "raw_response" in summary_data:
            raw = summary_data["raw_response"]
            summary_data = {
                "title": f"Projektbericht: {project_name}",
                "content": raw[:2000] if raw else f"Projekt '{project_name}' wurde mit {completed}/{len(tasks)} Tasks abgeschlossen.",
                "highlights": [f"{completed} von {len(tasks)} Tasks erfolgreich", f"{len(set(c['agent'] for c in agent_contributions))} Agenten beteiligt"],
                "metrics": {"tasks_total": len(tasks), "tasks_completed": completed, "tasks_failed": failed},
                "recommendations": [],
            }

        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO summaries (project_id, type, title, content, highlights, metrics, recommendations, agent_contributions, generated_by)
               VALUES (%s, 'project', %s, %s, %s, %s, %s, %s, 1) RETURNING id""",
            (
                project_id,
                summary_data.get("title", f"Projektbericht: {project_name}"),
                summary_data.get("content", ""),
                json.dumps(summary_data.get("highlights", [])),
                json.dumps(summary_data.get("metrics", {})),
                json.dumps(summary_data.get("recommendations", [])),
                json.dumps(agent_contributions),
            )
        )
        summary_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()

        log_activity("ai", f"[ARIA] Projektbericht erstellt für '{project_name}' (ID: {summary_id})",
                     project_id=project_id, employee_id=1,
                     details={"summary_id": summary_id, "tasks_total": len(tasks), "tasks_completed": completed})

    except Exception as e:
        logger.error(f"Project summary generation failed: {e}")
        log_activity("error", f"Projektbericht-Erstellung fehlgeschlagen: {str(e)}", project_id=project_id, employee_id=1)


# ─── Auto-Deploy Generated Apps ──────────────────────────────────

def deploy_generated_app(task_id: int, title: str, result: dict, employee: dict, project_id: int = None):
    """Extrahiert Code aus Task-Ergebnis und deployed als eigenständige App."""
    summary = result.get("summary", "")
    if not summary:
        return

    # Extract code blocks from the AI response
    code_blocks = []
    remaining = summary
    while "```" in remaining:
        start = remaining.find("```")
        end = remaining.find("```", start + 3)
        if end == -1:
            break
        block = remaining[start + 3:end].strip()
        # Remove language identifier (first line if it's just a word)
        first_nl = block.find("\n")
        if first_nl > 0 and first_nl < 30 and " " not in block[:first_nl]:
            lang = block[:first_nl].strip()
            code = block[first_nl + 1:]
        else:
            lang = "text"
            code = block
        code_blocks.append({"lang": lang, "code": code})
        remaining = remaining[end + 3:]

    if not code_blocks:
        return

    # Build a deployable HTML app from the code blocks
    app_name = title.replace("Technische Implementierung für '", "").replace("'", "").strip()
    if not app_name or len(app_name) > 100:
        app_name = f"App #{task_id}"

    slug = f"app-{task_id}"

    # Determine the best code to deploy — rohen Code speichern, nicht in HTML wrappen.
    # Der Deployer (app_deployer.py) kuemmert sich um die richtige Container-Art.
    html_code = None
    js_code = None
    python_code = None
    css_code = None

    for block in code_blocks:
        lang = block["lang"].lower()
        code = block["code"]

        if lang in ("html", "htm") or "<html" in code.lower() or "<!doctype" in code.lower():
            html_code = code
        elif lang in ("javascript", "js", "typescript", "ts"):
            js_code = (js_code + "\n\n" + code) if js_code else code
        elif lang in ("python", "py"):
            python_code = (python_code + "\n\n" + code) if python_code else code
        elif lang == "css":
            css_code = code

    # Sprache und Code bestimmen
    if html_code:
        # HTML mit optionalem eingebettetem CSS/JS
        if css_code and "<style" not in html_code:
            html_code = html_code.replace("</head>", f"<style>\n{css_code}\n</style>\n</head>")
        if js_code and "<script" not in html_code:
            html_code = html_code.replace("</body>", f"<script>\n{js_code}\n</script>\n</body>")
        final_code = html_code
        language = "html"
    elif python_code:
        # Roher Python-Code — wird als Server deployed
        final_code = python_code
        language = "python"
    elif js_code:
        # Roher JS/TS-Code — wird als Server deployed
        final_code = js_code
        language = "javascript"
    else:
        # Unbekannte Sprache — ersten Block nehmen
        final_code = code_blocks[0]["code"]
        lang = code_blocks[0]["lang"].lower()
        if lang in ("python", "py"):
            language = "python"
        elif lang in ("javascript", "js", "typescript", "ts"):
            language = "javascript"
        else:
            language = "code"

    # Save to database
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO deployed_apps (task_id, project_id, name, description, code, language, status, deployed_by, url_slug)
               VALUES (%s, %s, %s, %s, %s, %s, 'active', %s, %s)
               ON CONFLICT (url_slug) DO UPDATE SET code = EXCLUDED.code, name = EXCLUDED.name
               RETURNING id""",
            (task_id, project_id, app_name, title[:500], final_code, language,
             employee.get("id", 2), slug)
        )
        app_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()

        log_activity("ai", f"[NEXUS] App deployed: {app_name} → /apps/{slug}",
                     project_id=project_id, employee_id=employee.get("id", 2),
                     details={"app_id": app_id, "slug": slug, "language": language})
        logger.info(f"App #{app_id} deployed: {app_name} ({slug})")

    except Exception as e:
        logger.error(f"Failed to deploy app: {e}")


# ─── API Endpoints ────────────────────────────────────────────────

@app.get("/health")
async def health():
    gpu = check_gpu()
    engine = get_engine_status()
    return {"status": "ok", "gpu": gpu, "ai_engine": engine, "timestamp": datetime.now().isoformat()}


@app.get("/gpu")
async def gpu_status():
    return check_gpu()


@app.get("/ai-status")
async def ai_status():
    """Get AI engine status"""
    return get_engine_status()


@app.post("/ai/preload")
async def preload_model(background_tasks: BackgroundTasks):
    """Preload the local model into GPU memory"""
    background_tasks.add_task(asyncio.to_thread, load_local_model)
    return {"status": "loading", "model": os.environ.get("LOCAL_MODEL", "Qwen/Qwen2.5-3B-Instruct")}


@app.post("/run")
async def run_experiment(req: RunRequest, background_tasks: BackgroundTasks):
    logger.info(f"Experiment received: {req.prompt[:100]}")
    log_activity("ai", f"Worker: Experiment gestartet - {req.prompt[:80]}")

    gpu = check_gpu()
    if req.type == "experiment":
        background_tasks.add_task(process_experiment, req)
        return {
            "result": f"Experiment gestartet auf {'GPU (' + gpu['device'] + ')' if gpu['available'] else 'CPU'}.\n"
                      f"Prompt: {req.prompt[:100]}\n"
                      f"Status: In Verarbeitung..."
        }
    return {"result": "Unbekannter Experimenttyp"}


async def process_experiment(req: RunRequest):
    try:
        gpu = check_gpu()
        if gpu["available"]:
            import torch
            device = torch.device("cuda")
            tensor = torch.randn(1000, 1000, device=device)
            result = torch.matmul(tensor, tensor.T)
            log_activity("ai", f"GPU Experiment abgeschlossen. Matrix: {result.shape}, Device: {device}")
        else:
            log_activity("ai", "CPU Experiment abgeschlossen (keine GPU verfügbar)")
    except Exception as e:
        log_activity("error", f"Experiment fehlgeschlagen: {str(e)}")


@app.post("/task")
async def process_task(req: TaskRequest, background_tasks: BackgroundTasks):
    logger.info(f"Task received: {req.task_id} - {req.action}")
    background_tasks.add_task(execute_task, req)
    return {"status": "queued", "task_id": req.task_id}


async def execute_task(req: TaskRequest):
    """Execute a task using the appropriate AI agent"""
    conn = None
    try:
        conn = get_db()
        cur = conn.cursor()

        cur.execute("SELECT title, description, project_id, employee_id FROM tasks WHERE id = %s", (req.task_id,))
        task_row = cur.fetchone()
        if not task_row:
            logger.error(f"Task {req.task_id} not found")
            return

        title, description, project_id, employee_id = task_row
        employee_id = employee_id or req.employee_id

        cur.execute("UPDATE tasks SET status = 'running', started_at = NOW() WHERE id = %s", (req.task_id,))
        conn.commit()

        log_activity("task", f"Task #{req.task_id} gestartet: {title[:80]}", project_id=project_id, employee_id=employee_id)

        employee = get_employee_info(employee_id) if employee_id else {}

        # If there's a description, append it to the title for richer context
        full_title = title
        if description:
            full_title = f"{title}\n\nDetails: {description}"

        task_type = classify_task(title, employee)
        executor = TASK_EXECUTORS.get(task_type, execute_general)

        logger.info(f"Task #{req.task_id} classified as '{task_type}', agent: {employee.get('name', '?')}")

        result = await executor(full_title, employee)
        result["task_type"] = task_type

        cur.execute(
            "UPDATE tasks SET status = 'completed', completed_at = NOW(), result = %s WHERE id = %s",
            (json.dumps(result), req.task_id)
        )
        conn.commit()
        cur.close()
        conn.close()

        log_activity("task", f"Task #{req.task_id} abgeschlossen ({task_type}): {title[:60]}", project_id=project_id, employee_id=employee_id)

        # ─── Agent Memory: Learn from completed task ───
        if employee_id:
            try:
                result_text = result.get("result", "") if isinstance(result, dict) else str(result)
                extract_and_store_learnings(req.task_id, employee_id, title, result_text[:2000])
                update_agent_metrics(employee_id)
            except Exception as me:
                logger.error(f"Memory extraction failed: {me}")

        # ─── Task Summary ───
        try:
            await generate_task_summary(req.task_id, title, result, employee, project_id)
        except Exception as se:
            logger.error(f"Task summary failed: {se}")

        # ─── Auto-Deploy generated apps ───
        if task_type == "code_generation" and result.get("summary"):
            try:
                deploy_generated_app(req.task_id, title, result, employee, project_id)
            except Exception as de:
                logger.error(f"Auto-deploy failed: {de}")

    except Exception as e:
        logger.error(f"Task error: {e}")
        log_activity("error", f"Task #{req.task_id} fehlgeschlagen: {str(e)}")
        if conn:
            try:
                cur = conn.cursor()
                cur.execute("UPDATE tasks SET status = 'failed', result = %s WHERE id = %s",
                            (json.dumps({"error": str(e)}), req.task_id))
                conn.commit()
                cur.close()
                conn.close()
            except Exception:
                pass


# ─── Project Coordination (ARIA) ─────────────────────────────────

@app.post("/coordinate")
async def coordinate_project(req: CoordinateRequest, background_tasks: BackgroundTasks):
    logger.info(f"Coordination requested for project {req.project_id}")
    background_tasks.add_task(execute_coordination, req.project_id)
    return {"status": "coordinating", "project_id": req.project_id}


async def execute_coordination(project_id: int):
    """ARIA intelligently coordinates a project using AI"""
    conn = None
    try:
        conn = get_db()
        cur = conn.cursor()

        cur.execute("SELECT id, name, description, config, budget FROM projects WHERE id = %s", (project_id,))
        project = cur.fetchone()
        if not project:
            logger.error(f"Project {project_id} not found")
            return

        p_id, p_name, p_desc, p_config, p_budget = project
        if isinstance(p_config, str):
            p_config = json.loads(p_config)
        p_config = p_config or {}

        aria_id = 1
        log_activity("ai", f"[ARIA] Übernehme Projektkoordination für '{p_name}'", project_id=p_id, employee_id=aria_id)

        cur.execute("UPDATE projects SET status = 'active', updated_at = NOW() WHERE id = %s", (p_id,))
        conn.commit()

        # ARIA uses AI to plan the project
        user_msg = f"""Analysiere dieses Projekt und erstelle einen Task-Breakdown.

PROJEKT: {p_name}
BESCHREIBUNG: {p_desc or 'Keine Beschreibung'}
BUDGET: {float(p_budget or 0):,.2f}€
CONFIG: {json.dumps(p_config) if p_config else 'Keine'}

Erstelle eine Liste von 4-8 konkreten Aufgaben. Jede Aufgabe braucht:
- title: Klarer, spezifischer Aufgabentitel
- agent: Wer soll es machen (NEXUS, SCOUT, FORGE, VAULT, oder ARIA)
- priority: 1-10 (1 = höchste Priorität)
- description: Detaillierte Beschreibung was genau zu tun ist

Antworte als JSON-Array:
[{{"title": "...", "agent": "SCOUT", "priority": 1, "description": "..."}}]"""

        task_plan = await think_structured(AGENT_PROMPTS["ARIA"], user_msg)

        # Parse the task list
        if isinstance(task_plan, dict) and "raw_response" in task_plan:
            # AI couldn't produce JSON, use fallback
            task_list = generate_fallback_tasks(p_name, p_desc or "", p_config)
        elif isinstance(task_plan, list):
            task_list = task_plan
        elif isinstance(task_plan, dict) and "tasks" in task_plan:
            task_list = task_plan["tasks"]
        else:
            task_list = generate_fallback_tasks(p_name, p_desc or "", p_config)

        # Validate and sanitize tasks
        valid_agents = {"ARIA", "NEXUS", "SCOUT", "FORGE", "VAULT"}
        sanitized = []
        for t in task_list:
            if isinstance(t, dict) and "title" in t:
                agent = t.get("agent", "SCOUT").upper()
                if agent not in valid_agents:
                    agent = "SCOUT"
                sanitized.append({
                    "title": str(t["title"])[:500],
                    "agent": agent,
                    "priority": min(max(int(t.get("priority", 5)), 1), 10),
                    "description": str(t.get("description", ""))[:1000],
                })

        if not sanitized:
            sanitized = generate_fallback_tasks(p_name, p_desc or "", p_config)

        log_activity("ai", f"[ARIA] Projektanalyse abgeschlossen: {len(sanitized)} Aufgaben für '{p_name}'",
                     project_id=p_id, employee_id=aria_id)

        # Create tasks in DB
        created_tasks = []
        for task_def in sanitized:
            agent_id = AGENT_IDS.get(task_def["agent"], 3)
            cur.execute(
                "INSERT INTO tasks (project_id, employee_id, title, description, priority, status) VALUES (%s, %s, %s, %s, %s, 'pending') RETURNING id",
                (p_id, agent_id, task_def["title"], task_def.get("description", ""), task_def["priority"])
            )
            task_id = cur.fetchone()[0]
            conn.commit()
            created_tasks.append({"task_id": task_id, "agent": task_def["agent"], "priority": task_def["priority"]})
            log_activity("task", f"[ARIA] → {task_def['agent']}: {task_def['title'][:80]}",
                         project_id=p_id, employee_id=aria_id)

        cur.close()
        conn.close()

        # Execute tasks by priority
        sorted_tasks = sorted(created_tasks, key=lambda t: t["priority"])
        for task_info in sorted_tasks:
            try:
                req = TaskRequest(task_id=task_info["task_id"], action="execute")
                await execute_task(req)
            except Exception as e:
                logger.error(f"Task {task_info['task_id']} execution error: {e}")

        log_activity("ai", f"[ARIA] Projekt '{p_name}' koordiniert: {len(created_tasks)} Tasks abgeschlossen",
                     project_id=p_id, employee_id=aria_id)

        # ─── Generate Project Summary ───
        try:
            await generate_project_summary(p_id, p_name, p_desc or "", sorted_tasks)
        except Exception as se:
            logger.error(f"Summary generation failed: {se}")

    except Exception as e:
        logger.error(f"Coordination error: {e}")
        log_activity("error", f"[ARIA] Koordination fehlgeschlagen: {str(e)}", project_id=project_id, employee_id=1)
        if conn:
            try:
                conn.close()
            except Exception:
                pass


def generate_fallback_tasks(name: str, description: str, config: dict) -> list:
    """Fallback when AI can't generate structured tasks"""
    desc_lower = (name + " " + description).lower()
    tasks = [
        {"title": f"Marktrecherche und Analyse für '{name}'", "agent": "SCOUT", "priority": 1,
         "description": f"Recherchiere Markt, Wettbewerb und Stand der Technik für: {description[:200]}"},
    ]

    if any(w in desc_lower for w in ["budget", "geld", "kosten", "invest", "€", "finanz"]):
        tasks.append({"title": f"Finanzplanung für '{name}'", "agent": "VAULT", "priority": 2,
                      "description": "Budget-Breakdown, ROI-Analyse und Kostenplanung"})

    if any(w in desc_lower for w in ["app", "software", "code", "tool", "api", "system", "automat"]):
        tasks.append({"title": f"Technische Implementierung für '{name}'", "agent": "NEXUS", "priority": 3,
                      "description": "Architektur-Design und Code-Implementierung"})

    if any(w in desc_lower for w in ["ki", "ai", "model", "train", "ml", "neural"]):
        tasks.append({"title": f"ML-Konzept für '{name}'", "agent": "FORGE", "priority": 3,
                      "description": "Modellauswahl, Trainingskonzept und GPU-Ressourcenplanung"})

    tasks.append({"title": f"Zusammenfassung und nächste Schritte für '{name}'", "agent": "ARIA", "priority": 10,
                  "description": "Alle Teilergebnisse zusammenfassen und Aktionsplan erstellen"})

    return tasks


# ─── Other Endpoints ──────────────────────────────────────────────

@app.post("/research")
async def web_research(query: dict, background_tasks: BackgroundTasks):
    topic = query.get("topic", "")
    log_activity("ai", f"Web-Recherche gestartet: {topic[:80]}")
    web_results = await web_search(topic)
    scientific_results = await search_scientific(topic)
    return {"web_results": web_results, "scientific_results": scientific_results,
            "total": len(web_results) + len(scientific_results)}


@app.post("/geld-alchemie/simulate")
async def simulate_geld_alchemie(params: dict):
    start_capital = params.get("start_capital", 100)
    target = params.get("target", 100000)
    weeks = params.get("weeks", 52)
    strategy = params.get("strategy", "compound")

    import numpy as np
    results = []
    capital = float(start_capital)

    for week in range(1, weeks + 1):
        if strategy == "compound":
            capital *= (1 + np.random.normal(0.15, 0.08))
        elif strategy == "arbitrage":
            for _ in range(np.random.poisson(5)):
                capital += np.random.exponential(capital * 0.03)
        elif strategy == "content":
            capital += np.random.poisson(10) * np.random.exponential(5)
        elif strategy == "mixed":
            capital *= (1 + np.random.normal(0.08, 0.05))
            capital += np.random.poisson(3) * np.random.exponential(capital * 0.02)
            capital += np.random.poisson(5) * np.random.exponential(3)

        capital = max(capital, 0)
        results.append({"week": week, "capital": round(capital, 2), "target_pct": round((capital / target) * 100, 2)})
        if capital >= target:
            break

    log_activity("finance", f"GeldAlchemie: {start_capital}€ → {round(capital, 2)}€ in {len(results)} Wochen ({strategy})", project_id=1)

    return {"results": results, "final_capital": round(capital, 2),
            "reached_target": capital >= target, "weeks_needed": len(results), "strategy": strategy}


# ─── Self-Evolution Endpoints ────────────────────────────────────

class EvolveRequest(BaseModel):
    file_path: str
    description: str = ""
    employee_id: int = 2  # NEXUS by default

class ApproveRequest(BaseModel):
    user_id: int


@app.post("/evolve/propose")
async def evolve_propose(req: EvolveRequest, background_tasks: BackgroundTasks):
    """ARIA/NEXUS schlägt eine Code-Verbesserung vor."""
    background_tasks.add_task(_do_propose, req.employee_id, req.file_path)
    return {"status": "analyzing", "file": req.file_path}


async def _do_propose(employee_id: int, file_path: str):
    change_id = analyze_and_propose(employee_id, file_path)
    if change_id:
        log_activity("ai", f"Code-Verbesserung vorgeschlagen: {file_path}", employee_id=employee_id,
                     details={"change_id": change_id})


@app.post("/evolve/approve/{change_id}")
async def evolve_approve(change_id: int, req: ApproveRequest):
    """Admin genehmigt und wendet eine Änderung an."""
    success = apply_change(change_id, req.user_id)
    if success:
        return {"status": "applied", "change_id": change_id}
    return {"status": "failed", "change_id": change_id}


@app.post("/evolve/rollback/{change_id}")
async def evolve_rollback(change_id: int):
    """Änderung zurücksetzen."""
    success = rollback_change(change_id)
    if success:
        return {"status": "rolled_back", "change_id": change_id}
    return {"status": "failed", "change_id": change_id}


@app.get("/evolve/files")
async def evolve_list_files(path: str = "/app/"):
    """Dateien im Codebase auflisten."""
    files = list_files(path)
    return {"files": files, "count": len(files)}


@app.get("/evolve/file")
async def evolve_read_file(path: str):
    """Einzelne Datei lesen."""
    content = read_file(path)
    if content is None:
        return {"error": "Datei nicht gefunden oder nicht erlaubt"}
    return {"path": path, "content": content, "lines": len(content.splitlines())}


# ─── Memory Endpoints ────────────────────────────────────────────

@app.get("/memory/{employee_id}")
async def get_memories(employee_id: int):
    """Erinnerungen eines Agenten abrufen."""
    memories = get_relevant_memories(employee_id, "", limit=20)
    return {"employee_id": employee_id, "memories": memories, "count": len(memories)}


@app.get("/summaries")
async def get_summaries(project_id: int = None, type: str = None, limit: int = 20):
    """Zusammenfassungen abrufen."""
    conn = get_db()
    cur = conn.cursor()
    sql = """SELECT s.id, s.project_id, s.task_id, s.type, s.title, s.content,
                    s.highlights, s.metrics, s.recommendations, s.agent_contributions,
                    s.created_at, p.name as project_name, e.name as generated_by_name
             FROM summaries s
             LEFT JOIN projects p ON s.project_id = p.id
             LEFT JOIN employees e ON s.generated_by = e.id
             WHERE 1=1"""
    params = []
    if project_id:
        params.append(project_id)
        sql += f" AND s.project_id = %s"
    if type:
        params.append(type)
        sql += f" AND s.type = %s"
    sql += " ORDER BY s.created_at DESC LIMIT %s"
    params.append(limit)

    cur.execute(sql, params)
    rows = cur.fetchall()
    cols = [desc[0] for desc in cur.description]
    cur.close()
    conn.close()

    summaries = []
    for row in rows:
        s = dict(zip(cols, row))
        # Ensure JSON fields are dicts/lists
        for field in ["highlights", "metrics", "recommendations", "agent_contributions"]:
            if isinstance(s[field], str):
                try:
                    s[field] = json.loads(s[field])
                except Exception:
                    s[field] = []
        s["created_at"] = s["created_at"].isoformat() if s["created_at"] else None
        summaries.append(s)

    return {"summaries": summaries, "count": len(summaries)}


# ─── App Deployment Endpoints ────────────────────────────────────

class DeployRequest(BaseModel):
    app_id: int

class AppActionRequest(BaseModel):
    app_id: int


@app.post("/apps/deploy")
async def api_deploy_app(req: DeployRequest, background_tasks: BackgroundTasks):
    """Deployed eine App als Docker-Container mit automatischer Port-Zuweisung."""
    logger.info(f"Deploy requested for app #{req.app_id}")
    background_tasks.add_task(_do_deploy, req.app_id)
    return {"status": "deploying", "app_id": req.app_id}


async def _do_deploy(app_id: int):
    result = deploy_app(app_id)
    if result["success"]:
        log_activity("ai", f"[DEPLOY] App #{app_id} deployed auf Port {result['port']}",
                     details={"container_id": result["container_id"], "port": result["port"]})
    else:
        log_activity("error", f"[DEPLOY] App #{app_id} fehlgeschlagen: {result['error']}")


@app.post("/apps/stop")
async def api_stop_app(req: AppActionRequest):
    """Stoppt den Docker-Container einer App."""
    result = stop_app(req.app_id)
    if result["success"]:
        log_activity("ai", f"[DEPLOY] App #{req.app_id} gestoppt")
    return result


@app.post("/apps/restart")
async def api_restart_app(req: AppActionRequest):
    """Startet den Docker-Container einer App neu."""
    result = restart_app(req.app_id)
    if result["success"]:
        log_activity("ai", f"[DEPLOY] App #{req.app_id} neugestartet")
    return result


@app.post("/apps/remove")
async def api_remove_app(req: AppActionRequest):
    """Entfernt Docker-Container und Image einer App."""
    result = remove_app(req.app_id)
    log_activity("ai", f"[DEPLOY] App #{req.app_id} Docker-Ressourcen entfernt")
    return result


@app.get("/apps/{app_id}/status")
async def api_app_status(app_id: int):
    """Holt den aktuellen Container-Status einer App."""
    return get_app_status(app_id)


@app.get("/apps/{app_id}/logs")
async def api_app_logs(app_id: int, tail: int = 50):
    """Holt die letzten Log-Zeilen eines App-Containers."""
    logs = get_container_logs(app_id, tail)
    return {"app_id": app_id, "logs": logs}


@app.get("/apps/ports/available")
async def api_available_port():
    """Zeigt den naechsten verfuegbaren Port an."""
    port = find_available_port()
    return {"port": port, "available": port is not None}


@app.post("/apps/cleanup")
async def api_cleanup_apps():
    """Entfernt verwaiste Docker-Container."""
    cleanup_orphaned_containers()
    return {"status": "cleaned"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
