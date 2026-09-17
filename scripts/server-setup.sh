#!/usr/bin/env bash
# One-time server setup for RuVDS (Ubuntu 22.04+)
# Usage: ssh root@45.132.18.93, then run this script
set -euo pipefail

APP_DIR="/var/www/binosoz"
APP_PORT="3000"

echo "==> Updating system"
apt update && apt upgrade -y

echo "==> Installing base packages"
apt install -y curl git ufw nginx fail2ban unzip rsync

echo "==> Installing Bun"
curl -fsSL https://bun.sh/install | bash
export PATH="$HOME/.bun/bin:$PATH"
echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.bashrc

echo "==> Installing PM2"
npm i -g pm2 || (curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt install -y nodejs && npm i -g pm2)

echo "==> Firewall (UFW)"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "==> Fail2ban"
systemctl enable --now fail2ban

echo "==> App directory"
mkdir -p "$APP_DIR"
chown -R root:root "$APP_DIR"

echo "==> Nginx reverse proxy"
cat > /etc/nginx/sites-available/binosoz <<NGINX
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/binosoz /etc/nginx/sites-enabled/binosoz
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
systemctl enable nginx

echo "==> PM2 startup on boot"
pm2 startup systemd -u root --hp /root | tail -n 1 | bash || true

echo ""
echo "================================================="
echo "Server is ready. Next: add the deploy SSH key to"
echo "/root/.ssh/authorized_keys (see instructions)."
echo "When you buy a domain, run: certbot --nginx -d yourdomain.tj"
echo "================================================="
