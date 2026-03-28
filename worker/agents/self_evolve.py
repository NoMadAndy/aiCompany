"""Self-Evolution System — AI Company kann ihren eigenen Code verbessern."""

import os
import json
import logging
import psycopg2
from datetime import datetime

logger = logging.getLogger("self-evolve")

# Allowed base paths for file operations
ALLOWED_PATHS = [
    "/app/",           # worker code
    "/app/frontend-src/",  # frontend source (mounted volume)
]

FORBIDDEN_PATTERNS = [
    ".env", "secret", "password", "credentials", "token",
    "../", "node_modules", "__pycache__", ".git",
]


def get_db():
    return psycopg2.connect(os.environ.get("DATABASE_URL", "postgresql://aicompany:aicompany@db:5432/aicompany"))


def validate_path(path: str) -> bool:
    """Sicherheitsprüfung: Nur erlaubte Pfade."""
    normalized = os.path.normpath(path)
    if any(p in normalized.lower() for p in FORBIDDEN_PATTERNS):
        return False
    return any(normalized.startswith(base) for base in ALLOWED_PATHS)


def read_file(path: str) -> str | None:
    """Datei aus dem Codebase lesen."""
    if not validate_path(path):
        logger.warning(f"Path validation failed: {path}")
        return None
    try:
        with open(path, "r") as f:
            return f.read()
    except Exception as e:
        logger.error(f"Failed to read {path}: {e}")
        return None


def list_files(directory: str) -> list[str]:
    """Dateien in einem Verzeichnis auflisten."""
    if not validate_path(directory):
        return []
    try:
        result = []
        for root, dirs, files in os.walk(directory):
            # Skip hidden and system dirs
            dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ('node_modules', '__pycache__', '.next')]
            for f in files:
                if not f.startswith('.'):
                    result.append(os.path.join(root, f))
        return result[:200]  # Limit
    except Exception as e:
        logger.error(f"Failed to list {directory}: {e}")
        return []


def propose_change(employee_id: int, file_path: str, description: str, new_content: str) -> int | None:
    """Code-Änderung vorschlagen (wird NICHT automatisch angewendet)."""
    if not validate_path(file_path):
        logger.warning(f"Rejected proposal for forbidden path: {file_path}")
        return None

    try:
        old_content = read_file(file_path)

        # Generate a simple diff summary
        diff_summary = _generate_diff_summary(old_content, new_content)

        conn = get_db()
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO code_changes (proposed_by, file_path, description, old_content, new_content, diff_summary, status)
               VALUES (%s, %s, %s, %s, %s, %s, 'proposed')
               RETURNING id""",
            (employee_id, file_path, description, old_content, new_content, diff_summary)
        )
        change_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()

        # Log activity
        _log_activity("ai", f"Code-Änderung vorgeschlagen: {description[:100]}", employee_id=employee_id,
                       details={"change_id": change_id, "file": file_path})

        logger.info(f"Change #{change_id} proposed by employee {employee_id}: {file_path}")
        return change_id

    except Exception as e:
        logger.error(f"Failed to propose change: {e}")
        return None


def apply_change(change_id: int, user_id: int) -> bool:
    """Genehmigte Änderung anwenden."""
    try:
        conn = get_db()
        cur = conn.cursor()

        cur.execute(
            "SELECT file_path, new_content, old_content, status FROM code_changes WHERE id = %s",
            (change_id,)
        )
        row = cur.fetchone()
        if not row:
            logger.error(f"Change {change_id} not found")
            return False

        file_path, new_content, old_content, status = row

        if status != 'proposed':
            logger.warning(f"Change {change_id} is not in 'proposed' status: {status}")
            return False

        if not validate_path(file_path):
            return False

        # Write the file
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, "w") as f:
            f.write(new_content)

        # Update status
        cur.execute(
            "UPDATE code_changes SET status = 'applied', approved_by = %s, applied_at = NOW() WHERE id = %s",
            (user_id, change_id)
        )
        conn.commit()
        cur.close()
        conn.close()

        _log_activity("system", f"Code-Änderung #{change_id} angewendet: {file_path}",
                       details={"change_id": change_id, "approved_by": user_id})

        logger.info(f"Change #{change_id} applied to {file_path}")
        return True

    except Exception as e:
        logger.error(f"Failed to apply change {change_id}: {e}")
        return False


def rollback_change(change_id: int) -> bool:
    """Angewendete Änderung zurücksetzen."""
    try:
        conn = get_db()
        cur = conn.cursor()

        cur.execute(
            "SELECT file_path, old_content, status FROM code_changes WHERE id = %s",
            (change_id,)
        )
        row = cur.fetchone()
        if not row:
            return False

        file_path, old_content, status = row

        if status != 'applied':
            logger.warning(f"Change {change_id} cannot be rolled back: status={status}")
            return False

        if old_content is not None and validate_path(file_path):
            with open(file_path, "w") as f:
                f.write(old_content)

        cur.execute(
            "UPDATE code_changes SET status = 'rolled_back' WHERE id = %s",
            (change_id,)
        )
        conn.commit()
        cur.close()
        conn.close()

        _log_activity("system", f"Code-Änderung #{change_id} zurückgesetzt: {file_path}",
                       details={"change_id": change_id})

        logger.info(f"Change #{change_id} rolled back")
        return True

    except Exception as e:
        logger.error(f"Failed to rollback change {change_id}: {e}")
        return False


def analyze_and_propose(employee_id: int, file_path: str) -> int | None:
    """KI analysiert eine Datei und schlägt Verbesserungen vor."""
    try:
        from ai_engine import think

        content = read_file(file_path)
        if not content:
            return None

        # Determine file type for context
        ext = os.path.splitext(file_path)[1]
        lang = {"py": "Python", ".ts": "TypeScript", ".tsx": "TypeScript/React", ".css": "CSS"}.get(ext, "Code")

        prompt = f"""Analysiere diesen {lang}-Code und schlage eine konkrete Verbesserung vor.

