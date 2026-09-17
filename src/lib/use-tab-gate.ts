import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { computeAllowedPages } from "@/lib/app-pages";
import { companyModuleEnabled } from "@/lib/constants";
import { supabase } from "@/integrations/supabase/client";

// Returns a `tabOk(key)` guard used to gate sub-tabs. It enforces two layers:
//   1. Per-staff allowed page set (owners / platform admins bypass this).
//   2. Company-level enabled_modules controlled by the Super Admin (applies
//      to every role, including owners).
export function useTabGate() {
  const { isOwner, isPlatformAdmin, department, extraPages, deniedPages, companyId } = useAuth();

  const { data: enabledModules } = useQuery({
    queryKey: ["company-modules", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data } = await (supabase as any).from("companies")
        .select("enabled_modules").eq("id", companyId).maybeSingle();
      return (data?.enabled_modules as string[] | null) ?? null;
    },
    enabled: !!companyId && !isPlatformAdmin,
  });

  const allowed = (isOwner || isPlatformAdmin)
    ? null
    : computeAllowedPages(department, extraPages, deniedPages);

  return (key: string) => {
    // Super Admin controls company-level gate for everyone.
    if (!isPlatformAdmin && !companyModuleEnabled(enabledModules, key)) return false;
    return allowed === null || allowed.has(key);
  };
}
