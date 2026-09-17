import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Building2 } from "lucide-react";
import { toast } from "sonner";
import { getApartmentSyncStatus, syncAllApartments } from "@/lib/apartment-sync.functions";

export function ApartmentSyncTab() {
  const statusFn = useServerFn(getApartmentSyncStatus);
  const syncFn = useServerFn(syncAllApartments);

  const { data, isLoading } = useQuery({
    queryKey: ["apartment-sync-status"],
    queryFn: () => statusFn(),
  });

  const sync = useMutation({
    mutationFn: () => syncFn(),
    onSuccess: (r: any) => toast.success(`Фиристода шуд: ${r.count} хона`),
    onError: (e: any) => toast.error(e?.message ?? "Хатогӣ"),
  });

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Интегратсия бо sharora.tj</h3>
        </div>
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : data?.configured ? (
          <Badge className="bg-emerald-600 text-white">Фаъол</Badge>
        ) : (
          <Badge variant="secondary">Танзим нашудааст</Badge>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Ҳолати хонаҳо (холӣ, фурӯхта, рассрочка, банд) худкор ба барномаи sharora.tj
        фиристода мешавад — ҳар дафъа ки хона иваз ё фурӯхта мешавад. Бо тугмаи поён
        метавонед рӯйхати пурраро якбора фиристед.
      </p>

      <Button
        onClick={() => sync.mutate()}
        disabled={sync.isPending || !data?.configured}
      >
        {sync.isPending ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4 mr-2" />
        )}
        Синхронизатсияи пурра
      </Button>
    </div>
  );
}
