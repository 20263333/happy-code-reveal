import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, FileJson, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { importCompanyExport } from "@/lib/company-import.functions";
import { toast } from "sonner";

/**
 * Super Admin: воридкунии ширкати нав аз файли JSON-и экспорт.
 * Ҳамаи ID-ҳо нав мешаванд; соҳиби нав сохта мешавад.
 */
export function CompanyImportTab() {
  const queryClient = useQueryClient();
  const runImport = useServerFn(importCompanyExport);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [ownerFullname, setOwnerFullname] = useState("");
  const [loading, setLoading] = useState(false);
  const [detected, setDetected] = useState<string | null>(null);

  async function onFileChange(f: File | null) {
    setFile(f);
    setDetected(null);
    if (!f) return;
    try {
      const text = await f.text();
      const json = JSON.parse(text);
      const name = json?._meta?.company ?? json?.data?.company?.name;
      if (name) {
        setDetected(String(name));
        if (!companyName) setCompanyName(String(name));
      }
      if (!json?.data?.company?.id) {
        toast.error("Файл нодуруст аст: сохтори экспорт ёфт нашуд");
        setFile(null);
      }
    } catch {
      toast.error("Файл JSON хонда нашуд");
      setFile(null);
    }
  }

  async function submit() {
    if (!file) return toast.error("Файлро интихоб кунед");
    if (!ownerEmail || !ownerPassword || !ownerFullname)
      return toast.error("Маълумоти соҳибро пур кунед");
    setLoading(true);
    try {
      const payload = JSON.parse(await file.text());
      const res = await runImport({
        data: {
          payload,
          company_name: companyName.trim(),
          owner_email: ownerEmail.trim(),
          owner_password: ownerPassword,
          owner_fullname: ownerFullname.trim(),
        },
      });
      const total = Object.values(res.inserted ?? {}).reduce((a, b) => a + (b as number), 0);
      toast.success(`Ширкат ворид шуд — ${total} сабт гузошта шуд`);
      setFile(null);
      setCompanyName("");
      setOwnerEmail("");
      setOwnerPassword("");
      setOwnerFullname("");
      setDetected(null);
      if (fileRef.current) fileRef.current.value = "";
      queryClient.invalidateQueries();
    } catch (e: any) {
      toast.error(e?.message ?? "Хатогӣ ҳангоми воридкунӣ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" /> Воридкунии ширкат аз файл
        </CardTitle>
        <CardDescription>
          Файли JSON-и экспортшударо (формати BINO SOZ) бор кунед — ширкати нав бо ҳамаи лоиҳаҳо,
          фурӯшҳо, пардохтҳо ва хароҷоташ сохта мешавад. ID-ҳо нав мешаванд, маълумоти мавҷуда
          даст намехӯрад.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-w-xl">
        <div className="space-y-2">
          <Label>Файли экспорт (.json)</Label>
          <Input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          />
          {file && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileJson className="h-4 w-4" />
              {file.name} ({Math.round(file.size / 1024)} КБ)
              {detected && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-4 w-4" /> {detected}
                </span>
              )}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Номи ширкати нав</Label>
          <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Email-и соҳиб</Label>
            <Input
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="owner@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Номи пурраи соҳиб</Label>
            <Input value={ownerFullname} onChange={(e) => setOwnerFullname(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Пароли соҳиб</Label>
          <Input
            type="text"
            value={ownerPassword}
            onChange={(e) => setOwnerPassword(e.target.value)}
            placeholder="Ҳадди ақал 6 аломат"
          />
        </div>
        <Button onClick={submit} disabled={loading || !file} className="w-full sm:w-auto">
          {loading ? "Ворид карда истодааст..." : "Ворид кардани ширкат"}
        </Button>
      </CardContent>
    </Card>
  );
}
