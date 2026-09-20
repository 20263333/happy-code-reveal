#!/usr/bin/env bash
# Binosoz.tj — VPS bootstrap (Hostinger KVM 2, Ubuntu 24.04)
# Server: 31.97.37.138
# Run as root:  bash /root/vps-install.sh
# Installs: Docker + self-hosted Supabase + Bun + PM2 + Nginx + firewall
set -euo pipefail

SERVER_IP="31.97.37.138"
APP_DIR="/var/www/binosoz"
SUPA_DIR="/opt/supabase"
APP_PORT="3000"

echo "==> 1/8 System update & packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y \
  apt-transport-https ca-certificates curl gnupg lsb-release \
  software-properties-common git nginx ufw fail2ban unzip \
  pwgen openssl cron rsync

echo "==> 2/8 Docker & Compose"
install -m 0755 -d /etc/apt/keyrings
rm -f /etc/apt/keyrings/docker.gpg
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --batch --yes --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker

echo "==> 3/8 Self-hosted Supabase"
mkdir -p "$SUPA_DIR"
cd "$SUPA_DIR"
if [ ! -d "$SUPA_DIR/.git" ]; then
  git clone --depth 1 https://github.com/supabase/supabase.git "$SUPA_DIR"
fi
cd "$SUPA_DIR/docker"

cp -f .env.example .env
POSTGRES_PASSWORD=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 32)
JWT_SECRET=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 48)
DASHBOARD_PASSWORD=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 16)

# Supabase API keys must be HS256 JWTs signed with JWT_SECRET
b64url() { openssl base64 -e -A | tr '+/' '-_' | tr -d '='; }
gen_jwt() {
  local payload="$1" secret="$2"
  local header payload_b64 sig
  header=$(printf '%s' '{"alg":"HS256","typ":"JWT"}' | b64url)
  payload_b64=$(printf '%s' "$payload" | b64url)
  sig=$(printf '%s' "${header}.${payload_b64}" | openssl dgst -sha256 -hmac "$secret" -binary | b64url)
  printf '%s' "${header}.${payload_b64}.${sig}"
}
ANON_KEY=$(gen_jwt '{"role":"anon","iss":"supabase","iat":1750000000,"exp":2050000000}' "$JWT_SECRET")
SERVICE_ROLE_KEY=$(gen_jwt '{"role":"service_role","iss":"supabase","iat":1750000000,"exp":2050000000}' "$JWT_SECRET")

set_env() { # set_env KEY VALUE — safe replace in .env
  local key="$1" value="$2"
  if grep -q "^${key}=" .env; then
    sed -i "s|^${key}=.*|${key}=${value}|" .env
  else
    echo "${key}=${value}" >> .env
  fi
}
set_env POSTGRES_PASSWORD "$POSTGRES_PASSWORD"
set_env JWT_SECRET "$JWT_SECRET"
set_env ANON_KEY "$ANON_KEY"
set_env SERVICE_ROLE_KEY "$SERVICE_ROLE_KEY"
set_env DASHBOARD_USERNAME "supabase"
set_env DASHBOARD_PASSWORD "$DASHBOARD_PASSWORD"
set_env SITE_URL "http://${SERVER_IP}:8000"
set_env API_EXTERNAL_URL "http://${SERVER_IP}:8000"
set_env SUPABASE_PUBLIC_URL "http://${SERVER_IP}:8000"
set_env KONG_HTTP_PORT "8000"
set_env KONG_HTTPS_PORT "8443"

docker compose pull
docker compose up -d

echo "==> 4/8 Save credentials"
mkdir -p /root
cat > /root/supabase-credentials.txt <<EOF
Binosoz.tj VPS bootstrap credentials
=====================================
Server IP: ${SERVER_IP}
Supabase Studio: http://${SERVER_IP}:8000
Studio user: supabase
Studio pass: ${DASHBOARD_PASSWORD}
Postgres password: ${POSTGRES_PASSWORD}
JWT secret: ${JWT_SECRET}
Anon key: ${ANON_KEY}
Service role key: ${SERVICE_ROLE_KEY}
=====================================
EOF
chmod 600 /root/supabase-credentials.txt

echo "==> 5/8 Bun + Node.js + PM2"
curl -fsSL https://bun.sh/install | bash
export BUN_INSTALL="/root/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
echo 'export BUN_INSTALL="/root/.bun"' >> /root/.bashrc
echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> /root/.bashrc
bun --version

# Install Node.js 22 (includes npm) — PM2 and the Vite build need it
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
node --version
npm --version
npm install -g pm2

echo "==> 6/8 App directory"
mkdir -p "$APP_DIR"
touch "$APP_DIR/.placeholder"

echo "==> 7/8 Nginx reverse proxy"
cat > /etc/nginx/sites-available/binosoz <<'NGINX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }
}
NGINX
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/binosoz /etc/nginx/sites-enabled/binosoz
nginx -t && systemctl restart nginx
systemctl enable nginx

echo "==> 8/8 Firewall, fail2ban & PM2 startup"
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw allow 8000/tcp comment 'Supabase Studio temporary'
ufw --force enable
systemctl enable --now fail2ban
pm2 startup systemd -u root --hp /root 2>/dev/null | tail -n 1 | bash || true

echo ""
echo "================================================="
echo "Bootstrap complete."
echo "Supabase Studio: http://${SERVER_IP}:8000"
echo "Credentials:     /root/supabase-credentials.txt"
echo "App dir:         ${APP_DIR}"
echo "Next steps:"
echo "  1. Create /root/binosoz.env from .env.vps.example"
echo "  2. Migrate database (see scripts/migrate-to-vps.sh)"
echo "  3. Deploy app (see scripts/deploy-vps.sh)"
echo "================================================="
