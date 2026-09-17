import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Archive } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n";

const STAGE_LABEL: Record<string, string> = {
  "before-3": "3 рӯз пеш",
  "before-2": "2 рӯз пеш",
  "before-1": "1 рӯз пеш",
  "overdue-3": "Таъхир 3 рӯз",
  "overdue-4": "Таъхир 4 рӯз",
  "overdue-5": "Таъхир 5 рӯз (огоҳиномаи охирин)",
  overdue: "Таъхир",
  paid: "Тасдиқи пардохт",
};

// Архиви СМС — ҳамаи паёмҳои фиристодашуда бо матн, сана ва ҳолаташон.
export function SmsArchive({ companyId }: { companyId: string }) {
  const { tr } = useT();
  const [q, setQ] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["sms-archive", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sms_logs")
        .select("id, customer_phone, message, due_date, stage, status, error, created_at")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw new Error(error.message);
      return (data ?? []) as any[];
    },
  });

  const filtered = rows.filter((r) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (
      (r.customer_phone ?? "").toLowerCase().includes(s) ||
      (r.message ?? "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Archive className="h-4 w-4" />
        <span className="font-medium">{tr("Архиви СМС")}</span>
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length}</span>
      </div>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={tr("Ҷустуҷӯ аз рӯи рақам ё матн")}
        className="mb-3"
      />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tr("СМС нест")}</p>
      ) : (
        <div className="max-h-[420px] overflow-y-auto divide-y divide-border">
          {filtered.map((r) => (
            <div key={r.id} className="py-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium tabular-nums">{r.customer_phone ?? "—"}</span>
                <Badge variant={r.status === "sent" ? "secondary" : "destructive"} className="text-[10px]">
                  {r.status === "sent" ? tr("Фиристода шуд") : tr("Хатогӣ")}
                </Badge>
                {r.stage && (
                  <Badge variant="outline" className="text-[10px]">
                    {STAGE_LABEL[r.stage] ?? r.stage}
                  </Badge>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("ru-RU")}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{r.message}</p>
              {r.error && <p className="mt-1 text-xs text-destructive">{r.error}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
