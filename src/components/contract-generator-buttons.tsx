import { useState } from "react";
import { FileText, Loader2, CalendarDays, Wallet, FileType2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { buildContractContext } from "@/lib/pdf-templates/context";
import { downloadFullContractOverlay, downloadInstallmentContractOverlay, downloadScheduleOverlay } from "@/lib/pdf-templates/overlay";
import { downloadContractDocx } from "@/lib/pdf-templates/docx-merge";
import { useUsdRate } from "@/lib/use-usd-rate";

type Kind = "full" | "installment" | "schedule" | "full-docx" | "installment-docx" | "schedule-docx";

export function ContractGeneratorButtons({ saleId, hasInstallment }: { saleId: string; hasInstallment?: boolean }) {
  const [busy, setBusy] = useState<Kind | null>(null);
  const usdRate = useUsdRate();

  const gen = async (kind: Kind) => {
    setBusy(kind);
    try {
      if (kind === "full-docx") {
        await downloadContractDocx("full", saleId, usdRate || 10.9);
      } else if (kind === "installment-docx") {
        await downloadContractDocx("installment", saleId, usdRate || 10.9);
      } else if (kind === "schedule-docx") {
        await downloadContractDocx("schedule", saleId, usdRate || 10.9);
      } else {
        const ctx = await buildContractContext(saleId, { usdRate: usdRate || 10.9 });
        if (kind === "full") await downloadFullContractOverlay(ctx);
        else if (kind === "installment") await downloadInstallmentContractOverlay(ctx);
        else await downloadScheduleOverlay(ctx);
      }
      toast.success("Ҳуҷҷат тайёр шуд");
    } catch (e: any) {
      toast.error(e?.message ?? "Хатоги ҳангоми сохтани ҳуҷҷат");
    } finally {
      setBusy(null);
    }
  };

  const installment = hasInstallment === true;

  return (
    <div className="flex flex-wrap gap-2">
      {!installment && (
        <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => gen("full-docx")}>
          {busy === "full-docx" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileType2 className="mr-1.5 h-4 w-4" />}
          Шартнома DOCX (шаблони расмӣ)
        </Button>
      )}
      {installment && (
        <>
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => gen("installment-docx")}>
            {busy === "installment-docx" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileType2 className="mr-1.5 h-4 w-4" />}
            Шартномаи рассрочка DOCX (шаблони расмӣ)
          </Button>
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => gen("schedule-docx")}>
            {busy === "schedule-docx" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CalendarDays className="mr-1.5 h-4 w-4" />}
            График пардохтҳо DOCX (шаблони расмӣ)
          </Button>
        </>
      )}
    </div>
  );
}

