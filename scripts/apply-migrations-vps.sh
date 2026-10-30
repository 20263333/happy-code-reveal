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

echo "==> 1/4 Ҳамоҳангсозии сохтори база"
run_sql "$DIR/vps-schema-sync.sql"

echo "==> 2/4 Ҳамоҳангсозии сиёсатҳои дастрасӣ (RLS)"
run_sql "$DIR/vps-policies-sync.sql"

echo "==> 3/4 Ҳамоҳангсозии захирагоҳи файлҳо (buckets)"
run_sql "$DIR/vps-storage-sync.sql"

echo "==> 4/4 Барқарор кардани кредити сканери паспорт"
# Fail loudly: skipping a failed RPC repair would leave OCR unusable.
if ! docker exec -i --user root supabase-db psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres < "$DIR/vps-scan-credit-sync.sql" >> "$LOG" 2>&1; then
  echo "ERROR: Кредити сканер барқарор нашуд. Хатогиҳо:"
  grep -i '^ERROR' "$LOG" | tail -10
  exit 1
fi


echo "==> Хатогиҳо (агар бошанд):"
grep -i '^ERROR' "$LOG" | sort | uniq -c | sort -rn | head -25
echo "==> Тайёр. Лог: $LOG"
