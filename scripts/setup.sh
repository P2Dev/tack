#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ -e .env ] || [ -L .env ]; then
  echo '.env already exists; your configuration was preserved.'
  exit 0
fi
command -v openssl >/dev/null 2>&1 || { echo 'OpenSSL is required to generate secrets.' >&2; exit 1; }
postgres_password=$(openssl rand -hex 24)
auth_secret=$(openssl rand -hex 32)
admin_password=$(openssl rand -hex 20)
umask 077
set -C
{
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      POSTGRES_PASSWORD=*) printf 'POSTGRES_PASSWORD=%s\n' "$postgres_password" ;;
      BETTER_AUTH_SECRET=*) printf 'BETTER_AUTH_SECRET=%s\n' "$auth_secret" ;;
      TACK_ADMIN_PASSWORD=*) printf 'TACK_ADMIN_PASSWORD=%s\n' "$admin_password" ;;
      *) printf '%s\n' "$line" ;;
    esac
  done < .env.example
} > .env
echo 'Created .env with random database, session, and administrator secrets.'
echo 'Open .env to find your sign-in credentials or change the administrator email.'
echo 'Next: docker compose up -d --build --wait'
