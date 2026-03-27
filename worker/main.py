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
            # Simple GPU test
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
    """Execute a task in the background"""
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("UPDATE tasks SET status = 'running', started_at = NOW() WHERE id = %s", (req.task_id,))
        conn.commit()

        log_activity("task", f"Task #{req.task_id} gestartet: {req.action}")

        # Task execution logic based on action type
        result = {"status": "completed", "output": f"Task {req.action} ausgeführt"}

        cur.execute(
            "UPDATE tasks SET status = 'completed', completed_at = NOW(), result = %s WHERE id = %s",
            (json.dumps(result), req.task_id)
        )
        conn.commit()
        cur.close()
        conn.close()

        log_activity("task", f"Task #{req.task_id} abgeschlossen")

    except Exception as e:
        logger.error(f"Task error: {e}")
        log_activity("error", f"Task #{req.task_id} fehlgeschlagen: {str(e)}")


@app.post("/research")
async def web_research(query: dict, background_tasks: BackgroundTasks):
    """Perform web research on a topic"""
    topic = query.get("topic", "")
    log_activity("ai", f"Web-Recherche gestartet: {topic[:80]}")

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            # Search for scientific papers (simplified)
            results = []
            # In production, this would use real APIs (Google Scholar, Semantic Scholar, etc.)
            results.append({
                "source": "system",
                "title": f"Recherche zu: {topic}",
                "summary": "Worker bereit für Web-Recherche. Externe APIs werden in der nächsten Version angebunden."
            })
            return {"results": results}
        except Exception as e:
            return {"error": str(e)}


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
        # Simulate different strategies
        if strategy == "compound":
            # Compound growth with variance
            growth_rate = np.random.normal(0.15, 0.08)  # 15% avg weekly growth
            capital *= (1 + growth_rate)
        elif strategy == "arbitrage":
            # Digital arbitrage simulation
            trades = np.random.poisson(5)  # avg 5 trades per week
            for _ in range(trades):
                profit = np.random.exponential(capital * 0.03)
                capital += profit
        elif strategy == "content":
            # AI content creation revenue
            pieces = np.random.poisson(10)
            revenue_per_piece = np.random.exponential(5)
            capital += pieces * revenue_per_piece
        elif strategy == "mixed":
            # Mix of all strategies
            capital *= (1 + np.random.normal(0.08, 0.05))
            capital += np.random.poisson(3) * np.random.exponential(capital * 0.02)
            capital += np.random.poisson(5) * np.random.exponential(3)

        capital = max(capital, 0)  # Can't go negative
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
