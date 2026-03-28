"""Agent Memory System — Agents lernen aus vergangenen Aufgaben und werden besser."""

import os
import json
import logging
import psycopg2

logger = logging.getLogger("agent-memory")

def get_db():
    return psycopg2.connect(os.environ.get("DATABASE_URL", "postgresql://aicompany:aicompany@db:5432/aicompany"))


def extract_and_store_learnings(task_id: int, employee_id: int, title: str, result: str):
    """Nach Aufgaben-Abschluss: Kernerkenntnisse extrahieren und speichern."""
    try:
        from ai_engine import think_structured

        prompt = f"""Analysiere das Ergebnis dieser abgeschlossenen Aufgabe und extrahiere 1-3 Kernerkenntnisse.

Aufgabe: {title}
Ergebnis (Zusammenfassung): {result[:1500]}

Antworte NUR als JSON-Array. Jedes Element hat:
- "category": "learning" (neue Erkenntnis), "mistake" (Fehler/Problem), oder "pattern" (wiederholtes Muster)
- "content": Die Erkenntnis in einem Satz (deutsch)
- "context": Kurzer Kontext, wann diese Erkenntnis relevant ist

Beispiel: [{{"category": "learning", "content": "Web-Scraping mit httpx ist schneller als requests für parallele Anfragen", "context": "Web-Recherche Aufgaben"}}]"""

        learnings = think_structured(
            prompt=prompt,
            system="Du bist ein Analyse-Assistent. Extrahiere Erkenntnisse aus Aufgabenergebnissen.",
            fallback=[{"category": "learning", "content": f"Aufgabe '{title[:80]}' erfolgreich abgeschlossen", "context": "Allgemein"}]
        )

        if not isinstance(learnings, list):
            learnings = [learnings] if isinstance(learnings, dict) else []

        conn = get_db()
        cur = conn.cursor()

        for learning in learnings[:3]:
            if not isinstance(learning, dict) or "content" not in learning:
                continue
            cur.execute(
                """INSERT INTO agent_memory (employee_id, task_id, category, content, context)
                   VALUES (%s, %s, %s, %s, %s)""",
                (
                    employee_id,
                    task_id,
                    learning.get("category", "learning"),
                    learning["content"],
                    learning.get("context", ""),
                )
            )

        conn.commit()
        cur.close()
        conn.close()
        logger.info(f"Stored {len(learnings)} learnings for employee {employee_id} from task {task_id}")

    except Exception as e:
        logger.error(f"Failed to extract learnings: {e}")


def get_relevant_memories(employee_id: int, task_title: str, limit: int = 5) -> list[str]:
    """Relevante Erinnerungen für eine neue Aufgabe abrufen."""
    try:
        conn = get_db()
        cur = conn.cursor()

        # Extract keywords from the task title
        keywords = [w.lower() for w in task_title.split() if len(w) > 3]

        if keywords:
            # Build ILIKE conditions for keyword matching
            conditions = " OR ".join(
                [f"LOWER(content || ' ' || COALESCE(context, '')) LIKE %s" for _ in keywords]
            )
            params = [f"%{kw}%" for kw in keywords]

            cur.execute(
                f"""SELECT id, content, context, relevance_score
                    FROM agent_memory
                    WHERE employee_id = %s AND ({conditions})
                    ORDER BY relevance_score DESC, created_at DESC
                    LIMIT %s""",
                [employee_id] + params + [limit]
            )
        else:
            # No keywords — just get the most recent high-relevance memories
            cur.execute(
                """SELECT id, content, context, relevance_score
                   FROM agent_memory
                   WHERE employee_id = %s
                   ORDER BY relevance_score DESC, created_at DESC
                   LIMIT %s""",
                (employee_id, limit)
            )

        rows = cur.fetchall()
        memory_ids = [r[0] for r in rows]

        # Increment usage counter
        if memory_ids:
            cur.execute(
                "UPDATE agent_memory SET times_used = times_used + 1 WHERE id = ANY(%s)",
                (memory_ids,)
            )
            conn.commit()

        cur.close()
        conn.close()

        return [f"{r[1]} (Kontext: {r[2]})" if r[2] else r[1] for r in rows]

    except Exception as e:
        logger.error(f"Failed to get memories: {e}")
        return []


def update_agent_metrics(employee_id: int):
    """Metriken für einen Agenten aktualisieren (letzte 7 Tage)."""
    try:
        conn = get_db()
        cur = conn.cursor()

        cur.execute(
            """SELECT
                COUNT(*) FILTER (WHERE status = 'completed') as completed,
                COUNT(*) FILTER (WHERE status = 'failed') as failed
               FROM tasks
               WHERE employee_id = %s AND created_at > NOW() - INTERVAL '7 days'""",
            (employee_id,)
        )
        row = cur.fetchone()
        completed, failed = row[0], row[1]

        cur.execute(
            "SELECT COUNT(*) FROM agent_memory WHERE employee_id = %s",
            (employee_id,)
        )
        learnings = cur.fetchone()[0]

        # Upsert metrics for current period
        cur.execute(
            """INSERT INTO agent_metrics (employee_id, period_start, period_end, tasks_completed, tasks_failed, learnings_count)
               VALUES (%s, NOW() - INTERVAL '7 days', NOW(), %s, %s, %s)""",
            (employee_id, completed, failed, learnings)
        )

        conn.commit()
        cur.close()
        conn.close()

    except Exception as e:
        logger.error(f"Failed to update metrics: {e}")
