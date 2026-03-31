#!/bin/sh
# AI Company — File Watcher (laeuft im Docker-Container)
# Ueberwacht Code-Aenderungen und startet betroffene Container neu.
#
# Frontend (.ts/.tsx/.css/.json): Next.js .next/cache leeren + restart
# Worker (.py): uvicorn hat --reload, aber bei neuen Dateien restart noetig
# docker-compose.yml: Kein Auto-Restart (muss manuell gemacht werden)

COMPOSE_PROJECT="aicompany"
DEBOUNCE_SECONDS=5
LAST_FRONTEND_RESTART=0
LAST_WORKER_RESTART=0

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') [watcher] $1"
}

restart_frontend() {
  NOW=$(date +%s)
  DIFF=$((NOW - LAST_FRONTEND_RESTART))
  if [ "$DIFF" -lt "$DEBOUNCE_SECONDS" ]; then
    return
  fi
  LAST_FRONTEND_RESTART=$NOW

  log "Frontend-Aenderung erkannt — Cache leeren + Neustart..."

  # Next.js Cache leeren fuer sauberen Rebuild
  FRONTEND_CONTAINER=$(docker ps -q -f "name=${COMPOSE_PROJECT}.*frontend" 2>/dev/null | head -1)
  if [ -n "$FRONTEND_CONTAINER" ]; then
    docker exec "$FRONTEND_CONTAINER" rm -rf /app/.next/cache 2>/dev/null
    docker restart "$FRONTEND_CONTAINER" 2>/dev/null
    log "Frontend neugestartet (Container: ${FRONTEND_CONTAINER:0:12})"
  else
    log "WARNUNG: Frontend-Container nicht gefunden"
  fi
}

restart_worker() {
  NOW=$(date +%s)
  DIFF=$((NOW - LAST_WORKER_RESTART))
  if [ "$DIFF" -lt "$DEBOUNCE_SECONDS" ]; then
    return
  fi
  LAST_WORKER_RESTART=$NOW

  log "Worker-Aenderung erkannt — Neustart..."

  WORKER_CONTAINER=$(docker ps -q -f "name=${COMPOSE_PROJECT}.*worker" 2>/dev/null | head -1)
  if [ -n "$WORKER_CONTAINER" ]; then
    docker restart "$WORKER_CONTAINER" 2>/dev/null
    log "Worker neugestartet (Container: ${WORKER_CONTAINER:0:12})"
  else
    log "WARNUNG: Worker-Container nicht gefunden"
  fi
}

log "Watcher gestartet"
log "Ueberwache: frontend/src/ und worker/"
log "Debounce: ${DEBOUNCE_SECONDS}s"

# chokidar ueberwacht Dateien und gibt den Pfad der geaenderten Datei aus
chokidar \
  'frontend/src/**/*.ts' 'frontend/src/**/*.tsx' 'frontend/src/**/*.css' 'frontend/src/**/*.json' \
  'worker/**/*.py' \
  --ignore 'node_modules' --ignore '.next' --ignore '__pycache__' --ignore '*.pyc' \
  -c 'echo {path}' 2>/dev/null | while read CHANGED_FILE; do

  case "$CHANGED_FILE" in
    frontend/src/*)
      restart_frontend
      ;;
    worker/*)
      restart_worker
      ;;
    *)
      log "Aenderung: $CHANGED_FILE (kein Restart noetig)"
      ;;
  esac
done
