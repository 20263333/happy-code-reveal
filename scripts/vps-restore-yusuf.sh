#!/usr/bin/env bash
# ==============================================================================
# Binosoz.tj — Барқарорсозии пурраи ширкати «Юсуф Бунёдкор» дар Super Admin ва DB
# ==============================================================================
set -euo pipefail

TARGET_EMAIL="${1:-directoryusuf@gmail.com}"

echo "======================================================================"
echo "    Binosoz.tj: Барқарорсозии ширкати «Юсуф Бунёдкор» дар Super Admin "
echo "======================================================================"

if ! docker ps --format '{{.Names}}' | grep -q "^supabase-db$"; then
  echo "[-] Хато: Контейнери 'supabase-db' кор намекунад!"
  exit 1
fi

DB_EXEC="docker exec -i supabase-db psql -U postgres -d postgres"

echo ""
echo "1. ҲОЛАТИ ҲОЗИРАИ ШИРКАТҲО ДАР БАЗА (public.companies):"
echo "----------------------------------------------------------------------"
$DB_EXEC -c "
SELECT 
  id, 
  name, 
  status, 
  COALESCE(is_demo, false) AS is_demo, 
  owner_user_id, 
  subscription_expires_at, 
  created_at
FROM public.companies
ORDER BY created_at DESC;
"

echo ""
echo "2. БАРҚАРОРСОЗӢ ВА ФАЪОЛСОЗИИ ШИРКАТИ «ЮСУФ БУНЁДКОР»:"
echo "----------------------------------------------------------------------"

$DB_EXEC <<SQL
DO \$\$
DECLARE
  v_company_id uuid := NULL;
  v_tariff_id uuid := NULL;
  v_user_id uuid := NULL;
  v_orphan_cid uuid := NULL;
