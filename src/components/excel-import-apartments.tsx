import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { FileSpreadsheet, Download, Upload, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { importApartmentsFromExcel } from "@/lib/excel-import.functions";

type ParsedRow = {
  floor_number: number;
  apartment_number: string;
  area: number;
  price: number;
  rooms: number | null;
  _row: number;
  _error?: string;
};

const HEADERS = [
  ["Ошёна (floor)", "Квартира №", "Масоҳат (м²)", "Нарх (сомонӣ)", "Ҳуҷраҳо (rooms)"],
];

function downloadTemplate() {
  const sampleRows = [
    [0, "1", 45.5, 320000, 1],
    [0, "2", 62.3, 450000, 2],
    [1, "3", 45.5, 330000, 1],
    [1, "4", 62.3, 460000, 2],
    [2, "5", 78.0, 580000, 3],
  ];
  const ws = XLSX.utils.aoa_to_sheet([...HEADERS, ...sampleRows]);
  ws["!cols"] = [{ wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 18 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Квартираҳо");
  XLSX.writeFile(wb, "namunai-kvartirah.xlsx");
}

function parseNumber(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  const s = String(v).replace(/\s/g, "").replace(",", ".");
  const n = Number(s);
  return isFinite(n) ? n : null;
}

export function ExcelImportApartments({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const importFn = useServerFn(importApartmentsFromExcel);

  const validRows = rows.filter((r) => !r._error);
  const errorRows = rows.filter((r) => r._error);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false });
    const parsed: ParsedRow[] = [];
    for (let i = 1; i < data.length; i++) {
      const r = data[i];
      if (!r || r.every((c: any) => c === null || c === undefined || c === "")) continue;
      const floor = parseNumber(r[0]);
      const num = r[1] != null ? String(r[1]).trim() : "";
      const area = parseNumber(r[2]);
      const price = parseNumber(r[3]);
      const rooms = parseNumber(r[4]);
      const row: ParsedRow = {
        floor_number: floor ?? -1,
        apartment_number: num,
        area: area ?? 0,
        price: price ?? 0,
        rooms: rooms == null ? null : Math.round(rooms),
        _row: i + 1,
      };
      if (floor == null || floor < 0) row._error = "Ошёна нодуруст";
      else if (!num) row._error = "Рақами квартира холист";
      else if (area == null || area <= 0) row._error = "Масоҳат нодуруст";
      else if (price == null || price < 0) row._error = "Нарх нодуруст";
      parsed.push(row);
    }
    setRows(parsed);
  };

  const mut = useMutation({
    mutationFn: async () => {
      const payload = {
        project_id: projectId,
        rows: validRows.map((r) => ({
          floor_number: r.floor_number,
          apartment_number: r.apartment_number,
          area: r.area,
          price: r.price,
          rooms: r.rooms,
        })),
      };
      return await importFn({ data: payload });
    },
    onSuccess: (res: any) => {
      toast.success(`Илова: ${res.created} · Навсозӣ: ${res.updated} · Ошёнаҳои нав: ${res.floors_created}`);
      qc.invalidateQueries({ queryKey: ["floors", projectId] });
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
          <DialogTitle>Импорти квартираҳо аз Excel</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm space-y-2">
            <div className="font-medium">Тартиб:</div>
            <ol className="list-decimal ml-5 space-y-1 text-muted-foreground">
              <li>Шаблонро зеркашӣ кунед</li>
              <li>Дар Excel маълумотро пур кунед (ошёна 0, 1, 2 …)</li>
              <li>Файлро дар ин ҷо бор кунед ва тасдиқ кунед</li>
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
                  <CheckCircle2 className="h-4 w-4" /> Дуруст: {validRows.length}
                </span>
                {errorRows.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-destructive">
                    <AlertTriangle className="h-4 w-4" /> Хато: {errorRows.length}
                  </span>
                )}
              </div>
              <div className="max-h-72 overflow-auto rounded-md border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="px-2 py-1 text-left">Сатр</th>
                      <th className="px-2 py-1 text-left">Ошёна</th>
                      <th className="px-2 py-1 text-left">№</th>
                      <th className="px-2 py-1 text-right">м²</th>
                      <th className="px-2 py-1 text-right">Нарх</th>
                      <th className="px-2 py-1 text-right">Ҳуҷра</th>
                      <th className="px-2 py-1 text-left">Ҳолат</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className={r._error ? "bg-destructive/10" : ""}>
                        <td className="px-2 py-1 text-muted-foreground">{r._row}</td>
                        <td className="px-2 py-1">{r.floor_number}</td>
                        <td className="px-2 py-1">{r.apartment_number}</td>
                        <td className="px-2 py-1 text-right">{r.area}</td>
                        <td className="px-2 py-1 text-right">{r.price.toLocaleString()}</td>
                        <td className="px-2 py-1 text-right">{r.rooms ?? "—"}</td>
                        <td className="px-2 py-1 text-xs">{r._error ?? "OK"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            onClick={() => mut.mutate()}
            disabled={validRows.length === 0 || mut.isPending}
          >
            {mut.isPending ? "Импорт…" : `Импорт ${validRows.length} сатр`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
