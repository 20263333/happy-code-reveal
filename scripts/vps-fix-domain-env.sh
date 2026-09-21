#!/usr/bin/env bash
# Binosoz.tj — switch the app from the raw IP backend to the HTTPS domain backend.
# Run as root on the VPS AFTER https://binosoz.tj works:
#   cd /var/www/binosoz && bash scripts/vps-fix-domain-env.sh
set -euo pipefail

ENV_FILE="/root/binosoz.env"
APP_DIR="/var/www/binosoz"
DOMAIN="binosoz.tj"

echo "==> 1/4 Update ${ENV_FILE}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found."
  exit 1
fi
cp "$ENV_FILE" "${ENV_FILE}.bak.$(date +%s)"

set_env() {
  local key="$1" value="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
  echo "    ${key}=${value}"
}

# Browser talks to the backend through the HTTPS nginx proxy (no mixed content).
set_env VITE_SUPABASE_URL "https://${DOMAIN}/supabase"
# Server-side code keeps talking to the local backend directly.
set_env SUPABASE_URL "http://127.0.0.1:8000"
set_env SITE_URL "https://${DOMAIN}"
set_env VITE_SITE_URL "https://${DOMAIN}"

echo "==> 2/4 Point the backend auth service at the domain"
KONG_ENV="/opt/supabase/docker/.env"
if [[ -f "$KONG_ENV" ]]; then
  sed -i "s|^SITE_URL=.*|SITE_URL=https://${DOMAIN}|" "$KONG_ENV" || true
  sed -i "s|^API_EXTERNAL_URL=.*|API_EXTERNAL_URL=https://${DOMAIN}/supabase|" "$KONG_ENV" || true
  sed -i "s|^SUPABASE_PUBLIC_URL=.*|SUPABASE_PUBLIC_URL=https://${DOMAIN}/supabase|" "$KONG_ENV" || true
  if grep -q '^ADDITIONAL_REDIRECT_URLS=' "$KONG_ENV"; then
    sed -i "s|^ADDITIONAL_REDIRECT_URLS=.*|ADDITIONAL_REDIRECT_URLS=https://${DOMAIN},https://www.${DOMAIN},https://${DOMAIN}/**|" "$KONG_ENV"
  else
    echo "ADDITIONAL_REDIRECT_URLS=https://${DOMAIN},https://www.${DOMAIN},https://${DOMAIN}/**" >> "$KONG_ENV"
  fi
  (cd /opt/supabase/docker && docker compose up -d) || true
  echo "    backend restarted with domain URLs"
else
  echo "    (skip) $KONG_ENV not found"
fi

echo "==> 3/4 Verify the HTTPS backend proxy"
CODE="$(curl -s -o /dev/null -w '%{http_code}' "https://${DOMAIN}/supabase/auth/v1/health" || true)"
echo "    https://${DOMAIN}/supabase/auth/v1/health -> ${CODE}"
if [[ "$CODE" != "200" ]]; then
  echo "    WARNING: proxy not answering yet. Run: bash scripts/vps-setup-domain.sh"
fi

echo "==> 4/4 Rebuild and restart the app"
cd "$APP_DIR"
bash scripts/deploy-vps.sh

echo ""
echo "================================================="
echo " Done. Open https://${DOMAIN} and sign in."
echo " Hard refresh the browser: Ctrl+Shift+R"
echo "================================================="
