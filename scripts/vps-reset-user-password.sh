#!/usr/bin/env bash
# Иваз кардани пароли корбар дар Supabase Auth:
# Истифода: bash scripts/vps-reset-user-password.sh "email@example.com" "пароли_нав"
set -euo pipefail

EMAIL="${1:-}"
NEW_PASS="${2:-}"

if [[ -z "$EMAIL" || -z "$NEW_PASS" ]]; then
  echo "Истифода: bash scripts/vps-reset-user-password.sh <email> <пароли_нав>"
  exit 1
fi

echo "Иваз кардани парол барои: $EMAIL ..."

docker exec -i supabase-db psql -U postgres -d postgres <<SQL
UPDATE auth.users
SET encrypted_password = extensions.crypt('$NEW_PASS', extensions.gen_salt('bf')),
    updated_at = now()
WHERE lower(email) = lower('$EMAIL');
SQL

echo "Парол бомуваффақият иваз шуд! Акнун метавонед бо ин парол ворид шавед."
