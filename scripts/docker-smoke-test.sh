#!/usr/bin/env bash

set -euo pipefail

PROJECT="marine-dashboard-smoke"
OVERRIDE_FILE="$(mktemp)"
HEALTH_FILE="/tmp/marine-dashboard-health.json"

cleanup() {
  docker-compose -p "$PROJECT" -f docker-compose.yml -f "$OVERRIDE_FILE" down \
    --remove-orphans \
    --volumes \
    >/dev/null 2>&1 || true
  rm -f "$OVERRIDE_FILE" "$HEALTH_FILE"
}

trap cleanup EXIT

cat > "$OVERRIDE_FILE" <<'YAML'
services:
  mysql:
    container_name: marine-dashboard-smoke-mysql
    volumes:
      - marine_mysql_smoke_data:/var/lib/mysql

  app:
    container_name: marine-dashboard-smoke-node

volumes:
  marine_mysql_smoke_data:
YAML

MARINE_DASHBOARD_PORT=3003 docker-compose -p "$PROJECT" -f docker-compose.yml -f "$OVERRIDE_FILE" up -d --build

printf '%s\n' "Waiting for Marine Dashboard health endpoint..."

for attempt in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3003/health > "$HEALTH_FILE"; then
    if grep -q '"success":true' "$HEALTH_FILE" &&
       grep -q '"status":"healthy"' "$HEALTH_FILE"; then
      printf '%s\n' "Docker smoke test passed."
      cat "$HEALTH_FILE"
      exit 0
    fi
  fi

  sleep 2
done

printf '%s\n' "Docker smoke test failed: health endpoint did not become healthy."
docker-compose -p "$PROJECT" -f docker-compose.yml -f "$OVERRIDE_FILE" logs --no-color app mysql
exit 1