BEGIN
  -- А) Тарифи фаъол
  SELECT id INTO v_tariff_id FROM public.tariffs WHERE is_active = true LIMIT 1;
  IF v_tariff_id IS NULL THEN
    INSERT INTO public.tariffs (name, price, currency, duration_days, is_active, max_projects, max_staff, max_blocks)
    VALUES ('Премиум', 0, 'TJS', 3650, true, 100, 100, 500)
    RETURNING id INTO v_tariff_id;
  END IF;

  -- Б) Ҷустуҷӯи ширкати «Юсуф Бунёдкор» бо ном ё ID-ҳои маълум
  SELECT id INTO v_company_id 
  FROM public.companies 
  WHERE name ILIKE '%Юсуф%' OR name ILIKE '%Бунёдкор%'
     OR id IN ('16bf3148-b2a1-4fcd-99af-7feb7b3629f3'::uuid, '16bf3148-b2c2-4265-837f-12cd7b6e9d57'::uuid)
  LIMIT 1;

  -- В) Агар дар companies набошад, ҷустуҷӯи company_id дар лоиҳаҳо (projects)
  IF v_company_id IS NULL THEN
    SELECT company_id INTO v_orphan_cid 
    FROM public.projects 
    WHERE (name ILIKE '%Юсуф%' OR name ILIKE '%Блок%') 
      AND company_id IS NOT NULL 
    LIMIT 1;

    IF v_orphan_cid IS NOT NULL THEN
      v_company_id := v_orphan_cid;
      RAISE NOTICE 'Ширкат аз руи лоиҳаҳо ёфт шуд: %', v_company_id;
      
      INSERT INTO public.companies (
        id, name, status, is_demo, subscription_tariff_id, subscription_expires_at,
        max_projects, max_staff, max_blocks, created_at, updated_at
      ) VALUES (
        v_company_id, 'Юсуф Бунёдкор', 'active', false, v_tariff_id, now() + interval '5 years',
        100, 100, 500, now(), now()
      ) ON CONFLICT (id) DO UPDATE SET
        name = 'Юсуф Бунёдкор',
        status = 'active',
        is_demo = false,
        subscription_expires_at = now() + interval '5 years',
        updated_at = now();
    ELSE
      -- Эҷоди мустақим бо ID-и маълум
      v_company_id := '16bf3148-b2a1-4fcd-99af-7feb7b3629f3'::uuid;
      INSERT INTO public.companies (
        id, name, status, is_demo, subscription_tariff_id, subscription_expires_at,
        max_projects, max_staff, max_blocks, created_at, updated_at
      ) VALUES (
        v_company_id, 'Юсуф Бунёдкор', 'active', false, v_tariff_id, now() + interval '5 years',
        100, 100, 500, now(), now()
      ) ON CONFLICT (id) DO UPDATE SET
        name = 'Юсуф Бунёдкор',
        status = 'active',
        is_demo = false,
        subscription_expires_at = now() + interval '5 years',
        updated_at = now();
    END IF;
  ELSE
    -- Навсозии ширкати мавҷуда: муҳим аст, ки is_demo = false бошад!
    UPDATE public.companies
    SET 
      name = 'Юсуф Бунёдкор',
      status = 'active',
      is_demo = false,
      subscription_tariff_id = COALESCE(subscription_tariff_id, v_tariff_id),
      subscription_expires_at = now() + interval '5 years',
      max_projects = GREATEST(COALESCE(max_projects, 0), 100),
      max_staff = GREATEST(COALESCE(max_staff, 0), 100),
      max_blocks = GREATEST(COALESCE(max_blocks, 0), 500),
      updated_at = now()
    WHERE id = v_company_id;
  END IF;

  RAISE NOTICE 'Ширкати «Юсуф Бунёдкор» бо ID=% комилан барқарор ва фаъол шуд.', v_company_id;

  -- Г) Бозгардонидани лоиҳаҳо ба ин ширкат (агар ҷудо шуда бошанд)
  UPDATE public.projects 
  SET company_id = v_company_id 
  WHERE (name ILIKE '%Юсуф%' OR name ILIKE '%Блок%') 
    AND (company_id IS NULL OR company_id != v_company_id);

  -- Д) Пайваст кардани соҳиб бо почтаи $TARGET_EMAIL
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower('$TARGET_EMAIL') LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    UPDATE public.companies SET owner_user_id = v_user_id WHERE id = v_company_id;

    INSERT INTO public.profiles (id, company_id, role, updated_at)
    VALUES (v_user_id, v_company_id, 'owner', now())
    ON CONFLICT (id) DO UPDATE 
    SET company_id = v_company_id, role = 'owner', updated_at = now();

    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'owner')
    ON CONFLICT (user_id, role) DO NOTHING;

    UPDATE auth.users 
    SET email_confirmed_at = COALESCE(email_confirmed_at, now())
    WHERE id = v_user_id;

    RAISE NOTICE 'Корбар % (%) ҳамчун соҳиби ширкат сабт шуд.', '$TARGET_EMAIL', v_user_id;
  ELSE
    RAISE NOTICE 'Корбар бо почтаи % дар auth.users ёфт нашуд. Танҳо ширкат фаъол шуд.', '$TARGET_EMAIL';
  END IF;

  -- Е) Боварӣ ҳосил кардан, ки Super Admin тамоми ширкатҳоро дида метавонад (RLS)
  -- Иловаи корбарони админ ба platform_admins
  INSERT INTO public.platform_admins (user_id)
  SELECT id FROM auth.users 
  WHERE lower(email) IN ('aliali18122002@gmail.com', 'admin@binosoz.tj')
  ON CONFLICT (user_id) DO NOTHING;

END \$\$;
SQL

echo ""
echo "3. РӮЙХАТИ ШИРКАТҲО БАЪД АЗ БАРҚАРОРСОЗӢ:"
echo "----------------------------------------------------------------------"
$DB_EXEC -c "
SELECT 
  c.id, 
  c.name, 
  c.status, 
  COALESCE(c.is_demo, false) AS is_demo, 
  u.email AS owner_email,
  (SELECT COUNT(*) FROM public.projects p WHERE p.company_id = c.id) AS projects_count,
  c.subscription_expires_at
FROM public.companies c
LEFT JOIN auth.users u ON u.id = c.owner_user_id
ORDER BY c.created_at DESC;
"

echo ""
echo "4. РӮЙХАТИ ЛОИҲАҲО ВА КВАРТИРАҲОИ ОНҲО:"
echo "----------------------------------------------------------------------"
$DB_EXEC -c "
SELECT 
  p.id, 
  p.name AS project_name, 
  c.name AS company_name, 
  (SELECT COUNT(*) FROM public.apartments a WHERE a.project_id = p.id) AS apartments_count
FROM public.projects p
LEFT JOIN public.companies c ON c.id = p.company_id
ORDER BY p.created_at DESC;
"

echo ""
echo "======================================================================"
echo "[ТАЙЁР] Ширкати «Юсуф Бунёдкор» бомуваффақият барқарор ва фаъол шуд!"
echo "Дар саҳифаи Super Admin (Ширкатҳо) ҳоло ҳамаи ширкатҳо бояд намоён бошанд."
echo "======================================================================"
