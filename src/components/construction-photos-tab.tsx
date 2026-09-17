import { uuid } from "@/lib/uuid";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/page-header";
import { useAuth } from "@/hooks/use-auth";
import { compressImageFile } from "@/lib/image-compress";
import { toast } from "sonner";

const BUCKET = "construction-photos";

type Photo = {
  id: string;
  project_id: string;
  photo_path: string;
  note: string | null;
  taken_at: string;
  project?: { name: string | null } | null;
};

// Суратгирии объект: расмҳо танҳо илова мешаванд; тоза кардан фақат
// барои директор ва соҳиби ширкат иҷозат аст.
export function ConstructionPhotosTab({ projects }: { projects: any[] }) {
  const { companyId, isDirector, isOwner, isPlatformAdmin, user } = useAuth();
  const qc = useQueryClient();
  const canDelete = isDirector || isOwner || isPlatformAdmin;
  const [projectId, setProjectId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});

  const { data: photos = [] } = useQuery({
    queryKey: ["construction-photos", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("construction_photos")
        .select("id, project_id, photo_path, note, taken_at, project:projects(name)")
        .order("taken_at", { ascending: false })
        .limit(300);
      if (error) throw new Error(error.message);
      return (data ?? []) as Photo[];
    },
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const missing = photos.filter((p) => !urls[p.id]);
      if (missing.length === 0) return;
      const next: Record<string, string> = {};
      for (const p of missing) {
        const { data } = await supabase.storage.from(BUCKET).createSignedUrl(p.photo_path, 3600);
        if (data?.signedUrl) next[p.id] = data.signedUrl;
      }
      if (!cancelled && Object.keys(next).length) setUrls((u) => ({ ...u, ...next }));
    })();
    return () => {
      cancelled = true;
    };
  }, [photos, urls]);

  const upload = async (file: File | undefined) => {
    if (!file || !companyId) return;
    if (!projectId) return toast.error("Аввал лоиҳа/блокро интихоб кунед");
    setBusy(true);
    try {
      const dataUrl = await compressImageFile(file, { maxSize: 1800, quality: 0.85 });
      const blob = await (await fetch(dataUrl)).blob();
      const path = `${companyId}/${projectId}/${uuid()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (upErr) throw new Error(upErr.message);
      const { error } = await (supabase as any).from("construction_photos").insert({
        company_id: companyId,
        project_id: projectId,
        photo_path: path,
        note: note || null,
        created_by: user?.id,
      });
      if (error) throw new Error(error.message);
      setNote("");
      toast.success("Сурат сабт шуд");
      qc.invalidateQueries({ queryKey: ["construction-photos", companyId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Хатогӣ");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p: Photo) => {
    if (!confirm("Ин суратро тоза кунем?")) return;
    const { error } = await (supabase as any).from("construction_photos").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    await supabase.storage.from(BUCKET).remove([p.photo_path]);
    toast.success("Тоза шуд");
    qc.invalidateQueries({ queryKey: ["construction-photos", companyId] });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Лоиҳа / Блок *</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {projects.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Эзоҳ</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="мис.: Этажи 5, кори бетон" />
          </div>
        </div>
        <div>
          <input
            id="construction-photo-input"
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => { upload(e.target.files?.[0]); e.currentTarget.value = ""; }}
          />
          <Button asChild disabled={busy} size="lg">
            <label htmlFor="construction-photo-input" className="cursor-pointer">
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Camera className="h-4 w-4 mr-2" />}
              Сурат гирифтан
            </label>
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Суратро тоза кардан танҳо директор ва соҳиби ширкат метавонад.
          </p>
        </div>
      </div>

      {photos.length === 0 ? (
        <EmptyState icon={Camera} title="Сурат нест" />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {photos.map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-card overflow-hidden">
              {urls[p.id] ? (
                <a href={urls[p.id]} target="_blank" rel="noreferrer">
                  <img src={urls[p.id]} alt={p.note ?? "Сурати объект"} className="h-40 w-full object-cover" loading="lazy" />
                </a>
              ) : (
                <div className="h-40 w-full bg-muted animate-pulse" />
              )}
              <div className="p-2 space-y-1">
                <div className="text-xs font-medium truncate">{p.project?.name ?? "—"}</div>
                <div className="text-xs text-muted-foreground truncate">{p.note || "—"}</div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(p.taken_at).toLocaleString("ru-RU")}
                  </span>
                  {canDelete && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(p)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
