import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, Trash2, Info, Loader2, Box } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { setProject3dModel, getProject3dSignedUrl } from "@/lib/facade-3d.functions";
import { toast } from "sonner";
import { Facade3dTab } from "./facade-3d-tab";

const BUCKET = "project-3d-models";

export function Facade3dUpload({
  projectId,
  companyId,
  currentPath,
  onUpdated,
}: {
  projectId: string;
  companyId: string;
  currentPath: string | null | undefined;
  onUpdated?: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const setFn = useServerFn(setProject3dModel);
  const getSignedFn = useServerFn(getProject3dSignedUrl);

  const { data: signed, isFetching } = useQuery({
    queryKey: ["facade-3d-signed", projectId, currentPath],
    queryFn: () => getSignedFn({ data: { project_id: projectId } }),
    enabled: !!currentPath,
  });

  const setMut = useMutation({
    mutationFn: (path: string | null) => setFn({ data: { project_id: projectId, path } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["facade-3d-signed", projectId] });
      onUpdated?.();
    },
  });

  async function handleFile(file: File) {
    if (!/\.(glb|gltf)$/i.test(file.name)) {
      toast.error("Танҳо .glb ё .gltf");
      return;
    }
    if (file.size > 60 * 1024 * 1024) {
      toast.error("Файл аз 60 MB зиёд аст");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${companyId}/${projectId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || (ext === "glb" ? "model/gltf-binary" : "model/gltf+json"),
      });
      if (error) throw new Error(error.message);
      await setMut.mutateAsync(path);
      toast.success("Модели 3D бор карда шуд");
    } catch (e: any) {
      toast.error(e.message || "Хатогӣ");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Модели 3D-ро тоза кунам?")) return;
    await setMut.mutateAsync(null);
    toast.success("Тоза шуд");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border border-accent/30 bg-accent/5 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <div className="space-y-1">
          <p className="font-medium text-foreground">Конвенцияи ном дар Blender/GLB:</p>
          <p>
            Этажҳо — <code className="rounded bg-muted px-1">Floor_1</code>,{" "}
            <code className="rounded bg-muted px-1">Floor_2</code> …
          </p>
          <p>
            Квартираҳо — <code className="rounded bg-muted px-1">Apt_101</code>,{" "}
            <code className="rounded bg-muted px-1">Apt_102</code> … (рақами онҳо ба квартираҳои системаи мо мутобиқат кунад)
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {currentPath ? "Иваз кардан" : "Бор кардан (.glb)"}
        </button>
        {currentPath && (
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-2 rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" /> Тоза кардан
          </button>
        )}
        {currentPath && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Box className="h-3.5 w-3.5" /> Модели фаъол
          </span>
        )}
      </div>

      {currentPath && (
        <div className="h-[520px] overflow-hidden rounded-xl border border-border">
          {isFetching && !signed?.url ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <Facade3dTab modelUrl={signed?.url ?? null} />
          )}
        </div>
      )}
    </div>
  );
}
