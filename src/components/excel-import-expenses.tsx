import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { FileSpreadsheet, Download, Upload, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { importExpensesFromExcel } from "@/lib/excel-import-expenses.functions";

type Row = {
  amount: number;
  category: string;
  description: string;
  expense_date: string;
  employee_name: string;
  _row: number;
  _error?: string;
};

const HEADERS = [
  ["Сана (YYYY-MM-DD)", "Категория", "Маблағ (сомонӣ)", "Тавсиф", "Корманд"],
];

function num(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  const s = String(v).replace(/\s/g, "").replace(",", ".");
  const n = Number(s);
  return isFinite(n) ? n : null;
}

function dateStr(v: any): string {
  if (v == null || v === "") return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    // Excel serial
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  const m2 = s.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/);
  if (m2) return `${m2[3]}-${m2[2].padStart(2, "0")}-${m2[1].padStart(2, "0")}`;
  return "";
}

function downloadTemplate() {
  const sample = [
    ["2026-07-01", "materials", 3500, "Хариди семент", "Раҳимов А."],
    ["2026-07-02", "salary", 2000, "Музди коргарон", ""],
    ["2026-07-05", "other", 450, "Хӯрок", ""],
  ];
  const ws = XLSX.utils.aoa_to_sheet([...HEADERS, ...sample]);
  ws["!cols"] = [{ wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 28 }, { wch: 22 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Хароҷот");
  XLSX.writeFile(wb, "namunai-kharojot.xlsx");
}

export function ExcelImportExpenses({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const importFn = useServerFn(importExpensesFromExcel);

  const valid = rows.filter((r) => !r._error);
  const errs = rows.filter((r) => r._error);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false, raw: true });
    const parsed: Row[] = [];
    for (let i = 1; i < data.length; i++) {
      const r = data[i];
      if (!r || r.every((c: any) => c === null || c === undefined || c === "")) continue;
      const d = dateStr(r[0]);
      const category = r[1] != null ? String(r[1]).trim() : "other";
      const amount = num(r[2]) ?? 0;
      const description = r[3] != null ? String(r[3]).trim() : "";
      const employee_name = r[4] != null ? String(r[4]).trim() : "";
      const row: Row = { amount, category: category || "other", description, expense_date: d, employee_name, _row: i + 1 };
      if (!d) row._error = "Сана нодуруст";
      else if (amount <= 0) row._error = "Маблағ нодуруст";
      parsed.push(row);
    }
    setRows(parsed);
  };

  const mut = useMutation({
    mutationFn: async () =>
      await importFn({
        data: {
          project_id: projectId,
          rows: valid.map((r) => ({
            amount: r.amount,
            category: r.category,
            description: r.description || null,
            expense_date: r.expense_date,
            employee_name: r.employee_name || null,
          })),
        },
      }),
    onSuccess: (res: any) => {
      toast.success(`Илова: ${res.created}`);
      qc.invalidateQueries({ queryKey: ["expenses"] });
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
          <DialogTitle>Импорти хароҷот аз Excel</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm space-y-2">
            <div className="font-medium">Тартиб:</div>
            <ol className="list-decimal ml-5 space-y-1 text-muted-foreground">
              <li>Шаблонро зеркашӣ кунед</li>
              <li>Сана (YYYY-MM-DD), категория, маблағро пур кунед</li>
              <li>Категорияҳо: materials, salary, subcontract, equipment, other</li>
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
                      <th className="px-2 py-1 text-left">Сана</th>
                      <th className="px-2 py-1 text-left">Категория</th>
                      <th className="px-2 py-1 text-right">Маблағ</th>
                      <th className="px-2 py-1 text-left">Тавсиф</th>
                      <th className="px-2 py-1 text-left">Ҳолат</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className={r._error ? "bg-destructive/10" : ""}>
                        <td className="px-2 py-1 text-muted-foreground">{r._row}</td>
                        <td className="px-2 py-1">{r.expense_date}</td>
                        <td className="px-2 py-1">{r.category}</td>
                        <td className="px-2 py-1 text-right">{r.amount.toLocaleString()}</td>
                        <td className="px-2 py-1">{r.description}</td>
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
