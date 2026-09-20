#!/bin/bash
# Binosoz.tj — автоматически создаёт /root/binosoz.env из /root/supabase-credentials.txt
set -euo pipefail

CREDS=/root/supabase-credentials.txt
ENV_FILE=/root/binosoz.env

if [[ ! -f "$CREDS" ]]; then
  echo "ХАТО: $CREDS не найден. Сначала запустите scripts/vps-install.sh"
  exit 1
fi

ANON_KEY=$(grep 'Anon key:' "$CREDS" | awk '{print $3}')
SERVICE_KEY=$(grep 'Service role key:' "$CREDS" | awk '{print $4}')

if [[ -z "$ANON_KEY" || -z "$SERVICE_KEY" ]]; then
  echo "ХАТО: не удалось прочитать ключи из $CREDS"
  exit 1
fi

SESSION_SECRET=$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 48)
SMS_SECRET=$(openssl rand -hex 24)
MKT_SECRET=$(openssl rand -hex 24)

cat > "$ENV_FILE" <<EOF
VITE_SUPABASE_URL=https://binosoz.tj/supabase
VITE_SUPABASE_PUBLISHABLE_KEY=${ANON_KEY}
VITE_SUPABASE_PROJECT_ID=local
SUPABASE_URL=http://127.0.0.1:8000
SUPABASE_PUBLISHABLE_KEY=${ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_KEY}
SESSION_SECRET=${SESSION_SECRET}
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
SMS_CRON_SECRET=${SMS_SECRET}
MARKETPLACE_SYNC_SECRET=${MKT_SECRET}
LOVABLE_AI_GATEWAY_KEY=
LOVABLE_API_KEY=
EOF

chmod 600 "$ENV_FILE"
echo "OK: $ENV_FILE создан."
echo "--- первые строки для проверки ---"
head -n 3 "$ENV_FILE"
