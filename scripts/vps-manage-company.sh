#!/usr/bin/env bash
# Binosoz.tj — Барқарорсозӣ ва тафтиши ширкат (Company diagnostics & recovery)
set -euo pipefail

echo "========================================================"
echo "    Binosoz.tj — Тафтиши вазъи ширкатҳо ва корбарон     "
echo "========================================================"
echo ""

# 1. Санҷиши пайвастшавӣ ба контейнери PostgreSQL
if ! docker ps --format '{{.Names}}' | grep -q "^supabase-db$"; then
  echo "[-] Хато: Контейнери 'supabase-db' кор намекунад!"
  echo "    Санҷед: docker ps -a"
  exit 1
fi

DB_EXEC="docker exec -i supabase-db psql -U postgres -d postgres"

echo "1. РӮЙХАТИ ШИРКАТҲО ДАР БАЗА (public.companies):"
echo "--------------------------------------------------------"
$DB_EXEC -c "
SELECT 
  c.id, 
  c.name, 
  c.status,
  c.owner_user_id,
  u.email AS owner_email,
  (SELECT COUNT(*) FROM public.projects p WHERE p.company_id = c.id) AS projects_count,
  (SELECT COUNT(*) FROM public.customers cust WHERE cust.company_id = c.id) AS customers_count,
  c.created_at
FROM public.companies c
LEFT JOIN auth.users u ON u.id = c.owner_user_id
ORDER BY c.created_at DESC;
" 2>/dev/null || echo "Ҷадвали companies дастрас нест ё холӣ аст."

echo ""
echo "2. РӮЙХАТИ КОРБАРОН ДАР СИСТЕМА (auth.users & profiles):"
echo "--------------------------------------------------------"
$DB_EXEC -c "
SELECT 
  u.id, 
  u.email, 
  p.fullname, 
  p.role,
  p.company_id,
  c.name AS profile_company_name,
  u.created_at
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
LEFT JOIN public.companies c ON c.id = p.company_id
ORDER BY u.created_at DESC;
" 2>/dev/null || echo "Маълумоти корбарон дастрас нест."

echo ""
echo "3. САНҶИШИ ЛОИҲАҲО (projects) ВА ШИРКАТҲОИ ОНҲО:"
echo "--------------------------------------------------------"
$DB_EXEC -c "
SELECT 
  p.id, 
  p.name AS project_name, 
  p.company_id, 
  c.name AS company_name,
  (SELECT COUNT(*) FROM public.apartments a WHERE a.project_id = p.id) AS apartments_count
FROM public.projects p
LEFT JOIN public.companies c ON c.id = p.company_id
ORDER BY p.created_at DESC
LIMIT 10;
" 2>/dev/null || echo "Лоиҳаҳо ёфт нашуданд."

echo ""
echo "4. САБТҲОИ НЕСТШУДА ДАР САБАД (public.deleted_records):"
echo "--------------------------------------------------------"
$DB_EXEC -c "
SELECT 
  id, 
  table_name, 
  record_id, 
  company_id, 
  deleted_at 
FROM public.deleted_records 
ORDER BY deleted_at DESC 
LIMIT 10;
" 2>/dev/null || echo "Дар deleted_records сабте нест."

echo ""
echo "========================================================"
echo "    АМАЛИЁТИ БАРҚАРОРСОЗӢ:                              "
echo "========================================================"
echo "Агар хоҳед ширкатро ба як корбари мушаххас пайваст кунед,"
echo "фармони зерро иҷро кунед:"
echo ""
echo "  bash scripts/vps-link-user-company.sh <EMAIL> [COMPANY_NAME]"
echo "========================================================"
