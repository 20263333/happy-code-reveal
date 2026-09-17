#!/usr/bin/env bash
# PLATFORM.TJ — migrate Lovable Cloud data to the self-hosted VPS Supabase
# Run on the VPS as root after scripts/vps-install.sh finished successfully.
# IMPORTANT: you need a PostgreSQL dump from Lovable Cloud to restore.
set -euo pipefail

SERVER_IP="187.77.87.133"
SUPA_DIR="/opt/supabase"
CREDS="/root/supabase-credentials.txt"
DUMP_FILE="${1:-/root/lovable-cloud-dump.sql}"

echo "================================================="
echo " PLATFORM.TJ VPS Migration Helper"
echo "================================================="

if [[ ! -f "$CREDS" ]]; then
  echo "ERROR: $CREDS not found. Run scripts/vps-install.sh first."
  exit 1
fi

if [[ ! -f "$DUMP_FILE" ]]; then
  echo "ERROR: Dump file not found: $DUMP_FILE"
  echo ""
  echo "You need a PostgreSQL dump of your Lovable Cloud database."
  echo "Lovable Cloud does not expose the database password directly;"
  echo "contact Lovable support or use any export feature they provide."
  echo ""
  echo "If you only have the Supabase service role key, you can export"
  echo "data row-by-row via the REST API, but that is partial."
  exit 1
fi

echo "==> 1/4 Read self-hosted credentials"
POSTGRES_PASSWORD=$(grep "^Postgres password:" "$CREDS" | awk -F': ' '{print $2}')

echo "==> 2/4 Stop app during migration"
pm2 stop binosoz 2>/dev/null || true

echo "==> 3/4 Restore database dump"
# Supabase Postgres runs inside Docker on port 5432
docker cp "$DUMP_FILE" supabase-db:/tmp/restore.sql
docker exec -i supabase-db psql \
  "postgres://postgres:${POSTGRES_PASSWORD}@localhost:5432/postgres" \
  -f /tmp/restore.sql

echo "==> 4/4 Restart app"
pm2 start binosoz 2>/dev/null || pm2 restart binosoz

echo ""
echo "================================================="
echo " Migration complete."
echo " Supabase Studio: http://${SERVER_IP}:8000"
echo " App:             http://${SERVER_IP}"
echo "================================================="
