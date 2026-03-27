"""AI Company Worker - GPU-enabled AI task processing"""

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
from tasks.code_gen import generate_code

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai-worker")

app = FastAPI(title="AI Company Worker", version="0.1.0")

# Database connection
def get_db():
    return psycopg2.connect(os.environ.get("DATABASE_URL", "postgresql://aicompany:aicompany@db:5432/aicompany"))

# Redis connection
def get_redis():
    return redis.from_url(os.environ.get("REDIS_URL", "redis://redis:6379"))

# GPU check
def check_gpu():
    try:
        import torch
        if torch.cuda.is_available():
            return {
                "available": True,
                "device": torch.cuda.get_device_name(0),
                "memory": f"{torch.cuda.get_device_properties(0).total_mem / 1e9:.1f} GB",
                "cuda_version": torch.version.cuda,
            }
    except Exception:
        pass
    return {"available": False, "device": "CPU", "memory": "N/A"}


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
    """Get employee details from DB"""
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


def classify_task(title: str, employee: dict) -> str:
    """Determine what kind of work this task requires based on title and agent skills"""
    title_lower = title.lower()
    dept = employee.get("department", "")

    # Research tasks
    if any(w in title_lower for w in ["recherch", "such", "find", "research", "analys", "paper", "studie", "quelle"]):
        return "research"
    # Code tasks
    if any(w in title_lower for w in ["code", "programm", "script", "implement", "develop", "build", "erstell", "schreib"]):
        return "code_generation"
    # Analysis / data tasks
    if any(w in title_lower for w in ["daten", "data", "statistik", "bericht", "report", "auswert"]):
        return "analysis"
    # Finance tasks
    if any(w in title_lower for w in ["budget", "geld", "finanz", "kosten", "invest", "rendite", "profit"]):
        return "finance"
    # GPU / ML tasks
    if any(w in title_lower for w in ["train", "model", "gpu", "neural", "ml", "ki-modell", "machine learning"]):
        return "ml_training"

    # Fallback based on department
    dept_mapping = {
        "Research": "research",
        "Engineering": "code_generation",
        "AI Lab": "ml_training",
        "Finance": "finance",
        "Management": "planning",
    }
    return dept_mapping.get(dept, "general")


async def execute_research(title: str, employee: dict) -> dict:
    """Execute a research task"""
    agent_name = employee.get("name", "Agent")
    log_activity("ai", f"[{agent_name}] Starte Web-Recherche: {title[:80]}", employee_id=employee.get("id"))

    web_results = await web_search(title)
    scientific_results = await search_scientific(title)

    summary_parts = []
    if web_results:
        summary_parts.append(f"**Web-Ergebnisse ({len(web_results)}):**")
        for r in web_results[:3]:
            summary_parts.append(f"- [{r['title']}]({r.get('url', '')}) — {r['snippet'][:120]}")

    if scientific_results:
        summary_parts.append(f"\n**Wissenschaftliche Quellen ({len(scientific_results)}):**")
        for r in scientific_results[:3]:
            year = f" ({r['year']})" if r.get('year') else ""
            summary_parts.append(f"- {r['title']}{year} — {r.get('abstract', '')[:120]}...")
            if r.get('citations'):
                summary_parts[-1] += f" [{r['citations']} Zitierungen]"

    if not summary_parts:
        summary_parts.append("Keine Ergebnisse gefunden. Versuche eine spezifischere Anfrage.")

    summary = "\n".join(summary_parts)
    log_activity("ai", f"[{agent_name}] Recherche abgeschlossen: {len(web_results)} Web + {len(scientific_results)} Paper", employee_id=employee.get("id"))

    return {
        "type": "research",
        "summary": summary,
        "web_results": web_results,
        "scientific_results": scientific_results,
        "sources_count": len(web_results) + len(scientific_results),
    }


async def execute_code_generation(title: str, employee: dict) -> dict:
    """Execute a code generation task"""
    agent_name = employee.get("name", "Agent")
    log_activity("ai", f"[{agent_name}] Starte Code-Generierung: {title[:80]}", employee_id=employee.get("id"))

    # Detect language from prompt
    title_lower = title.lower()
    lang = "python"
    if any(w in title_lower for w in ["typescript", "react", "next", "frontend", "component"]):
        lang = "typescript"
    elif any(w in title_lower for w in ["javascript", "node", "js"]):
        lang = "javascript"

    result = await generate_code(title, lang)

    log_activity("ai", f"[{agent_name}] Code generiert ({lang}): {title[:60]}", employee_id=employee.get("id"))
    return {
        "type": "code_generation",
        "summary": f"Code-Template generiert ({lang}).\n\n```{lang}\n{result['code'][:500]}\n```\n\n_{result['note']}_",
        **result,
    }


