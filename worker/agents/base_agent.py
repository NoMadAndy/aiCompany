"""Base Agent - All AI Company agents inherit from this"""

import logging
import json
from datetime import datetime
from typing import Optional
import psycopg2
import os

logger = logging.getLogger("agent")


class BaseAgent:
    """Base class for all AI Company agents"""

    def __init__(self, name: str, role: str, employee_id: int):
        self.name = name
        self.role = role
        self.employee_id = employee_id
        self.created_at = datetime.now()

    def get_db(self):
        return psycopg2.connect(
            os.environ.get("DATABASE_URL", "postgresql://aicompany:aicompany@db:5432/aicompany")
        )

    def log(self, message: str, type_: str = "ai", project_id: Optional[int] = None):
        try:
            conn = self.get_db()
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO activity_log (type, message, project_id, employee_id) VALUES (%s, %s, %s, %s)",
                (type_, f"[{self.name}] {message}", project_id, self.employee_id)
            )
            conn.commit()
            cur.close()
            conn.close()
        except Exception as e:
            logger.error(f"Log error: {e}")

    async def think(self, task: str) -> dict:
        """Override this to implement agent-specific thinking"""
        raise NotImplementedError

    async def execute(self, task: str, project_id: Optional[int] = None) -> dict:
        """Execute a task"""
        self.log(f"Starte Aufgabe: {task[:80]}...", project_id=project_id)

        try:
            result = await self.think(task)
            self.log(f"Aufgabe abgeschlossen: {task[:40]}...", project_id=project_id)
            return {"status": "completed", "result": result}
        except Exception as e:
            self.log(f"Fehler: {str(e)}", type_="error", project_id=project_id)
            return {"status": "error", "error": str(e)}
