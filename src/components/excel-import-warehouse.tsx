import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { FileSpreadsheet, Download, Upload, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { importWarehouseItemsFromExcel } from "@/lib/excel-import-warehouse.functions";

type Row = {
  name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  _row: number;
  _error?: string;
};

const HEADERS = [
  ["Номи маҳсулот", "Воҳид (шт/кг/м/м²…)", "Миқдор", "Нарх (сомонӣ)"],
];

function num(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  const s = String(v).replace(/\s/g, "").replace(",", ".");
  const n = Number(s);
  return isFinite(n) ? n : null;
}

function downloadTemplate() {
  const sample = [
    ["Семент М500", "мешок", 120, 85],
    ["Оҳан 12мм", "т", 5.5, 8500],
    ["Хишт", "шт", 12000, 1.2],
    ["Ранг", "л", 60, 45],
  ];
  const ws = XLSX.utils.aoa_to_sheet([...HEADERS, ...sample]);
  ws["!cols"] = [{ wch: 28 }, { wch: 20 }, { wch: 14 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Склад");
  XLSX.writeFile(wb, "namunai-sklad.xlsx");
}

export function ExcelImportWarehouse() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const importFn = useServerFn(importWarehouseItemsFromExcel);

  const valid = rows.filter((r) => !r._error);
  const errs = rows.filter((r) => r._error);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false });
    const parsed: Row[] = [];
    for (let i = 1; i < data.length; i++) {
      const r = data[i];
      if (!r || r.every((c: any) => c === null || c === undefined || c === "")) continue;
      const name = r[0] != null ? String(r[0]).trim() : "";
      const unit = r[1] != null ? String(r[1]).trim() : "шт";
      const quantity = num(r[2]) ?? 0;
      const unit_price = num(r[3]) ?? 0;
      const row: Row = { name, unit: unit || "шт", quantity, unit_price, _row: i + 1 };
      if (!name) row._error = "Номи маҳсулот холист";
      else if (quantity < 0) row._error = "Миқдор нодуруст";
      else if (unit_price < 0) row._error = "Нарх нодуруст";
      parsed.push(row);
    }
    setRows(parsed);
  };

  const mut = useMutation({
    mutationFn: async () => {
      return await importFn({
        data: {
          rows: valid.map((r) => ({
            name: r.name,
            unit: r.unit,
            quantity: r.quantity,
            unit_price: r.unit_price,
          })),
        },
      });
    },
    onSuccess: (res: any) => {
      toast.success(`Илова: ${res.created} · Навсозӣ: ${res.updated}`);
      qc.invalidateQueries({ queryKey: ["warehouse-items"] });
      qc.invalidateQueries({ queryKey: ["warehouse_items"] });
      setOpen(false);
      setRows([]);
      setFileName("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Хато"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setRows([]); setFileName(""); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileSpreadsheet className="h-4 w-4 mr-1" />
          Импорт аз Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Импорти масолеҳи склад аз Excel</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm space-y-2">
            <div className="font-medium">Тартиб:</div>
            <ol className="list-decimal ml-5 space-y-1 text-muted-foreground">
              <li>Шаблонро зеркашӣ кунед</li>
              <li>Ном, воҳид, миқдор ва нархро пур кунед</li>
              <li>Бор кунед — такрорӣ (ном + воҳид) навсозӣ мешавад</li>
            </ol>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-1" />
              Шаблон (.xlsx)
            </Button>
          </div>

          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" />
              {fileName || "Файли Excel-ро интихоб кунед"}
            </Button>
          </div>

          {rows.length > 0 && (
            <div className="space-y-2">
              <div className="flex gap-4 text-sm">
                <span className="inline-flex items-center gap-1 text-success">
                  <CheckCircle2 className="h-4 w-4" /> Дуруст: {valid.length}
                </span>
                {errs.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-destructive">
                    <AlertTriangle className="h-4 w-4" /> Хато: {errs.length}
                  </span>
                )}
              </div>
              <div className="max-h-72 overflow-auto rounded-md border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="px-2 py-1 text-left">Сатр</th>
                      <th className="px-2 py-1 text-left">Ном</th>
                      <th className="px-2 py-1 text-left">Воҳид</th>
                      <th className="px-2 py-1 text-right">Миқдор</th>
                      <th className="px-2 py-1 text-right">Нарх</th>
                      <th className="px-2 py-1 text-left">Ҳолат</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className={r._error ? "bg-destructive/10" : ""}>
                        <td className="px-2 py-1 text-muted-foreground">{r._row}</td>
                        <td className="px-2 py-1">{r.name}</td>
                        <td className="px-2 py-1">{r.unit}</td>
                        <td className="px-2 py-1 text-right">{r.quantity}</td>
                        <td className="px-2 py-1 text-right">{r.unit_price.toLocaleString()}</td>
                        <td className="px-2 py-1">{r._error ?? "OK"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => mut.mutate()} disabled={valid.length === 0 || mut.isPending}>
            {mut.isPending ? "Импорт…" : `Импорт ${valid.length} сатр`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
