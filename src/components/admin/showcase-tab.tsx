import { uuid } from "@/lib/uuid";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Building2, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

async function uploadShowcaseLogo(file: File): Promise<{ path: string; url: string }> {
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${uuid()}.${ext}`;
  const { error } = await supabase.storage
    .from("showcase-logos")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  const { data, error: sErr } = await supabase.storage
    .from("showcase-logos")
    .createSignedUrl(path, TEN_YEARS);
  if (sErr || !data?.signedUrl) throw sErr ?? new Error("Signed URL error");
  return { path, url: data.signedUrl };
}

type Row = {
  id: string;
  company_name: string;
  logo_url: string | null;
  logo_path: string | null;
  phone: string | null;
  website: string | null;
  sort_order: number;
  is_active: boolean;
};

const empty = {
  id: "" as string,
  company_name: "",
  logo_url: "",
  logo_path: "" as string,
  phone: "",
  website: "",
  sort_order: 0,
  is_active: true,
};

export function ShowcaseTab() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<typeof empty>(empty);

  const { data: rows = [] } = useQuery({
    queryKey: ["admin", "showcase_companies"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("showcase_companies")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  function reset() {
    setForm(empty);
    setOpen(false);
  }

  async function save() {
    if (!form.company_name.trim()) {
      toast.error("Номи ширкат лозим");
      return;
    }
    const payload = {
      company_name: form.company_name.trim(),
      logo_url: form.logo_url.trim() || null,
      logo_path: form.logo_path.trim() || null,
      phone: form.phone.trim() || null,
      website: form.website.trim() || null,
      sort_order: Number(form.sort_order) || 0,
      is_active: form.is_active,
    };
    const { error } = form.id
      ? await (supabase as any).from("showcase_companies").update(payload).eq("id", form.id)
      : await (supabase as any).from("showcase_companies").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Сабт шуд");
    qc.invalidateQueries({ queryKey: ["admin", "showcase_companies"] });
    reset();
  }

  async function pickFromGallery(f: File) {
    try {
      setUploading(true);
      // remove old uploaded file if replacing
      if (form.logo_path) {
        await supabase.storage.from("showcase-logos").remove([form.logo_path]).catch(() => {});
      }
      const { path, url } = await uploadShowcaseLogo(f);
      setForm((prev) => ({ ...prev, logo_url: url, logo_path: path }));
      toast.success("Логотип бор карда шуд");
    } catch (e: any) {
      toast.error(e?.message ?? "Хатогӣ");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove(row: Row) {
    if (!confirm("Нест кунам?")) return;
    if (row.logo_path) {
      await supabase.storage.from("showcase-logos").remove([row.logo_path]).catch(() => {});
    }
    const { error } = await (supabase as any).from("showcase_companies").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin", "showcase_companies"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">Витринаи ширкатҳо</h2>
          <p className="text-xs text-muted-foreground">
            Нишон дода мешавад дар поёни экрани «Вход в систему»
          </p>
        </div>
        <Button onClick={() => { setForm(empty); setOpen(true); }}>
          <Plus className="mr-1 h-4 w-4" /> Илова
        </Button>
      </div>

      <div className="grid gap-2">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-md bg-muted">
              {r.logo_url ? (
                <img src={r.logo_url} alt={r.company_name} className="h-full w-full object-contain" />
              ) : (
                <Building2 className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="truncate font-medium">{r.company_name}</div>
                {!r.is_active && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">Ғайрифаъол</span>}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground truncate">
                {[r.phone, r.website].filter(Boolean).join(" · ")}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">#{r.sort_order}</div>
            <Button size="icon" variant="ghost" onClick={() => {
              setForm({
                id: r.id,
                company_name: r.company_name,
                logo_url: r.logo_url ?? "",
                logo_path: r.logo_path ?? "",
                phone: r.phone ?? "",
                website: r.website ?? "",
                sort_order: r.sort_order,
                is_active: r.is_active,
              });
              setOpen(true);
            }}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => remove(r)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">Ҳанӯз ягон ширкат илова нашуда</p>
        )}
      </div>

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : reset())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Таҳрир" : "Иловаи ширкат"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Номи ширкат *</Label>
              <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Логотип</Label>
              {form.logo_url && (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-2">
                  <img src={form.logo_url} alt="" className="h-10 w-10 rounded object-contain bg-background" />
                  <div className="flex-1 truncate text-xs text-muted-foreground">
                    {form.logo_path ? "Аз галерея" : "URL-и берунӣ"}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (form.logo_path) {
                        await supabase.storage.from("showcase-logos").remove([form.logo_path]).catch(() => {});
                      }
                      setForm((p) => ({ ...p, logo_url: "", logo_path: "" }));
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
                  Аз галерея
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) pickFromGallery(f);
                  }}
                />
              </div>
              <Input
                placeholder="ё URL: https://..."
                value={form.logo_path ? "" : form.logo_url}
                disabled={!!form.logo_path}
                onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Телефон</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Сайт</Label>
                <Input placeholder="binosoz.tj" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Тартиб</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
                />
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label>Фаъол</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={reset}>Бекор</Button>
            <Button onClick={save}>Сабт</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
