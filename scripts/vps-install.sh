#!/usr/bin/env bash
# PLATFORM.TJ — VPS bootstrap (Hostinger KVM 2, Ubuntu 24.04)
# Server: 187.77.87.133
# Run as root:  bash /root/vps-install.sh
# Installs: Docker + self-hosted Supabase + Bun + PM2 + Nginx + firewall
set -euo pipefail

SERVER_IP="187.77.87.133"
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
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
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

cp .env.example .env
POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)
JWT_SECRET=$(openssl rand -base64 32)
ANON_KEY=$(openssl rand -base64 32)
SERVICE_ROLE_KEY=$(openssl rand -base64 32)
DASHBOARD_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 16)

sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${POSTGRES_PASSWORD}/" .env
sed -i "s/^JWT_SECRET=.*/JWT_SECRET=${JWT_SECRET}/" .env
sed -i "s/^ANON_KEY=.*/ANON_KEY=${ANON_KEY}/" .env
sed -i "s/^SERVICE_ROLE_KEY=.*/SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}/" .env
sed -i "s/^DASHBOARD_USERNAME=.*/DASHBOARD_USERNAME=supabase/" .env
sed -i "s/^DASHBOARD_PASSWORD=.*/DASHBOARD_PASSWORD=${DASHBOARD_PASSWORD}/" .env
sed -i "s/^SITE_URL=.*/SITE_URL=http:\/\/${SERVER_IP}:8000/" .env
sed -i "s/^API_EXTERNAL_URL=.*/API_EXTERNAL_URL=http:\/\/${SERVER_IP}:8000/" .env
sed -i "s/^SUPABASE_PUBLIC_URL=.*/SUPABASE_PUBLIC_URL=http:\/\/${SERVER_IP}:8000/" .env
sed -i "s/^KONG_HTTP_PORT=.*/KONG_HTTP_PORT=8000/" .env
sed -i "s/^KONG_HTTPS_PORT=.*/KONG_HTTPS_PORT=8443/" .env

docker compose pull
docker compose up -d

echo "==> 4/8 Save credentials"
mkdir -p /root
cat > /root/supabase-credentials.txt <<EOF
PLATFORM.TJ VPS bootstrap credentials
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

echo "==> 5/8 Bun + PM2"
curl -fsSL https://bun.sh/install | bash
export BUN_INSTALL="/root/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
echo 'export BUN_INSTALL="/root/.bun"' >> /root/.bashrc
echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> /root/.bashrc
bun --version
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
