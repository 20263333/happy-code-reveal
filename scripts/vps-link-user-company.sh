#!/usr/bin/env bash
# Binosoz.tj — Пайваст кардан ё барқарор кардани ширкат ба корбар
set -euo pipefail

TARGET_EMAIL="${1:-}"
COMPANY_NAME_INPUT="${2:-}"

if [ -z "$TARGET_EMAIL" ]; then
  echo "Истифода: bash scripts/vps-link-user-company.sh <email> [номи_ширкат]"
  echo "Мисол:    bash scripts/vps-link-user-company.sh aliali18122002@gmail.com"
  exit 1
fi

DB_EXEC="docker exec -i supabase-db psql -U postgres -d postgres"

echo "===> Санҷиши корбар бо email: $TARGET_EMAIL"

USER_ID=$($DB_EXEC -t -A -c "SELECT id FROM auth.users WHERE LOWER(email) = LOWER('$TARGET_EMAIL') LIMIT 1;" 2>/dev/null || true)

if [ -z "$USER_ID" ]; then
  echo "[-] Корбар бо почтаи '$TARGET_EMAIL' дар база ёфт нашуд!"
  echo ""
  echo "Рӯйхати корбарони мавҷуда дар система:"
  $DB_EXEC -c "SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC;" 2>/dev/null || true
  exit 1
fi

echo "[+] Корбар ёфт шуд: ID = $USER_ID"

# 1. Ҷустуҷӯи ширкати охирин ё ширкате, ки лоиҳа дорад
COMPANY_ID=$($DB_EXEC -t -A -c "
SELECT id FROM public.companies 
ORDER BY 
  (SELECT COUNT(*) FROM public.projects WHERE company_id = companies.id) DESC,
  created_at DESC 
LIMIT 1;
" 2>/dev/null || true)

# Агар ширкат умуман дар public.companies набошад, санҷем оё дар projects company_id ҳаст
if [ -z "$COMPANY_ID" ]; then
  ORPHAN_COMPANY_ID=$($DB_EXEC -t -A -c "SELECT company_id FROM public.projects WHERE company_id IS NOT NULL LIMIT 1;" 2>/dev/null || true)
  
  if [ -n "$ORPHAN_COMPANY_ID" ]; then
    echo "[!] Дар ҷадвали projects маълумот бо company_id='$ORPHAN_COMPANY_ID' ёфт шуд. Ин ширкатро барқарор мекунем..."
    NEW_NAME="${COMPANY_NAME_INPUT:-Binosoz}"
    $DB_EXEC -c "
    INSERT INTO public.companies (id, name, owner_user_id, status)
    VALUES ('$ORPHAN_COMPANY_ID', '$NEW_NAME', '$USER_ID', 'active')
    ON CONFLICT (id) DO UPDATE SET owner_user_id = '$USER_ID', status = 'active';
    "
    COMPANY_ID="$ORPHAN_COMPANY_ID"
  else
    echo "[!] Ягон ширкат ёфт нашуд. Ширкати нав сохта истодаем..."
    NEW_NAME="${COMPANY_NAME_INPUT:-Binosoz}"
    COMPANY_ID=$($DB_EXEC -t -A -c "
    INSERT INTO public.companies (name, owner_user_id, status)
    VALUES ('$NEW_NAME', '$USER_ID', 'active')
    RETURNING id;
    ")
  fi
fi

echo "[+] Ширкати мақсаднок: ID = $COMPANY_ID"

# 2. Пайваст кардани ширкат ба корбар ҳамчун Owner
echo "===> Пайваст кардани ҳуқуқи Owner ва ширкат ба корбар..."
$DB_EXEC -c "
-- 1. Танзими owner_user_id дар companies
UPDATE public.companies 
SET owner_user_id = '$USER_ID', status = 'active', updated_at = now()
WHERE id = '$COMPANY_ID';

-- 2. Танзими profiles
INSERT INTO public.profiles (id, company_id, role, updated_at)
VALUES ('$USER_ID', '$COMPANY_ID', 'owner', now())
ON CONFLICT (id) DO UPDATE 
SET company_id = '$COMPANY_ID', role = 'owner', updated_at = now();

-- 3. Танзими user_roles
INSERT INTO public.user_roles (user_id, role)
VALUES ('$USER_ID', 'owner')
ON CONFLICT (user_id, role) DO NOTHING;

-- 4. Тасдиқи email дар auth.users (агар тасдиқ нашуда бошад)
UPDATE auth.users 
SET email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE id = '$USER_ID';
"

echo ""
echo "========================================================"
echo "[SUCCESS] Корбар ва ширкат бомуваффақият барқарор ва пайваст шуданд!"
echo "Корбар:  $TARGET_EMAIL ($USER_ID)"
echo "Ширкат:  $COMPANY_ID"
echo "Нақш:    Owner (Соҳиби ширкат)"
echo "Ҳолат:   Фаъол (Active)"
echo "========================================================"
echo "Ҳоло метавонед ба сайт даромада, бо ин почта ворид шавед."
