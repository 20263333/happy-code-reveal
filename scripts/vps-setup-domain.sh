#!/usr/bin/env bash
# Configure nginx + Let's Encrypt SSL for binosoz.tj on the VPS.
# Run as root on 31.97.37.138 after DNS A records point to this server.
set -euo pipefail

DOMAIN="binosoz.tj"
WWW_DOMAIN="www.binosoz.tj"
APP_PORT="3000"
NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}"

echo "==> 1/6 Check DNS for ${DOMAIN}"
VPS_IP="$(curl -s -4 -m 5 ifconfig.me || true)"
if [[ -z "$VPS_IP" ]]; then
  VPS_IP="31.97.37.138"
fi
echo "    VPS public IP: $VPS_IP"

resolve_ip() {
  getent hosts "$1" 2>/dev/null | awk '{print $1}' | head -1 || true
}
DOMAIN_IP="$(resolve_ip "$DOMAIN")"
echo "    ${DOMAIN} resolves to: ${DOMAIN_IP:-<not yet>}"

if [[ -n "$DOMAIN_IP" && "$DOMAIN_IP" != "$VPS_IP" ]]; then
  echo "WARNING: ${DOMAIN} still points to ${DOMAIN_IP}, not ${VPS_IP}."
  echo "         DNS propagation may take a few minutes. SSL step may fail."
  echo "         Continuing anyway — rerun this script later if certbot fails."
fi

echo "==> 2/6 Install nginx and certbot (if missing)"
if ! command -v nginx >/dev/null 2>&1; then
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nginx
fi
if ! command -v certbot >/dev/null 2>&1; then
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq certbot python3-certbot-nginx
fi

echo "==> 3/6 Write nginx config for ${DOMAIN}"
mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
cat > "$NGINX_CONF" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} ${WWW_DOMAIN};

    # Redirect www -> root domain (optional, comment out to keep www)
    # return 301 \$scheme://${DOMAIN}\$request_uri;

    client_max_body_size 50M;

    location /supabase/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
EOF
ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/${DOMAIN}"
# Remove default site that conflicts on port 80
rm -f /etc/nginx/sites-enabled/default

echo "==> 4/6 Test nginx config and reload"
nginx -t
systemctl reload nginx || systemctl restart nginx

echo "==> 5/6 Wait for DNS to resolve to this VPS (up to 5 min)"
for i in $(seq 1 30); do
  IP_NOW="$(resolve_ip "$DOMAIN")"
  if [[ -n "$IP_NOW" && "$IP_NOW" == "$VPS_IP" ]]; then
    echo "    ${DOMAIN} now resolves to ${VPS_IP} — OK"
    break
  fi
  echo "    (attempt $i/30) still ${IP_NOW:-<no answer>}, waiting 10s..."
  sleep 10
done

echo "==> 6/6 Obtain Let's Encrypt SSL certificate"
IP_NOW="$(resolve_ip "$DOMAIN")"
if [[ -z "$IP_NOW" || "$IP_NOW" != "$VPS_IP" ]]; then
  echo ""
  echo "WARNING: ${DOMAIN} does not resolve to ${VPS_IP} yet."
  echo "         Skip SSL for now. HTTP works via http://${DOMAIN}."
  echo "         Once DNS propagates, rerun: bash scripts/vps-setup-domain.sh"
  echo ""
  echo "================================================="
  echo " Done (HTTP only). Open: http://${DOMAIN}"
  echo " SSL: rerun this script after DNS propagates."
  echo "================================================="
  exit 0
fi

certbot --nginx -d "${DOMAIN}" -d "${WWW_DOMAIN}" \
  --non-interactive --agree-tos --register-unsafely-without-email \
  --redirect || {
    echo ""
    echo "certbot failed. HTTP is working on http://${DOMAIN}."
    echo "Rerun this script once DNS fully propagates."
    exit 1
  }

# Ensure HTTPS-only with HSTS for the app
cat > "$NGINX_CONF" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} ${WWW_DOMAIN};
    return 301 https://${DOMAIN}\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${WWW_DOMAIN};
    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    return 301 https://${DOMAIN}\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN};

    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    client_max_body_size 50M;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location /supabase/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
EOF
nginx -t
systemctl reload nginx

# Auto-renew cron
( crontab -l 2>/dev/null | grep -v 'certbot renew' ; echo '0 3 * * * certbot renew --quiet --post-hook "systemctl reload nginx"' ) | crontab -

echo ""
echo "================================================="
echo " Done! Domain configured with HTTPS."
echo " Open: https://${DOMAIN}"
echo " WWW redirects to root, HTTP redirects to HTTPS."
echo " SSL auto-renews daily at 03:00."
echo "================================================="
