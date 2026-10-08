#!/bin/sh
set -eu

backup_path="${1:-}"
confirmation="${2:-}"

if [ -z "$backup_path" ] || [ "$confirmation" != "--confirm" ]; then
  echo "Usage: ./scripts/restore.sh path/to/tack.dump --confirm"
  echo "Restore replaces the current Tack database contents."
  exit 1
fi

if [ ! -f "$backup_path" ]; then
  echo "Backup not found: $backup_path"
  exit 1
fi

docker compose exec -T db sh -c \
  'dropdb -U "$POSTGRES_USER" --if-exists "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
docker compose exec -T db sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges' \
  < "$backup_path"

echo "Database restored from $backup_path"
