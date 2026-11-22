#!/bin/bash
# ChatKit backup — PocketBase data, plus the Chatwoot database if this stack runs it.
#
# Run from this folder with the same compose file you deploy with:
#   ./backup.sh                                   # docker-compose.yml
#   COMPOSE_FILE=docker-compose.full.yml ./backup.sh
#
# BACKUP_DIR (default ./backups) and RETENTION_DAYS (default 7) are optional.
# Restore notes: docs/standalone-deploy.md#backup--restore
set -euo pipefail

cd "$(dirname "$0")"
export COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
DATE="$(date +%Y%m%d_%H%M%S)"

mkdir -p "${BACKUP_DIR}"
echo "[$(date)] ChatKit backup (${COMPOSE_FILE}) → ${BACKUP_DIR}"

# PocketBase: builder config, inboxes, settings (including the Chatwoot API token —
# keep these archives private).
echo "Backing up PocketBase data..."
docker compose exec -T pocketbase tar czf - -C /pb_data . > "${BACKUP_DIR}/pocketbase_${DATE}.tar.gz"

# Chatwoot Postgres — only when this compose file runs Chatwoot.
if docker compose config --services | grep -qx chatwoot-postgres; then
  echo "Backing up Chatwoot PostgreSQL..."
  docker compose exec -T chatwoot-postgres pg_dump -U postgres chatwoot_production \
    | gzip > "${BACKUP_DIR}/chatwoot_${DATE}.sql.gz"
fi

echo "Removing backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "*_*.gz" -mtime +"${RETENTION_DAYS}" -delete

echo "[$(date)] Backup complete:"
ls -lh "${BACKUP_DIR}" | tail -n 10
