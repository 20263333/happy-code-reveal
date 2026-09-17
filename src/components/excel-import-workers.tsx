import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { FileSpreadsheet, Download, Upload, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { importWorkersFromExcel } from "@/lib/excel-import-workers.functions";

type Row = {
  fullname: string;
  position: string;
  phone: string;
  passport_number: string;
  daily_rate: number;
  _row: number;
  _error?: string;
};

const HEADERS = [
  ["ФИО", "Вазифа", "Телефон", "Паспорт", "Музди рӯзона (сомонӣ)"],
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
    ["Раҳимов Сафар", "Бригадир", "+992900000001", "A1234567", 250],
    ["Каримов Мурод", "Бетончӣ", "+992900000002", "", 180],
    ["Асозода Комрон", "Мардикор", "", "", 150],
  ];
  const ws = XLSX.utils.aoa_to_sheet([...HEADERS, ...sample]);
  ws["!cols"] = [{ wch: 26 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 20 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Коргарон");
  XLSX.writeFile(wb, "namunai-korgaron.xlsx");
}

export function ExcelImportWorkers() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const importFn = useServerFn(importWorkersFromExcel);

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
      const fullname = r[0] != null ? String(r[0]).trim() : "";
      const position = r[1] != null ? String(r[1]).trim() : "";
      const phone = r[2] != null ? String(r[2]).trim() : "";
      const passport_number = r[3] != null ? String(r[3]).trim() : "";
      const daily_rate = num(r[4]) ?? 0;
      const row: Row = { fullname, position, phone, passport_number, daily_rate, _row: i + 1 };
      if (!fullname) row._error = "ФИО холист";
      else if (daily_rate < 0) row._error = "Музди рӯзона нодуруст";
      parsed.push(row);
    }
    setRows(parsed);
  };

  const mut = useMutation({
    mutationFn: async () => {
      return await importFn({
        data: {
          rows: valid.map((r) => ({
            fullname: r.fullname,
            position: r.position || null,
            phone: r.phone || null,
            passport_number: r.passport_number || null,
            daily_rate: r.daily_rate,
          })),
        },
      });
    },
    onSuccess: (res: any) => {
      toast.success(`Илова: ${res.created} · Навсозӣ: ${res.updated}`);
      qc.invalidateQueries({ queryKey: ["workers-full"] });
      qc.invalidateQueries({ queryKey: ["workers"] });
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
          <DialogTitle>Импорти коргарон аз Excel</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm space-y-2">
            <div className="font-medium">Тартиб:</div>
            <ol className="list-decimal ml-5 space-y-1 text-muted-foreground">
              <li>Шаблонро зеркашӣ кунед</li>
              <li>Ном, вазифа, музди рӯзонаро пур кунед</li>
              <li>Бор кунед — такрорӣ бо ФИО ё телефон навсозӣ мешавад</li>
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
                      <th className="px-2 py-1 text-left">ФИО</th>
                      <th className="px-2 py-1 text-left">Вазифа</th>
                      <th className="px-2 py-1 text-left">Телефон</th>
                      <th className="px-2 py-1 text-right">Музд</th>
                      <th className="px-2 py-1 text-left">Ҳолат</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className={r._error ? "bg-destructive/10" : ""}>
                        <td className="px-2 py-1 text-muted-foreground">{r._row}</td>
                        <td className="px-2 py-1">{r.fullname}</td>
                        <td className="px-2 py-1">{r.position}</td>
                        <td className="px-2 py-1">{r.phone}</td>
                        <td className="px-2 py-1 text-right">{r.daily_rate.toLocaleString()}</td>
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
