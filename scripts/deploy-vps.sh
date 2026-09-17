#!/usr/bin/env bash
# PLATFORM.TJ — deploy the app on the VPS (run as root on 187.77.87.133)
set -euo pipefail

APP_DIR="/var/www/binosoz"
APP_PORT="3000"
ENV_FILE="/root/binosoz.env"

echo "==> 1/5 Ensure app directory exists"
mkdir -p "$APP_DIR"

echo "==> 2/5 Load environment"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found. Create it first (see .env.vps.example)."
  exit 1
fi
set -a
source "$ENV_FILE"
set +a

# The Sales Partner receiver has stable built-in defaults. Export them for PM2
# when the VPS env file still contains empty values, so background sync starts
# immediately after deployment without a Super Admin settings screen.
export SALES_PARTNER_WEBHOOK_URL="${SALES_PARTNER_WEBHOOK_URL:-https://fz.platform.tj/api/public/platform-sales-webhook}"
export SALES_PARTNER_WEBHOOK_SECRET="${SALES_PARTNER_WEBHOOK_SECRET:-platform-tj-sales-partner-2026-8f3c1a94b7e24d6fa05c9b31e7d24f60}"

echo "==> 3/5 Install dependencies"
cd "$APP_DIR"
export PATH="$HOME/.bun/bin:$PATH"
bun install --frozen-lockfile

echo "==> 4/5 Build for VPS"
# Make sure swap exists so the bundler does not run out of memory on 8 GB VPS
if ! swapon --show | grep -q .; then
  echo "    (creating 4G swapfile)"
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

rm -rf dist .output .wrangler
export NODE_OPTIONS="--max-old-space-size=6144"
bun run build:vps

echo "==> 5/5 Start with PM2"
pm2 delete binosoz 2>/dev/null || true
pm2 start scripts/node-adapter.mjs --name binosoz --update-env
pm2 save


echo ""
echo "================================================="
echo " App deployed."
echo " Local:    http://127.0.0.1:${APP_PORT}"
echo " Public:   https://platform.tj"
echo " Sync:     Sales Partner every 3 seconds"
echo " PM2:      pm2 status"
echo " Logs:     pm2 logs binosoz"
echo "================================================="