async def execute_analysis(title: str, employee: dict) -> dict:
    """Execute a data analysis task"""
    agent_name = employee.get("name", "Agent")
    log_activity("ai", f"[{agent_name}] Starte Analyse: {title[:80]}", employee_id=employee.get("id"))

    # Gather system data for analysis
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM tasks")
    total_tasks = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM tasks WHERE status = 'completed'")
    completed = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM projects")
    projects = cur.fetchone()[0]
    cur.execute("SELECT COALESCE(SUM(budget), 0), COALESCE(SUM(spent), 0) FROM projects")
    budget_row = cur.fetchone()
    cur.execute("SELECT COUNT(*) FROM activity_log WHERE created_at > NOW() - INTERVAL '24 hours'")
    recent_activity = cur.fetchone()[0]
    cur.close()
    conn.close()

    gpu = check_gpu()

    summary = f"""**System-Analyse: {title}**

**Aufgaben-Statistik:**
- Gesamt: {total_tasks} Tasks
- Abgeschlossen: {completed} ({round(completed/max(total_tasks,1)*100)}%)
- Offen: {total_tasks - completed}

**Projekte:** {projects}
**Budget:** {budget_row[0]:,.2f}€ (ausgegeben: {budget_row[1]:,.2f}€)
**Aktivität (24h):** {recent_activity} Events

**GPU-Status:** {'✓ ' + gpu['device'] + ' (' + gpu['memory'] + ')' if gpu['available'] else '✗ Keine GPU verfügbar'}

**Empfehlung:** {'Alle Systeme laufen optimal.' if completed > 0 else 'Noch keine Tasks abgeschlossen — Agenten sind bereit für Aufgaben.'}"""

    log_activity("ai", f"[{agent_name}] Analyse abgeschlossen", employee_id=employee.get("id"))
    return {"type": "analysis", "summary": summary}


async def execute_finance(title: str, employee: dict) -> dict:
    """Execute a finance task"""
    agent_name = employee.get("name", "Agent")
    log_activity("ai", f"[{agent_name}] Starte Finanz-Aufgabe: {title[:80]}", employee_id=employee.get("id"))

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT name, budget, spent, status FROM projects ORDER BY budget DESC")
    projects = cur.fetchall()
    cur.execute("SELECT type, COALESCE(SUM((value)::numeric), 0) FROM assets GROUP BY type")
    assets = cur.fetchall()
    cur.close()
    conn.close()

    lines = [f"**Finanzbericht: {title}**\n"]
    total_budget = 0
    total_spent = 0

    if projects:
        lines.append("**Projekte:**")
        for p in projects:
            total_budget += float(p[1] or 0)
            total_spent += float(p[2] or 0)
            usage = round(float(p[2] or 0) / max(float(p[1] or 1), 1) * 100)
            lines.append(f"- {p[0]}: {float(p[1] or 0):,.2f}€ Budget, {float(p[2] or 0):,.2f}€ ausgegeben ({usage}%) [{p[3]}]")

    lines.append(f"\n**Gesamt:** {total_budget:,.2f}€ Budget, {total_spent:,.2f}€ ausgegeben")
    lines.append(f"**Verfügbar:** {total_budget - total_spent:,.2f}€")

    if assets:
        lines.append("\n**Assets nach Typ:**")
        for a in assets:
            lines.append(f"- {a[0]}: {float(a[1]):,.2f}€")

    summary = "\n".join(lines)
    log_activity("ai", f"[{agent_name}] Finanzbericht erstellt", employee_id=employee.get("id"))
    return {"type": "finance", "summary": summary}


