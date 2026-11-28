import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CONTRACT_TAGS, RECEIPT_TAGS } from "@/lib/pdf-templates/template-tags";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";

export function DocumentTemplateTags({ receipt = false }: { receipt?: boolean }) {
  const { tr } = useT();
  const tags = receipt ? [...CONTRACT_TAGS, ...RECEIPT_TAGS] : CONTRACT_TAGS;
  return <details className="mt-4 border-t border-border pt-3">
    <summary className="cursor-pointer text-sm font-medium">{tr("Тегҳои шаблон")} ({tags.length})</summary>
    <div className="mt-3 grid gap-x-6 sm:grid-cols-2">
      {tags.map(([key, label]) => <div key={key} className="flex min-w-0 items-center gap-2 border-b border-border py-2">
        <div className="min-w-0 flex-1"><code className="break-all text-xs text-primary">{`{{${key}}}`}</code><div className="text-xs text-muted-foreground">{tr(label)}</div></div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" title={tr("Нусхабардорӣ")} aria-label={`${tr("Нусхабардорӣ")} {{${key}}}`} onClick={async () => {
          try { await navigator.clipboard.writeText(`{{${key}}}`); toast.success(tr("Нусха шуд")); }
          catch { toast.error(tr("Нусхабардорӣ иҷро нашуд")); }
        }}><Copy className="h-3.5 w-3.5" /></Button>
      </div>)}
    </div>
  </details>;
}