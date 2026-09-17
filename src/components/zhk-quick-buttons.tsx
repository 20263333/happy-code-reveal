import { useQuery } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useGlobalZhk, setGlobalZhk } from "@/lib/zhk-scope";

// Тугмаҳои калони интихоби ЖК дар болои барнома. Танҳо як ЖК фаъол мешавад,
// то маълумоти лоиҳаҳо (масалан Шарора Сохтмон ва Қазоқон Сохтмон) омехта нашаванд.
export function ZhkQuickButtons() {
  const { companyId } = useAuth();
  const active = useGlobalZhk();

  const { data: zhkList = [] } = useQuery({
    queryKey: ["zhk-quick-buttons", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, name")
        .eq("company_id", companyId!)
        .is("parent_id", null)
        .order("name");
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  if (zhkList.length === 0) return null;

  return (
    <div className="hidden lg:flex items-center gap-2 mr-2 min-w-0">
      {zhkList.map((z) => {
        const isActive = active === z.id;
        return (
          <Button
            key={z.id}
            size="lg"
            variant={isActive ? "default" : "outline"}
            className="h-11 px-4 text-sm font-semibold gap-2"
            onClick={() => setGlobalZhk(z.id)}
            title={z.name}
          >
            <Building2 className="h-4 w-4" />
            <span className="max-w-[160px] truncate">{z.name}</span>
          </Button>
        );
      })}
    </div>
  );
}