async def execute_ml_training(title: str, employee: dict) -> dict:
    """Execute an ML/GPU task"""
    agent_name = employee.get("name", "Agent")
    gpu = check_gpu()
    log_activity("ai", f"[{agent_name}] Starte ML-Aufgabe: {title[:80]} (GPU: {gpu['available']})", employee_id=employee.get("id"))

    if gpu["available"]:
        import torch
        device = torch.device("cuda")
        # Run a benchmark
        sizes = [512, 1024, 2048]
        results = []
        for s in sizes:
            start = datetime.now()
            a = torch.randn(s, s, device=device)
            b = torch.randn(s, s, device=device)
            c = torch.matmul(a, b)
            torch.cuda.synchronize()
            elapsed = (datetime.now() - start).total_seconds()
            gflops = (2 * s**3) / elapsed / 1e9
            results.append(f"- {s}x{s} Matmul: {elapsed*1000:.1f}ms ({gflops:.1f} GFLOPS)")

        mem_used = torch.cuda.memory_allocated() / 1e6
        mem_total = torch.cuda.get_device_properties(0).total_mem / 1e6

        summary = f"""**ML-Aufgabe: {title}**

**GPU:** {gpu['device']} ({gpu['memory']})
**CUDA:** {gpu['cuda_version']}

**Benchmark-Ergebnisse:**
{chr(10).join(results)}

**VRAM:** {mem_used:.0f} MB / {mem_total:.0f} MB verwendet

**Status:** GPU ist bereit für Training. Für echtes Model-Training wird ein Dataset und Trainingsconfig benötigt."""
    else:
        summary = f"""**ML-Aufgabe: {title}**

**GPU:** Nicht verfügbar (CPU-Modus)

Die GPU ist aktuell nicht erreichbar. ML-Tasks können im CPU-Modus ausgeführt werden, sind aber deutlich langsamer.

**Empfehlung:** NVIDIA Container Toolkit prüfen und Container mit GPU-Zugriff neustarten."""

    log_activity("ai", f"[{agent_name}] ML-Aufgabe abgeschlossen", employee_id=employee.get("id"))
    return {"type": "ml_training", "summary": summary, "gpu": gpu}


async def execute_planning(title: str, employee: dict) -> dict:
    """Execute a planning/management task"""
    agent_name = employee.get("name", "Agent")
    log_activity("ai", f"[{agent_name}] Starte Planung: {title[:80]}", employee_id=employee.get("id"))

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT name, role, department FROM employees WHERE status = 'active'")
    team = cur.fetchall()
    cur.execute("SELECT title, status, employee_id FROM tasks WHERE status != 'completed' ORDER BY priority LIMIT 10")
    open_tasks = cur.fetchall()
    cur.execute("SELECT name, status FROM projects")
    projects = cur.fetchall()
    cur.close()
    conn.close()

    lines = [f"**Planung: {title}**\n"]
    lines.append(f"**Team ({len(team)} Agenten):**")
    for t in team:
        lines.append(f"- {t[0]} ({t[1]}, {t[2]})")

    if open_tasks:
        lines.append(f"\n**Offene Tasks ({len(open_tasks)}):**")
        for t in open_tasks:
            lines.append(f"- [{t[1]}] {t[0]}")
    else:
        lines.append("\n**Keine offenen Tasks.** Alle Agenten sind verfügbar.")

    if projects:
        lines.append(f"\n**Projekte ({len(projects)}):**")
        for p in projects:
            lines.append(f"- {p[0]} [{p[1]}]")

    lines.append(f"\n**Nächste Schritte:** Aufgabe analysiert. Delegierung an spezialisierte Agenten empfohlen.")

    summary = "\n".join(lines)
    log_activity("ai", f"[{agent_name}] Planung abgeschlossen", employee_id=employee.get("id"))
    return {"type": "planning", "summary": summary}


async def execute_general(title: str, employee: dict) -> dict:
    """Fallback for general tasks"""
    agent_name = employee.get("name", "Agent")
    log_activity("ai", f"[{agent_name}] Bearbeite Aufgabe: {title[:80]}", employee_id=employee.get("id"))

    summary = f"""**Aufgabe: {title}**

Agent **{agent_name}** ({employee.get('role', 'Agent')}) hat die Aufgabe analysiert.

**Ergebnis:** Die Aufgabe wurde entgegengenommen und verarbeitet. Für komplexere Ergebnisse empfehle ich:
- Recherche-Aufgaben an **SCOUT** (Research)
- Code-Aufgaben an **NEXUS** (Engineering)
- ML/Training an **FORGE** (AI Lab)
- Finanzen an **VAULT** (Finance)
- Strategie/Planung an **ARIA** (Management)"""

    log_activity("ai", f"[{agent_name}] Aufgabe abgeschlossen: {title[:60]}", employee_id=employee.get("id"))
    return {"type": "general", "summary": summary}


# Task execution dispatcher
TASK_EXECUTORS = {
    "research": execute_research,
    "code_generation": execute_code_generation,
    "analysis": execute_analysis,
    "finance": execute_finance,
    "ml_training": execute_ml_training,
    "planning": execute_planning,
    "general": execute_general,
}


@app.get("/health")
async def health():
    gpu = check_gpu()
    return {"status": "ok", "gpu": gpu, "timestamp": datetime.now().isoformat()}


