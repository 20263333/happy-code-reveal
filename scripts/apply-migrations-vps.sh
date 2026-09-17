#!/usr/bin/env bash
# ⚠️ Ин скрипт дигар миграцияҳои кӯҳнаро иҷро намекунад (онҳо маълумотро нест мекарданд).
# Танҳо сохтори базаи VPS-ро бо базаи асосӣ ҳамоҳанг мекунад (бехатар, маълумотро нест намекунад).
set -uo pipefail

FILE="$(cd "$(dirname "$0")" && pwd)/vps-schema-sync.sql"
LOG="/root/cloud-migration/schema-sync.log"
mkdir -p /root/cloud-migration

echo "==> Ҳамоҳангсозии сохтори база"
docker exec -i supabase-db psql -v ON_ERROR_STOP=0 -U postgres -d postgres < "$FILE" > "$LOG" 2>&1

echo "==> Хатогиҳо:"
grep -i '^ERROR' "$LOG" | head -20
echo "==> Тайёр. Лог: $LOG"
