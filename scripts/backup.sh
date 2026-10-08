#!/bin/sh
set -eu

backup_path="${1:-backups/tack-$(date +%Y%m%d-%H%M%S).dump}"
backup_directory="$(dirname "$backup_path")"

mkdir -p "$backup_directory"
docker compose exec -T db sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-privileges' \
  > "$backup_path"

echo "Backup written to $backup_path"