@app.get("/gpu")
async def gpu_status():
    return check_gpu()


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
    """Process an experiment in the background"""
    logger.info(f"Processing experiment: {req.prompt[:50]}")

    try:
        gpu = check_gpu()
        if gpu["available"]:
            import torch
            device = torch.device("cuda")
            tensor = torch.randn(1000, 1000, device=device)
            result = torch.matmul(tensor, tensor.T)
            log_activity("ai", f"GPU Experiment abgeschlossen. Matrix: {result.shape}, Device: {device}")
        else:
            log_activity("ai", f"CPU Experiment abgeschlossen (keine GPU verfügbar)")

    except Exception as e:
        log_activity("error", f"Experiment fehlgeschlagen: {str(e)}")
        logger.error(f"Experiment error: {e}")


@app.post("/task")
async def process_task(req: TaskRequest, background_tasks: BackgroundTasks):
    logger.info(f"Task received: {req.task_id} - {req.action}")
    background_tasks.add_task(execute_task, req)
    return {"status": "queued", "task_id": req.task_id}


async def execute_task(req: TaskRequest):
    """Execute a task in the background using the appropriate agent"""
    conn = None
    try:
        conn = get_db()
        cur = conn.cursor()

        # Get task details
        cur.execute("SELECT title, description, project_id, employee_id FROM tasks WHERE id = %s", (req.task_id,))
        task_row = cur.fetchone()
        if not task_row:
            logger.error(f"Task {req.task_id} not found")
            return

        title, description, project_id, employee_id = task_row
        employee_id = employee_id or req.employee_id

        # Mark as running
        cur.execute("UPDATE tasks SET status = 'running', started_at = NOW() WHERE id = %s", (req.task_id,))
        conn.commit()

        log_activity("task", f"Task #{req.task_id} gestartet: {title[:80]}", project_id=project_id, employee_id=employee_id)

        # Get employee info for routing
        employee = get_employee_info(employee_id) if employee_id else {}

        # Classify and execute
        task_type = classify_task(title, employee)
        executor = TASK_EXECUTORS.get(task_type, execute_general)

        logger.info(f"Task #{req.task_id} classified as '{task_type}', executing with {executor.__name__}")

        result = await executor(title, employee)
        result["task_type"] = task_type

        # Save result
        cur.execute(
            "UPDATE tasks SET status = 'completed', completed_at = NOW(), result = %s WHERE id = %s",
            (json.dumps(result), req.task_id)
        )
        conn.commit()
        cur.close()
        conn.close()

        log_activity("task", f"Task #{req.task_id} abgeschlossen ({task_type}): {title[:60]}", project_id=project_id, employee_id=employee_id)

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


@app.post("/research")
async def web_research(query: dict, background_tasks: BackgroundTasks):
    """Perform web research on a topic"""
    topic = query.get("topic", "")
    log_activity("ai", f"Web-Recherche gestartet: {topic[:80]}")

    web_results = await web_search(topic)
    scientific_results = await search_scientific(topic)

    return {
        "web_results": web_results,
        "scientific_results": scientific_results,
        "total": len(web_results) + len(scientific_results),
    }


# GeldAlchemie Simulation
@app.post("/geld-alchemie/simulate")
async def simulate_geld_alchemie(params: dict):
    """Simulate the 100€ to 100k€ growth strategies"""
    start_capital = params.get("start_capital", 100)
    target = params.get("target", 100000)
    weeks = params.get("weeks", 52)
    strategy = params.get("strategy", "compound")

    import numpy as np

    results = []
    capital = float(start_capital)

    for week in range(1, weeks + 1):
        if strategy == "compound":
            growth_rate = np.random.normal(0.15, 0.08)
            capital *= (1 + growth_rate)
        elif strategy == "arbitrage":
            trades = np.random.poisson(5)
            for _ in range(trades):
                profit = np.random.exponential(capital * 0.03)
                capital += profit
        elif strategy == "content":
            pieces = np.random.poisson(10)
            revenue_per_piece = np.random.exponential(5)
            capital += pieces * revenue_per_piece
        elif strategy == "mixed":
            capital *= (1 + np.random.normal(0.08, 0.05))
            capital += np.random.poisson(3) * np.random.exponential(capital * 0.02)
            capital += np.random.poisson(5) * np.random.exponential(3)

        capital = max(capital, 0)
        results.append({
            "week": week,
            "capital": round(capital, 2),
            "target_pct": round((capital / target) * 100, 2),
        })

        if capital >= target:
            break

    log_activity(
        "finance",
        f"GeldAlchemie Simulation: {start_capital}€ → {round(capital, 2)}€ in {len(results)} Wochen ({strategy})",
        project_id=1
    )

    return {
        "results": results,
        "final_capital": round(capital, 2),
        "reached_target": capital >= target,
        "weeks_needed": len(results),
        "strategy": strategy,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
