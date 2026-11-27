#!/usr/bin/env bash
# Рӯйхати корбарон ва эмейлҳои сабтшуда дар базаи Supabase
set -euo pipefail

echo "=== Рӯйхати корбарони Binosoz.tj ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT 
  u.id, 
  u.email, 
  p.fullname, 
  p.role, 
  c.name AS company_name, 
  u.created_at
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
LEFT JOIN public.companies c ON c.id = p.company_id OR c.owner_user_id = u.id
ORDER BY u.created_at DESC;
" 2>/dev/null || docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC;"
