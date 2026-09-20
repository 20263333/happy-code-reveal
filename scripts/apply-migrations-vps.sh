#!/usr/bin/env bash
# Сохтор ва сиёсатҳои дастрасии базаи VPS-ро бо базаи асосӣ ҳамоҳанг мекунад.
# Бехатар аст — маълумотро нест намекунад.
set -uo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
LOG="/root/cloud-migration/schema-sync.log"
mkdir -p /root/cloud-migration
: > "$LOG"

run_sql() {
  docker exec -i --user root supabase-db psql -v ON_ERROR_STOP=0 -U supabase_admin -d postgres < "$1" >> "$LOG" 2>&1 \
    || docker exec -i supabase-db psql -v ON_ERROR_STOP=0 -U postgres -d postgres < "$1" >> "$LOG" 2>&1
}

echo "==> 1/2 Ҳамоҳангсозии сохтори база"
run_sql "$DIR/vps-schema-sync.sql"

echo "==> 2/2 Ҳамоҳангсозии сиёсатҳои дастрасӣ (RLS)"
run_sql "$DIR/vps-policies-sync.sql"

echo "==> Хатогиҳо (агар бошанд):"
grep -i '^ERROR' "$LOG" | sort | uniq -c | sort -rn | head -25
echo "==> Тайёр. Лог: $LOG"
