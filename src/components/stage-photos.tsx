import { uuid } from "@/lib/uuid";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { compressImageFile } from "@/lib/image-compress";
import { toast } from "sonner";

const BUCKET = "construction-photos";

/** Аксҳои санҷиши як марҳила. */
export function StagePhotos({ stageId, projectId, companyId, canEdit, canDelete }: {
  stageId: string; projectId: string; companyId: string | null; canEdit: boolean; canDelete: boolean;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});

  const { data: photos = [] } = useQuery({
    queryKey: ["stage-photos", stageId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("construction_photos")
        .select("id, photo_path, taken_at").eq("stage_id", stageId)
        .order("taken_at", { ascending: false }).limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const missing = photos.filter((p: any) => !urls[p.id]);
      if (!missing.length) return;
      const next: Record<string, string> = {};
      for (const p of missing) {
        const { data } = await supabase.storage.from(BUCKET).createSignedUrl(p.photo_path, 3600);
        if (data?.signedUrl) next[p.id] = data.signedUrl;
      }
      if (!cancelled && Object.keys(next).length) setUrls((u) => ({ ...u, ...next }));
    })();
    return () => { cancelled = true; };
  }, [photos, urls]);

  const upload = async (file: File | undefined) => {
    if (!file || !companyId) return;
    setBusy(true);
    try {
      const dataUrl = await compressImageFile(file, { maxSize: 1800, quality: 0.85 });
      const blob = await (await fetch(dataUrl)).blob();
      const path = `${companyId}/${projectId}/${uuid()}.jpg`;
      const { error: upErr } = await supabase.storage.from(BUCKET)
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (upErr) throw new Error(upErr.message);
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("construction_photos").insert({
        company_id: companyId, project_id: projectId, stage_id: stageId,
        photo_path: path, created_by: user?.id,
      });
      if (error) throw new Error(error.message);
      toast.success("Сурат сабт шуд");
      qc.invalidateQueries({ queryKey: ["stage-photos", stageId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Хатогӣ");
    } finally { setBusy(false); }
  };

  const remove = async (p: any) => {
    if (!confirm("Ин суратро тоза кунем?")) return;
    const { error } = await (supabase as any).from("construction_photos").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    await supabase.storage.from(BUCKET).remove([p.photo_path]);
    qc.invalidateQueries({ queryKey: ["stage-photos", stageId] });
  };

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase">Аксҳои санҷиш ({photos.length})</span>
        {canEdit && (
          <label>
            <input type="file" accept="image/*" capture="environment" className="hidden"
              onChange={(e) => upload(e.target.files?.[0])} />
            <Button size="sm" variant="outline" asChild disabled={busy}>
              <span>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5 mr-1" />}Сурат</span>
            </Button>
          </label>
        )}
      </div>
      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {photos.map((p: any) => (
            <div key={p.id} className="relative group">
              {urls[p.id]
                ? <img src={urls[p.id]} alt="Акси санҷиши марҳила" loading="lazy" className="h-20 w-full object-cover rounded-md border border-border" />
                : <div className="h-20 w-full rounded-md bg-muted animate-pulse" />}
              {canDelete && (
                <button type="button" onClick={() => remove(p)}
                  className="absolute top-1 right-1 rounded bg-background/80 p-1 text-destructive opacity-0 group-hover:opacity-100">
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