Datei: {file_path}
```
{content[:3000]}
```

Fokussiere dich auf:
1. Performance-Optimierungen
2. Bessere Fehlerbehandlung
3. Code-Qualität und Lesbarkeit
4. Sicherheitsverbesserungen

Antworte mit:
1. Eine Zeile: Was wird verbessert?
2. Den vollständigen verbesserten Code der Datei.

Wenn der Code bereits gut ist, sage "KEINE_ÄNDERUNG_NÖTIG"."""

        result = think(
            prompt=prompt,
            system="Du bist ein erfahrener Code-Reviewer. Schlage nur sinnvolle, konkrete Verbesserungen vor.",
            agent_name="NEXUS"
        )

        if "KEINE_ÄNDERUNG_NÖTIG" in result:
            return None

        # Extract description (first line) and new code
        lines = result.strip().split("\n")
        description = lines[0].strip("# ").strip()

        # Try to extract code block
        code_start = result.find("```")
        if code_start >= 0:
            code_end = result.find("```", code_start + 3)
            if code_end >= 0:
                # Skip the language identifier line
                code_block = result[code_start:code_end]
                first_newline = code_block.find("\n")
                new_content = code_block[first_newline + 1:] if first_newline >= 0 else code_block[3:]
            else:
                new_content = result[code_start + 3:]
        else:
            # No code block found — skip
            return None

        return propose_change(employee_id, file_path, description, new_content.strip())

    except Exception as e:
        logger.error(f"Failed to analyze {file_path}: {e}")
        return None


def _generate_diff_summary(old: str | None, new: str) -> str:
    """Einfache Zusammenfassung der Änderungen."""
    if not old:
        return f"Neue Datei ({len(new.splitlines())} Zeilen)"

    old_lines = old.splitlines()
    new_lines = new.splitlines()
    added = len(new_lines) - len(old_lines)

    return f"{len(old_lines)} → {len(new_lines)} Zeilen ({'+' if added >= 0 else ''}{added})"


def _log_activity(type_: str, message: str, project_id=None, employee_id=None, details=None):
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
        logger.error(f"Failed to log: {e}")
