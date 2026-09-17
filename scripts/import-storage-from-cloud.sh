#!/usr/bin/env bash
# Binosoz.tj — танҳо файлҳоро (суратҳо, ҳуҷҷатҳо) аз Lovable Cloud ба VPS мекӯчонад
# ва сабтҳои storage.buckets / storage.objects-ро дар базаи VPS барқарор мекунад.
#
# Истифода:
#   bash scripts/import-storage-from-cloud.sh <APP_URL> <EXPORT_SECRET>
set -euo pipefail

APP_URL="${1:?APP_URL лозим (масалан https://project--63d19137-8c20-4d78-9f11-31bd62013944.lovable.app)}"
SECRET="${2:?EXPORT_SECRET лозим}"

SUPA_DIR="/opt/supabase"
WORK="/root/cloud-migration"
MANIFEST="$WORK/storage-manifest.tsv"
STORAGE_DIR="$SUPA_DIR/volumes/storage/stub/stub"
SQL="$WORK/storage-objects.sql"

mkdir -p "$WORK" "$STORAGE_DIR"

echo "==> 1/4 Рӯйхати файлҳо аз Cloud"
curl -fsSL -H "x-export-secret: $SECRET" "$APP_URL/api/public/export/storage" -o "$MANIFEST"
total=$(wc -l < "$MANIFEST")
echo "    Файлҳо: $total"

echo "==> 2/4 Боргирии файлҳо"
i=0
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

echo "==> 3/4 Сабтҳои storage дар база"
{
  echo "BEGIN;"
  cut -f1 "$MANIFEST" | grep -v '^#' | sort -u | while read -r bucket; do
    [[ -z "$bucket" ]] && continue
    echo "INSERT INTO storage.buckets (id, name, public) VALUES ('$bucket', '$bucket', false) ON CONFLICT (id) DO NOTHING;"
  done
  while IFS=$'\t' read -r bucket path url; do
    [[ -z "${bucket:-}" || "${bucket:0:1}" == "#" ]] && continue
    file="$STORAGE_DIR/$bucket/$path"
    [[ -s "$file" ]] || continue
    size=$(stat -c%s "$file")
    mime=$(file -b --mime-type "$file")
    esc_path=${path//\'/\'\'}
    echo "INSERT INTO storage.objects (bucket_id, name, owner, metadata) VALUES ('$bucket', '$esc_path', NULL, jsonb_build_object('size', ${size}::bigint, 'mimetype', '$mime', 'cacheControl', 'max-age=3600')) ON CONFLICT (bucket_id, name) DO UPDATE SET metadata = EXCLUDED.metadata;"
  done < "$MANIFEST"
  echo "COMMIT;"
} > "$SQL"

POSTGRES_PASSWORD=$(grep -E "^POSTGRES_PASSWORD=" "$SUPA_DIR/.env" | cut -d= -f2-)
docker cp "$SQL" supabase-db:/tmp/storage-objects.sql
docker exec -i supabase-db psql -v ON_ERROR_STOP=0 \
  "postgres://postgres:${POSTGRES_PASSWORD}@localhost:5432/postgres" \
  -f /tmp/storage-objects.sql > "$WORK/storage-import.log" 2>&1 || true
echo "    Хатогиҳо: $(grep -c '^ERROR' "$WORK/storage-import.log" || true) (лог: $WORK/storage-import.log)"

echo "==> 4/4 Restart"
docker restart supabase-storage >/dev/null 2>&1 || (cd "$SUPA_DIR" && docker compose restart storage)
pm2 restart binosoz >/dev/null 2>&1 || true

echo ""
echo "================================================="
echo " Файлҳо ва суратҳо кӯчонида шуданд."
echo "================================================="
