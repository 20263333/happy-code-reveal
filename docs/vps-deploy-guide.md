# Роҳнамои пурраи VPS Deployment — Binosoz.tj

Сервер: `187.77.87.133` | Домен: `binosoz.tj`

## Қадам 1: Bootstrap сервер (як бор)

Агар аллакай иҷро шуда бошад, ин қадамро гузаред.

```bash
# Дар сервер ҳамчун root:
cd /var/www/binosoz
bash scripts/vps-install.sh
```

Ин скрипт Docker, Supabase-и худӣ, Bun, PM2, Nginx-ро насб мекунад.
Маълумоти махфӣ дар `/root/supabase-credentials.txt` сабт мешавад.

## Қадам 2: Файли муҳити сервер

Файли `/root/binosoz.env` аз `.env.vps.example` созед ва арзишҳоро пур кунед:

```bash
cp /var/www/binosoz/.env.vps.example /root/binosoz.env
nano /root/binosoz.env
```

### Арзишҳое, ки аз `/root/supabase-credentials.txt` гирида мешаванд:

```
VITE_SUPABASE_URL=https://binosoz.tj/supabase
VITE_SUPABASE_PUBLISHABLE_KEY=<anon-key аз credentials>
VITE_SUPABASE_PROJECT_ID=local

SUPABASE_URL=http://127.0.0.1:8000
SUPABASE_PUBLISHABLE_KEY=<anon-key аз credentials>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key аз credentials>
```

### Арзишҳое, ки худкор сохта шудаанд (намуна):

```
SESSION_SECRET=Ww7em3iTCV4b5W5w67ZnE3pITj6D0GdYvXgGB8C4
SMS_CRON_SECRET=6f7124c27b68525471ce39d426529d233023c1e44ef91a1e
MARKETPLACE_SYNC_SECRET=da23e97ab657589ac29ab639f4e9bfc263ec283e920ff696
MIGRATION_EXPORT_SECRET=binosoz-vps-export-2026-7c4a9e3f1b8d5
```

> ⚠️ Ин арзишҳоро бо `openssl rand -base64 32` ё `openssl rand -hex 24` иваз кунед барои амният.

### Арзишҳое, ки шумо бояд пур кунед:

```
OPENAI_API_KEY=<калиди OpenAI-и шумо>
LOVABLE_API_KEY=<агар AI-ассистент лозим аст>
LOVABLE_AI_GATEWAY_KEY=<агар AI Gateway лозим аст>

# OSON SMS (аз қабулкунандаи OsonSMS)
OSON_SMS_LOGIN=
OSON_SMS_PASSWORD=
OSON_SMS_BRAND=

# WhatsApp (Wappi.pro)
WAPPI_API_KEY=
WAPPI_API_URL=https://wappi.pro

# Sharora webhook (агар лозим аст)
SHARORA_WEBHOOK_URL=
SHARORA_WEBHOOK_SECRET=

# Funnel sync
FUNNEL_SYNC_URL=

# Google OAuth
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
```

### Арзишҳои пешфарз (дар deploy-vps.sh):

```
SALES_PARTNER_WEBHOOK_URL=https://fz.binosoz.tj/api/public/platform-sales-webhook
SALES_PARTNER_WEBHOOK_SECRET=platform-tj-sales-partner-2026-8f3c1a94b7e24d6fa05c9b31e7d24f60
```

## Қадам 3: Коди барномаро ба сервер бор кунед

```bash
# Роҳи 1: аз Git
cd /var/www/binosoz
git pull  # ё git clone <repo> .

# Роҳи 2: rsync аз компютери шумо
rsync -avz --exclude node_modules --exclude .git --exclude dist --exclude .output \
  ./ root@187.77.87.133:/var/www/binosoz/
```

## Қадам 4: Сохтори базаи маълумотро созед

```bash
bash scripts/apply-migrations-vps.sh
```

Ин ҳамаи таблицаҳо, enum-ҳо, RLS-ҳо ва функсияҳоро месозад (бе нест кардани маълумот).

## Қадам 5: Маълумотро аз Lovable Cloud кӯчонед (ихтиёрӣ)

Агар маълумоти мавҷуда аз Lovable Cloud лозим бошад:

```bash
# 1. Экспорти SQL
curl -H "x-export-secret: binosoz-vps-export-2026-7c4a9e3f1b8d5" \
  https://id-preview--05063add-15a4-464f-a615-3736bcb0d125.lovable.app/api/public/export/database \
  -o /root/cloud-dump.sql

# 2. Ворид кардан ба базаи VPS
docker exec -i supabase-db psql \
  "postgres://postgres:<POSTGRES_PASSWORD>@localhost:5432/postgres" \
  < /root/cloud-dump.sql

# 3. Экспорти файлҳои storage
curl -H "x-export-secret: binosoz-vps-export-2026-7c4a9e3f1b8d5" \
  https://id-preview--05063add-15a4-464f-a615-3736bcb0d125.lovable.app/api/public/export/storage \
  -o /root/storage-list.txt
# Баъд ҳар файлро аз URL-ҳои имзошуда бор карда, ба Supabase-и худӣ upload кунед
```

## Қадам 6: Барномаро созед ва оғоз кунед

```bash
bash scripts/deploy-vps.sh
```

Ин скрипт:
1. Захираҳоро насб мекунад (`bun install`)
2. Build мекунад (`bun run build:vps` — node-server preset)
3. PM2-ро оғоз мекунад (`pm2 start scripts/node-adapter.mjs`)

## Қадам 7: HTTPS-ро фаъол кунед

```bash
# Certbot-ро насб кунед
apt install -y certbot python3-certbot-nginx
certbot --nginx -d binosoz.tj -d www.binosoz.tj
```

## Санҷиш

```bash
# Барнома кор мекунад?
curl -sf https://binosoz.tj/ | head -5

# Логҳо
pm2 logs binosoz

# Статус
pm2 status
```

## Мушкилсозӣ

```bash
# Логҳои барнома
pm2 logs binosoz --lines 50

# Логҳои Supabase
docker logs supabase-db --tail 50
docker logs supabase-kong --tail 50

# Аз нав оғоз кардан
pm2 restart binosoz

# Аз нав оғоз кардани Supabase
cd /opt/supabase/docker && docker compose restart
```
