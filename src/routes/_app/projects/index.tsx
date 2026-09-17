import { uuid } from "@/lib/uuid";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { createProject } from "@/lib/projects.functions";
import { Plus, Building2, MapPin, Trash2, ImagePlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PROJECT_STATUS } from "@/lib/constants";
import { useAuth } from "@/hooks/use-auth";
import { useT } from "@/lib/i18n";
import { toast } from "sonner";


export const Route = createFileRoute("/_app/projects/")({
  head: () => ({ meta: [{ title: "Проекты — Binosoz.tj" }] }),
  component: ProjectsList,
});

function ProjectsList() {
  const { isOwner, isDirector } = useAuth();
  const { t, tr } = useT();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const canModify = isOwner && !isDirector;

  const { data: projectsData } = useQuery({
    queryKey: ["projects"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, location, status, cover_url, created_at, children:projects!parent_id(id, apartments(status))")
        .is("parent_id", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const paths = (data ?? [])
        .map((p: any) => p.cover_url)
        .filter((u: any): u is string => !!u && !u.startsWith("http"));
      const coverMap: Record<string, string> = {};
      if (paths.length) {
        const { data: signed } = await supabase.storage
          .from("project-covers")
          .createSignedUrls(paths, 60 * 60);
        for (const s of signed ?? []) if (s.path && s.signedUrl) coverMap[s.path] = s.signedUrl;
      }
      return { projects: data ?? [], coverMap };
    },
  });

  const projects = projectsData?.projects ?? [];
  const coverMap = projectsData?.coverMap ?? {};

  const resolveCover = (u?: string | null) => {
    if (!u) return null;
    if (u.startsWith("http")) return u;
    return coverMap[u] ?? null;
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={tr("Проекты")}
        subtitle={tr("Все жилые комплексы и объекты застройки.")}
        actions={canModify && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> {tr("Новый проект")}</Button>
            </DialogTrigger>
            <NewProjectDialog onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["projects"] }); }} />
          </Dialog>
        )}
      />

      {projects.length === 0 ? (
        <EmptyState icon={Building2} title={tr("Проектов пока нет")} description={tr("Создайте первый проект, чтобы начать работу.")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p: any) => {
            const blocks = p.children ?? [];
            const blockCount = blocks.length;
            const total = blocks.reduce((s: number, b: any) => s + (b.apartments?.length ?? 0), 0);
            const sold = blocks.reduce((s: number, b: any) => s + (b.apartments?.filter((a: any) => a.status === "sold").length ?? 0), 0);
            const cover = resolveCover(p.cover_url);
            return (
              <div key={p.id} className="group relative overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)] transition hover:border-accent hover:shadow-[var(--shadow-elegant)]">
                {canModify && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async (e) => {
                      e.preventDefault(); e.stopPropagation();
                      if (!confirm(`${tr("Удалить проект")} "${p.name}"? ${tr("Все данные будут потеряны.")}`)) return;
                      const { error } = await supabase.from("projects").delete().eq("id", p.id);
                      if (error) toast.error(error.message);
                      else { toast.success(tr("Удалено")); qc.invalidateQueries({ queryKey: ["projects"] }); }
                    }}
                    className="absolute top-2 right-2 z-10 h-8 w-8 bg-background/80 text-destructive opacity-0 backdrop-blur group-hover:opacity-100 hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <Link to="/projects/$id" params={{ id: p.id }} className="block">
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-primary/10 via-muted to-accent/10">
                    {cover ? (
                      <img src={cover} alt={p.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Building2 className="h-16 w-16 text-primary/40" />
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent" />
                    <Badge variant="secondary" className="absolute top-2 left-2 backdrop-blur">{t(PROJECT_STATUS[p.status as keyof typeof PROJECT_STATUS] as any)}</Badge>
                    {cover && (
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <h3 className="font-display text-lg font-semibold tracking-tight text-white drop-shadow">{p.name}</h3>
                        {p.location && (
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-white/90">
                            <MapPin className="h-3 w-3" /> {p.location}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    {!cover && (
                      <>
                        <h3 className="font-display text-lg font-semibold tracking-tight">{p.name}</h3>
                        {p.location && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" /> {p.location}
                          </p>
                        )}
                      </>
                    )}


                    <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
                      <span className="text-muted-foreground">{tr("Блоков:")} <b className="text-foreground">{blockCount}</b></span>
                      <span className="text-muted-foreground">{tr("Квартир:")} <b className="text-foreground">{total}</b></span>
                      <span className="text-success">{tr("Продано:")} <b>{sold}</b></span>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NewProjectDialog({ onClose }: { onClose: () => void }) {
  const { t, tr } = useT();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"planning" | "in_progress" | "completed" | "paused">("in_progress");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { companyId } = useAuth();
  const createFn = useServerFn(createProject);

  useEffect(() => {
    if (!coverFile) { setCoverPreview(null); return; }
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Шумо ҳоло ба ягон ширкат тааллуқ надоред");
      let cover_url: string | null = null;
      if (coverFile) {
        const ext = coverFile.name.split(".").pop() || "jpg";
        const path = `${companyId}/${uuid()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("project-covers")
          .upload(path, coverFile, { contentType: coverFile.type, upsert: false });
        if (upErr) throw upErr;
        cover_url = path;
      }
      await createFn({ data: { name, location: location || null, description: description || null, status, cover_url } });
    },
    onSuccess: () => { toast.success("Лоиҳа сохта шуд"); onClose(); },
    onError: (e: any) => { console.error(e); toast.error(e?.message || "Хатогӣ"); },
  });

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{tr("Новый проект")}</DialogTitle></DialogHeader>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
        <div className="space-y-2">
          <Label>{tr("Фото проекта") || "Сурати лоиҳа"}</Label>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
          />
          {coverPreview ? (
            <div className="relative h-40 w-full overflow-hidden rounded-lg border border-border">
              <img src={coverPreview} alt="" className="h-full w-full object-cover" />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => { setCoverFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                className="absolute top-2 right-2 h-7 w-7 bg-background/80 backdrop-blur"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-32 w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-sm text-muted-foreground transition hover:border-accent hover:text-accent"
            >
              <ImagePlus className="h-5 w-5" /> {tr("Добавить фото") || "Сурат илова кунед"}
            </button>
          )}
        </div>
        <div className="space-y-2">
          <Label>{tr("Название")}</Label>
          <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("ЖК Восток")} />
        </div>
        <div className="space-y-2">
          <Label>{tr("Адрес")}</Label>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={tr("Москва, ул. ...")} />
        </div>
        <div className="space-y-2">
          <Label>{tr("Описание")}</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>
        <div className="space-y-2">
          <Label>{tr("Статус")}</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(PROJECT_STATUS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{t(v as any)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={mutation.isPending}>{tr("Создать")}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
