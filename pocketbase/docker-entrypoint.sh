#!/bin/sh
set -e

PB_ADMIN_EMAIL="${PB_ADMIN_EMAIL:-}"
PB_ADMIN_PASSWORD="${PB_ADMIN_PASSWORD:-}"

# Apply migrations before anything touches the database.
/pocketbase migrate up --dir=/pb_data --migrationsDir=/pb_migrations

# Create (or update) the superuser from the environment on every boot, so the
# login in .env always works. Skipped when unset, e.g. if you prefer to manage
# superusers by hand in the dashboard.
if [ -n "$PB_ADMIN_EMAIL" ] && [ -n "$PB_ADMIN_PASSWORD" ]; then
  case "$PB_ADMIN_PASSWORD" in
    changeme*|change-this*)
      echo "WARNING: PB_ADMIN_PASSWORD is still the example value — change it in .env" >&2 ;;
  esac
  /pocketbase superuser upsert "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD" --dir=/pb_data
else
  echo "PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD not set — no superuser created." >&2
  echo "Create one with: docker compose exec pocketbase /pocketbase superuser upsert EMAIL PASSWORD --dir=/pb_data" >&2
fi

exec /pocketbase serve \
  --http=0.0.0.0:8090 \
  --dir=/pb_data \
  --publicDir=/pb_public \
  --hooksDir=/pb_hooks \
  --migrationsDir=/pb_migrations
