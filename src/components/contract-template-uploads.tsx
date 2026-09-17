import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileType2, Upload, Trash2, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Kind = "full" | "installment" | "shop_full" | "shop_installment";

type Column = "docx_full_path" | "docx_installment_path" | "docx_shop_full_path" | "docx_shop_installment_path";

const META: Record<Kind, { column: Column; title: string; hint: string }> = {
  full: {
    column: "docx_full_path",
    title: "Шартномаи 100% (пардохти пурра)",
    hint: "Файли Word (.docx) бо ҷойгузорҳо: {{client_full_name}}, {{apt_number}}, {{total_price}} ва ғ.",
  },
  installment: {
    column: "docx_installment_path",
    title: "Шартномаи рассрочка",
    hint: "Файли Word (.docx) барои фурӯши қисм-қисм бо ҷадвали пардохт.",
  },
  shop_full: {
    column: "docx_shop_full_path",
    title: "Мағоза — шартномаи 100%",
    hint: "Барои мағозаҳо (этажи 0 ва 1). Худкор интихоб мешавад.",
  },
  shop_installment: {
    column: "docx_shop_installment_path",
    title: "Мағоза — шартномаи рассрочка",
    hint: "Барои мағозаҳо (этажи 0 ва 1) бо ҷадвали пардохт.",
  },
};

export function ContractTemplateUploads({ companyId, canEdit }: { companyId: string | null; canEdit: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)] space-y-4">
      <div>
        <h3 className="font-display text-base font-semibold">Шаблонҳои шартнома (DOCX)</h3>
        <p className="text-xs text-muted-foreground">
          Ҳар як шаблонро як маротиба илова кунед — барнома маълумоти мизоҷро ба он мегузорад ва барои чоп мебарорад.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Slot kind="full" companyId={companyId} canEdit={canEdit} />
        <Slot kind="installment" companyId={companyId} canEdit={canEdit} />
        <Slot kind="shop_full" companyId={companyId} canEdit={canEdit} />
        <Slot kind="shop_installment" companyId={companyId} canEdit={canEdit} />
      </div>
    </div>
  );
}

function Slot({ kind, companyId, canEdit }: { kind: Kind; companyId: string | null; canEdit: boolean }) {
  const qc = useQueryClient();
  const meta = META[kind];
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const { data: path } = useQuery({
    queryKey: ["contract-tpl-file", companyId, meta.column],
    queryFn: async () => {
      if (!companyId) return null;
      const { data } = await (supabase as any)
        .from("contract_templates")
        .select(meta.column)
        .eq("company_id", companyId)
        .maybeSingle();
      return (data?.[meta.column] as string | null) ?? null;
    },
    enabled: !!companyId,
  });

  const savePath = async (value: string | null) => {
    const { error } = await (supabase as any)
      .from("contract_templates")
      .upsert({ company_id: companyId, [meta.column]: value }, { onConflict: "company_id" });
    if (error) throw error;
    qc.invalidateQueries({ queryKey: ["contract-tpl-file", companyId, meta.column] });
    qc.invalidateQueries({ queryKey: ["contract-template", companyId] });
  };

  const upload = async (file: File) => {
    if (!companyId) return;
    if (!file.name.toLowerCase().endsWith(".docx")) {
      toast.error("Танҳо файли .docx қабул мешавад");
      return;
    }
    setBusy(true);
    try {
      const objPath = `${companyId}/${kind}-${Date.now()}.docx`;
      const { error } = await supabase.storage.from("contract-templates").upload(objPath, file, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: false,
      });
      if (error) throw error;
      if (path) await supabase.storage.from("contract-templates").remove([path]);
      await savePath(objPath);
      toast.success("Шаблон илова шуд");
    } catch (e: any) {
      toast.error(e?.message ?? "Хатогӣ ҳангоми боркунӣ");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async () => {
    if (!path) return;
    setBusy(true);
    try {
      await supabase.storage.from("contract-templates").remove([path]);
      await savePath(null);
      toast.success("Нест карда шуд");
    } catch (e: any) {
      toast.error(e?.message ?? "Хатогӣ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <FileType2 className="mt-0.5 h-4 w-4 text-primary" />
        <div className="min-w-0">
          <p className="text-sm font-medium">{meta.title}</p>
          <p className="text-xs text-muted-foreground">{meta.hint}</p>
        </div>
      </div>

      {path ? (
        <p className="flex items-center gap-1.5 truncate text-xs text-emerald-600">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          {path.split("/").pop()}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Шаблони стандартӣ истифода мешавад</p>
      )}

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".docx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
          />
          <Button size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
            {path ? "Иваз кардан" : "Илова кардани шаблон"}
          </Button>
          {path && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void remove()}>
              <Trash2 className="mr-1.5 h-4 w-4" />
              Нест кардан
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
