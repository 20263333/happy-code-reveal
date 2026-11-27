#!/usr/bin/env bash
# Фаъолсозии ширкати «Юсуф Бунёдкор» ва пайваст кардани соҳиб
set -euo pipefail

COMPANY_ID="16bf3148-b2a1-4fcd-99af-7feb7b3629f3"
EMAIL_PARAM="${1:-directoryusuf@gmail.com}"

echo "===> Фаъолсозии ширкати 'Юсуф Бунёдкор' ($COMPANY_ID)..."
echo "===> Соҳиби ширкат (эмейл): $EMAIL_PARAM"

docker exec -i supabase-db psql -U postgres -d postgres <<SQL
DO \$\$
DECLARE
  v_tariff_id uuid;
  v_user_id uuid;
BEGIN
  -- 1. Гирифтани ё сохтани тарифи фаъол
  SELECT id INTO v_tariff_id FROM public.tariffs WHERE is_active = true LIMIT 1;
  IF v_tariff_id IS NULL THEN
    INSERT INTO public.tariffs (name, price, currency, duration_days, is_active, max_projects, max_staff, max_blocks)
    VALUES ('Премиум', 0, 'TJS', 3650, true, 100, 100, 500)
    RETURNING id INTO v_tariff_id;
  END IF;

  -- 2. Фаъол кардани худи ширкат ва муҳлати обуна
  UPDATE public.companies
  SET 
    status = 'active',
    subscription_tariff_id = COALESCE(subscription_tariff_id, v_tariff_id),
    subscription_expires_at = now() + interval '5 years',
    max_projects = GREATEST(max_projects, 50),
    max_staff = GREATEST(max_staff, 50),
    max_blocks = GREATEST(max_blocks, 100),
    updated_at = now()
  WHERE id = '$COMPANY_ID';

  -- 3. Ҷустуҷӯи корбар бо эмейли додашуда
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower('$EMAIL_PARAM') LIMIT 1;
  
  IF v_user_id IS NOT NULL THEN
    -- Танзими соҳиби ширкат
    UPDATE public.companies SET owner_user_id = v_user_id WHERE id = '$COMPANY_ID';

    -- Танзими profiles
    INSERT INTO public.profiles (id, company_id, role, updated_at)
    VALUES (v_user_id, '$COMPANY_ID', 'owner', now())
    ON CONFLICT (id) DO UPDATE 
    SET company_id = '$COMPANY_ID', role = 'owner', updated_at = now();

    -- Танзими user_roles
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'owner')
    ON CONFLICT (user_id, role) DO NOTHING;

    -- Тасдиқи эмейл
    UPDATE auth.users 
    SET email_confirmed_at = COALESCE(email_confirmed_at, now())
    WHERE id = v_user_id;

    RAISE NOTICE 'Корбар % (%) ҳамчун соҳиби ширкат таъин шуд.', '$EMAIL_PARAM', v_user_id;
  ELSE
    RAISE NOTICE 'Огоҳӣ: Корбар бо эмейли % дар auth.users ёфт нашуд. Танҳо ширкат фаъол шуд.', '$EMAIL_PARAM';
  END IF;
END \$\$;
SQL

echo ""
echo "========================================================"
echo " ҲОЛАТИ НАВИ ШИРКАТ:"
echo "========================================================"
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT 
  id, 
  name, 
  status, 
  owner_user_id, 
  subscription_expires_at, 
  max_projects, 
  max_staff 
FROM public.companies 
WHERE id = '$COMPANY_ID';
"
echo "Ширкат фаъол шуд!"
