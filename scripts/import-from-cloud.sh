#!/usr/bin/env bash
# Binosoz.tj — маълумоти Lovable Cloud-ро ба сервери худӣ (VPS) мекӯчонад.
# Истифода:
#   bash scripts/import-from-cloud.sh <APP_URL> <EXPORT_SECRET>
# Мисол:
#   bash scripts/import-from-cloud.sh https://script-seeker-buddy.lovable.app ХХХХ
set -euo pipefail

APP_URL="${1:?APP_URL лозим (масалан https://script-seeker-buddy.lovable.app)}"
SECRET="${2:?EXPORT_SECRET лозим}"

SUPA_DIR="/opt/supabase"
WORK="/root/cloud-migration"
DUMP="$WORK/platform-tj-dump.sql"
MANIFEST="$WORK/storage-manifest.tsv"
STORAGE_DIR="$SUPA_DIR/volumes/storage/stub/stub"

mkdir -p "$WORK"

echo "==> 1/6 Барномаро муваққатан меистонем"
pm2 stop binosoz >/dev/null 2>&1 || true

echo "==> 2/6 Захираи эҳтиётии базаи ҳозира"
POSTGRES_PASSWORD=$(grep -E "^POSTGRES_PASSWORD=" "$SUPA_DIR/.env" | cut -d= -f2-)
docker exec supabase-db pg_dumpall -U postgres > "$WORK/backup-before-import-$(date +%F-%H%M).sql" || true

echo "==> 3/6 Боргирии маълумот аз Lovable Cloud"
curl -fsSL -H "x-export-secret: $SECRET" "$APP_URL/api/public/export/database" -o "$DUMP"
echo "    Ҳаҷм: $(du -h "$DUMP" | cut -f1)"

echo "==> 4/6 Барқарорсозии маълумот дар базаи сервер"
docker cp "$DUMP" supabase-db:/tmp/import.sql
docker exec -i supabase-db psql -v ON_ERROR_STOP=0 \
  "postgres://postgres:${POSTGRES_PASSWORD}@localhost:5432/postgres" \
  -f /tmp/import.sql > "$WORK/import.log" 2>&1 || true
echo "    Хатогиҳо: $(grep -c '^ERROR' "$WORK/import.log" || true) (лог: $WORK/import.log)"

echo "==> 5/6 Боргирии файлҳо (суратҳо, ҳуҷҷатҳо)"
curl -fsSL -H "x-export-secret: $SECRET" "$APP_URL/api/public/export/storage" -o "$MANIFEST"
total=$(wc -l < "$MANIFEST"); i=0
mkdir -p "$STORAGE_DIR"
while IFS=$'\t' read -r bucket path url; do
  [[ -z "${bucket:-}" || "${bucket:0:1}" == "#" ]] && continue
  i=$((i+1))
  dest="$STORAGE_DIR/$bucket/$path"
  mkdir -p "$(dirname "$dest")"
  if [[ ! -s "$dest" ]]; then
    curl -fsSL "$url" -o "$dest" || echo "    ! Нашуд: $bucket/$path"
  fi
  (( i % 25 == 0 )) && echo "    $i / $total"
done < "$MANIFEST"
chown -R 1000:1000 "$SUPA_DIR/volumes/storage" || true

echo "==> 6/6 Restart"
docker restart supabase-storage >/dev/null 2>&1 || (cd "$SUPA_DIR" && docker compose restart storage)
pm2 restart binosoz >/dev/null 2>&1 || pm2 start binosoz >/dev/null 2>&1 || true

echo ""
echo "================================================="
echo " Кӯчонидан анҷом ёфт."
echo " Лог: $WORK/import.log"
echo " Барнома: http://31.97.37.138"
echo "================================================="
