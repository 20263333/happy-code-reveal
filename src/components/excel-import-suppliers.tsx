import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { FileSpreadsheet, Download, Upload, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { importSuppliersFromExcel } from "@/lib/excel-import-suppliers.functions";

type Row = {
  name: string;
  contact_person: string;
  phone: string;
  address: string;
  note: string;
  _row: number;
  _error?: string;
};

const HEADERS = [["Ном (ширкат)", "Шахси алоқа", "Телефон", "Суроға", "Эзоҳ"]];

function downloadTemplate() {
  const sample = [
    ["ООО Семент-Плюс", "Раҳимов А.", "+992900000001", "Душанбе", ""],
    ["ЧП Оҳанфурӯш", "Каримов М.", "+992900000002", "Хуҷанд", "Оҳан 8–14мм"],
  ];
  const ws = XLSX.utils.aoa_to_sheet([...HEADERS, ...sample]);
  ws["!cols"] = [{ wch: 26 }, { wch: 20 }, { wch: 18 }, { wch: 22 }, { wch: 22 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Таъминкунандагон");
  XLSX.writeFile(wb, "namunai-taminkunandagon.xlsx");
}

export function ExcelImportSuppliers() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const importFn = useServerFn(importSuppliersFromExcel);

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
      const row: Row = {
        name: r[0] != null ? String(r[0]).trim() : "",
        contact_person: r[1] != null ? String(r[1]).trim() : "",
        phone: r[2] != null ? String(r[2]).trim() : "",
        address: r[3] != null ? String(r[3]).trim() : "",
        note: r[4] != null ? String(r[4]).trim() : "",
        _row: i + 1,
      };
      if (!row.name) row._error = "Ном холист";
      parsed.push(row);
    }
    setRows(parsed);
  };

  const mut = useMutation({
    mutationFn: async () =>
      await importFn({
        data: {
          rows: valid.map((r) => ({
            name: r.name,
            contact_person: r.contact_person || null,
            phone: r.phone || null,
            address: r.address || null,
            note: r.note || null,
          })),
        },
      }),
    onSuccess: (res: any) => {
      toast.success(`Илова: ${res.created} · Навсозӣ: ${res.updated}`);
      qc.invalidateQueries({ queryKey: ["suppliers"] });
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
          <DialogTitle>Импорти таъминкунандагон аз Excel</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm space-y-2">
            <div className="font-medium">Тартиб:</div>
            <ol className="list-decimal ml-5 space-y-1 text-muted-foreground">
              <li>Шаблонро зеркашӣ кунед</li>
              <li>Номи ширкат ва алоқаро пур кунед</li>
              <li>Такрорӣ бо ном ё телефон навсозӣ мешавад</li>
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
                      <th className="px-2 py-1 text-left">Алоқа</th>
                      <th className="px-2 py-1 text-left">Телефон</th>
                      <th className="px-2 py-1 text-left">Ҳолат</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className={r._error ? "bg-destructive/10" : ""}>
                        <td className="px-2 py-1 text-muted-foreground">{r._row}</td>
                        <td className="px-2 py-1">{r.name}</td>
                        <td className="px-2 py-1">{r.contact_person}</td>
                        <td className="px-2 py-1">{r.phone}</td>
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
