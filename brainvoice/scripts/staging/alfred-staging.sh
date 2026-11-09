#!/usr/bin/env bash
# Production-like Alfred staging on one machine without Docker: separate processes for the
# mock Google (OAuth + Gmail REST), the HTTPS API, the worker and the scheduler, all on one
# PostgreSQL database. Each service is independently restartable.
#
#   ALFRED_STAGE_DIR=<dir with run/staging.env, tls/, logs/> scripts/staging/alfred-staging.sh up
#   … status | logs <svc> [n] | restart <svc> | stop <svc> | start <svc> | down
# Services: mock, api, worker, scheduler. Processes are found by their command line
# (Windows: PowerShell Win32_Process), so restarts work regardless of shell pid mapping.
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STAGE="${ALFRED_STAGE_DIR:?set ALFRED_STAGE_DIR}"
ENVFILE="$STAGE/run/staging.env"
LOGS="$STAGE/logs"
RUN="$STAGE/run"
mkdir -p "$LOGS" "$RUN"

load_env() {
  set -a
  # shellcheck disable=SC1090
  . "$ENVFILE"
  set +a
}

entry_for() {
  case "$1" in
    mock) echo "server/staging/mock-gmail.ts" ;;
    api) echo "server/index.ts" ;;
    worker) echo "server/worker.ts" ;;
    scheduler) echo "server/scheduler.ts" ;;
    *) echo "unknown service $1" >&2; exit 2 ;;
  esac
}

# Windows process ids whose command line runs the service entry file (tsx parent + node child).
winpids_for() {
  local entry
  entry="$(entry_for "$1")"
  powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { \$_.CommandLine -like '*${entry}*' -and \$_.Name -like 'node*' } | Select-Object -ExpandProperty ProcessId" 2>/dev/null | tr -d '\r'
}

is_running() {
  [ -n "$(winpids_for "$1")" ]
}

wait_ready() {
  local url="$1" tries="${2:-30}"
  for _ in $(seq 1 "$tries"); do
    if curl -sk -o /dev/null -w '%{http_code}' "$url" 2>/dev/null | grep -q '^200$'; then return 0; fi
    node -e "setTimeout(()=>{},1000)"
  done
  return 1
}

start_svc() {
  local name="$1"
  local entry
  entry="$(entry_for "$name")"
  if is_running "$name"; then
    echo "$name already running (pids $(winpids_for "$name" | tr '\n' ' '))"
    return 0
  fi
  (
    cd "$ROOT" || exit 1
    load_env
    export ALFRED_HOST_NAME="staging-$name"
    nohup node node_modules/tsx/dist/cli.mjs "$entry" >> "$LOGS/$name.log" 2>&1 &
  )
  node -e "setTimeout(()=>{},1500)"
  echo "$(date -u +%FT%TZ) started $name (pids $(winpids_for "$name" | tr '\n' ' ')) → $LOGS/$name.log"
}

stop_svc() {
  local name="$1"
  local pids
  pids="$(winpids_for "$name")"
  if [ -z "$pids" ]; then
    echo "$name not running"
    return 0
  fi
  for pid in $pids; do taskkill //PID "$pid" //T //F >/dev/null 2>&1 || true; done
  echo "$(date -u +%FT%TZ) stopped $name (pids $(echo "$pids" | tr '\n' ' '))"
}

case "${1:-}" in
  up)
    load_env
    start_svc mock
    start_svc api
    if wait_ready "https://127.0.0.1:${ALFRED_PORT}/api/health" 30; then echo "api ready"; else echo "api did not become ready" >&2; fi
    start_svc worker
    start_svc scheduler
    ;;
  down)
    for s in scheduler worker api mock; do stop_svc "$s"; done
    ;;
  start) start_svc "${2:?service}" ;;
  stop) stop_svc "${2:?service}" ;;
  restart)
    stop_svc "${2:?service}"
    node -e "setTimeout(()=>{},1000)"
    start_svc "$2"
    ;;
  status)
    for s in mock api worker scheduler; do
      if is_running "$s"; then echo "$s: running (pids $(winpids_for "$s" | tr '\n' ' '))"; else echo "$s: stopped"; fi
    done
    ;;
  logs) tail -n "${3:-40}" "$LOGS/${2:?service}.log" ;;
  *) echo "usage: $0 up|down|status|start <svc>|stop <svc>|restart <svc>|logs <svc> [n]"; exit 2 ;;
esac
