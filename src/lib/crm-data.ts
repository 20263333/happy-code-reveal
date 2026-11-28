import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Independent tenant-scoped reads also work on VPS databases without PostgREST FK metadata. */
export async function loadCrmCustomers(client: SupabaseClient<Database>, companyId: string) {
  if (!companyId) throw new Error("Ширкат ёфт нашуд");
  const rows: Database['public']['Tables']['customers']['Row'][] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from("customers").select("*").eq("company_id", companyId)
      .or("status.is.null,status.not.in.(active,closed)").order("created_at", { ascending: false }).order("id").range(offset, offset + 499);
    if (error) throw error;
    rows.push(...(data ?? []).filter(row => row.company_id === companyId));
    if (!data || data.length < 500) break;
  }
  const { data: managers, error: managerError } = await client.from("sales_team_members")
    .select("id,fullname,company_id").eq("company_id", companyId);
  if (managerError) throw managerError;
  const sales: { id: string; customer_id: string; company_id: string | null }[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from("sales").select("id,customer_id,company_id")
      .eq("company_id", companyId).order("id").range(offset, offset + 499);
    if (error) throw error;
    sales.push(...(data ?? []).filter(row => row.company_id === companyId));
    if (!data || data.length < 500) break;
  }
  return rows.map(row => ({ ...row,
    sales: sales.filter(sale => sale.customer_id === row.id),
    manager: managers?.find(manager => manager.company_id === companyId && manager.id === row.assigned_manager_id) ?? null,
  }));
}