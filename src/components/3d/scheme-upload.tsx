import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, Trash2, Loader2, Map } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { setProjectSchemeImage, getProjectSchemeSignedUrl } from "@/lib/facade-3d.functions";
import { ZoomableImage } from "@/components/kiosk/zoomable-image";
import { fixStorageUrl } from "@/lib/storage-url";
import { toast } from "sonner";

const BUCKET = "project-3d-models";

export function SchemeUpload({
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
  const setFn = useServerFn(setProjectSchemeImage);
  const getSignedFn = useServerFn(getProjectSchemeSignedUrl);

  const { data: signed, isFetching } = useQuery({
    queryKey: ["scheme-signed", projectId, currentPath],
    queryFn: () => getSignedFn({ data: { project_id: projectId } }),
    enabled: !!currentPath,
  });

  const setMut = useMutation({
    mutationFn: (path: string | null) => setFn({ data: { project_id: projectId, path } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheme-signed", projectId] });
      onUpdated?.();
    },
  });

  async function handleFile(file: File) {
    if (!/\.(png|jpe?g|webp)$/i.test(file.name)) {
      toast.error("Танҳо расм (.png, .jpg, .webp)");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Файл аз 20 MB зиёд аст");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${companyId}/${projectId}/scheme-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "image/png",
      });
      if (error) throw new Error(error.message);
      await setMut.mutateAsync(path);
      toast.success("Схема бор карда шуд");
    } catch (e: any) {
      toast.error(e.message || "Хатогӣ");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Схемаро тоза кунам?")) return;
    await setMut.mutateAsync(null);
    toast.success("Тоза шуд");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.webp,image/*"
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
          {currentPath ? "Иваз кардан" : "Бор кардани схема"}
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
            <Map className="h-3.5 w-3.5" /> Схема фаъол аст — дар киоск ба муштариён нишон дода мешавад
          </span>
        )}
      </div>

      {currentPath && (
        <div className="h-[520px] overflow-hidden rounded-xl border border-border bg-muted/30">
          {isFetching && !signed?.url ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : signed?.url ? (
            <ZoomableImage src={fixStorageUrl(signed.url)!} alt="Схемаи лоиҳа" />
          ) : null}
        </div>
      )}
    </div>
  );
}
