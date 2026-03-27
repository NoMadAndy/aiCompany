#!/bin/bash
# AI Company - Auto-Reload Watcher
# Watches for file changes and triggers rebuild

cd /home/andy/aiCompany

echo "👁️  Auto-Reload Watcher gestartet..."
echo "   Überwache: frontend/src/, worker/, docker-compose.yml"

inotifywait -m -r -e modify,create,delete \
    --include '\.(ts|tsx|py|json|css|yml)$' \
    frontend/src/ worker/ docker-compose.yml 2>/dev/null | while read path action file; do
    echo "$(date '+%H:%M:%S') Änderung: $path$file ($action)"

    if [[ "$file" == *.py ]]; then
        echo "  → Worker wird automatisch neu geladen (uvicorn --reload)"
    elif [[ "$file" == "docker-compose.yml" ]]; then
        echo "  → Docker Compose Neustart..."
        docker compose up -d --build
    else
        echo "  → Frontend wird automatisch neu geladen (Next.js)"
    fi
done
