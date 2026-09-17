import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Home, MapPin, Phone, Building2, CheckCircle2, X, Box, LayoutGrid } from "lucide-react";
import { getPublicShowcase } from "@/lib/showcase.functions";
import { getPublic3dSignedUrl } from "@/lib/facade-3d.functions";
import { Facade3dTab } from "@/components/3d/facade-3d-tab";

export const Route = createFileRoute("/p/$id")({
  head: ({ params }) => ({
    meta: [
      { title: "Холати фурӯши хонаҳо — BINO SOZ" },
      { name: "description", content: "Кадом хонаҳо фурӯхта шудаанд ва кадомаш холӣ — сканер кунед ва бубинед." },
      { property: "og:title", content: "Холати фурӯши хонаҳо — BINO SOZ" },
      { property: "og:description", content: "Витринаи оммавии ЖК: холати квартираҳо, нархҳо ва схемаҳо." },
      { property: "og:url", content: `https://binosoz.tj/p/${params.id}` },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `https://binosoz.tj/p/${params.id}` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: "Витринаи ЖК — BINO SOZ",
          description: "Холати фурӯши квартираҳо дар лоиҳаи сохтмонӣ.",
          url: `https://binosoz.tj/p/${params.id}`,
          brand: { "@type": "Brand", name: "Binosoz.tj" },
        }),
      },
    ],
  }),
  component: PublicShowcase,
});


const STATUS_META: Record<string, { label: string; dot: string; chip: string }> = {
  sold: { label: "Фурӯхта", dot: "bg-destructive", chip: "bg-destructive/10 text-destructive border-destructive/25" },
  installment: { label: "Рассрочка", dot: "bg-accent", chip: "bg-accent/10 text-accent border-accent/25" },
  empty: { label: "Холӣ", dot: "bg-success", chip: "bg-success/10 text-success border-success/25" },
  reserved: { label: "Банд", dot: "bg-warning", chip: "bg-warning/15 text-warning-foreground border-warning/30" },
};

function PublicShowcase() {
  const { id } = Route.useParams();
  const [selectedApt, setSelectedApt] = useState<any | null>(null);
  const [view, setView] = useState<"floors" | "3d">("floors");
  const sign3d = useServerFn(getPublic3dSignedUrl);

  const { data, isLoading } = useQuery({
    queryKey: ["public-showcase", id],
    queryFn: () => getPublicShowcase({ data: { id } }),
  });

  const { data: model3d } = useQuery({
    queryKey: ["public-3d", id],
    queryFn: () => sign3d({ data: { project_id: id } }),
    enabled: !!data?.ok,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span className="text-sm">Боркунӣ...</span>
        </div>
      </div>
    );
  }

  if (!data?.ok) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-muted/30 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card shadow-[var(--shadow-card)]">
          <Building2 className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="font-display text-xl font-bold">Саҳифа дастрас нест</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Ин лоиҳа дар ҳоли ҳозир намоиши оммавӣ надорад.
        </p>
      </div>
    );
  }

  const { project, company, floors, stats, showPrices } = data;
  const fmt = (n: number | null) =>
    n == null ? "" : new Intl.NumberFormat("ru-RU").format(Number(n)) + " сом.";

  const soldPct = stats.total ? Math.round(((stats.sold + stats.installment) / stats.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Hero */}
      <div className="relative overflow-hidden">
        {project.cover_url ? (
          <img
            src={project.cover_url}
            alt={project.name}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
        <div
          className="absolute inset-0"
          style={{
            background: project.cover_url
              ? "linear-gradient(to top, oklch(0.18 0.04 260 / 0.92), oklch(0.18 0.04 260 / 0.55))"
              : "var(--gradient-primary)",
          }}
        />
        <div className="relative mx-auto max-w-2xl px-5 pb-9 pt-10 text-primary-foreground">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground/70">
            {company.name ?? "Ширкати сохтмонӣ"}
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold leading-tight">{project.name}</h1>
          {project.location && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-primary-foreground/85">
              <MapPin className="h-4 w-4" /> {project.location}
            </p>
          )}

          {/* Sold progress */}
          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-primary-foreground/85">
              <span>Фурӯш рафта</span>
              <span>{soldPct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-primary-foreground/20">
              <div className="h-full rounded-full bg-success transition-all" style={{ width: `${soldPct}%` }} />
            </div>
          </div>

          {company.phone && (
            <a
              href={`tel:${company.phone}`}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary-foreground px-4 py-2.5 text-sm font-semibold text-primary shadow-[var(--shadow-elegant)] transition-transform active:scale-95"
            >
              <Phone className="h-4 w-4" /> {company.phone}
            </a>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-6">
        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Ҳамагӣ" value={stats.total} dot="bg-foreground/40" />
          <Stat label="Фурӯхта" value={stats.sold} dot="bg-destructive" />
          <Stat label="Рассрочка" value={stats.installment} dot="bg-accent" />
          <Stat label="Холӣ" value={stats.empty} dot="bg-success" />
        </div>

        {/* Legend */}
        <div className="mb-5 flex flex-wrap gap-x-4 gap-y-2 rounded-xl border border-border bg-card px-4 py-3 text-xs">
          {Object.entries(STATUS_META).map(([k, m]) => (
            <span key={k} className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
              <span className={`h-2.5 w-2.5 rounded-full ${m.dot}`} /> {m.label}
            </span>
          ))}
        </div>

        {/* View toggle (only if a 3D model exists) */}
        {model3d?.url && (
          <div className="mb-4 inline-flex overflow-hidden rounded-xl border border-border bg-card">
            <button
              onClick={() => setView("floors")}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold ${view === "floors" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Ошёнаҳо
            </button>
            <button
              onClick={() => setView("3d")}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold ${view === "3d" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              <Box className="h-3.5 w-3.5" /> 3D фасад
            </button>
          </div>
        )}

        {view === "3d" && model3d?.url ? (
          <div className="h-[70vh] overflow-hidden rounded-2xl border border-border bg-neutral-900">
            <Facade3dTab
              modelUrl={model3d.url}
              apartments={floors.flatMap((f: any) =>
                (f.apartments ?? []).map((a: any) => ({ ...a, floor_number: f.floor_number })),
              )}
              onApartmentClick={(a: any) => setSelectedApt(a)}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {floors.map((floor: any) => (
              <div
                key={floor.floor_number}
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]"
              >
                <div className="flex items-center gap-2 border-b border-border bg-secondary/40 px-4 py-2.5">
                  <Building2 className="h-4 w-4 text-accent" />
                  <h2 className="font-display text-sm font-bold">{floor.floor_number}-ум этаж</h2>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {floor.apartments.length} хона
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-3">
                  {floor.apartments.map((apt: any, i: number) => {
                    const m = STATUS_META[apt.status] ?? STATUS_META.empty;
                    return (
                      <button
                        type="button"
                        key={i}
                        onClick={() => setSelectedApt(apt)}
                        className={`rounded-xl border p-3 text-left transition-transform active:scale-95 ${m.chip} ${apt.plan_url ? "ring-1 ring-inset ring-foreground/10 hover:ring-foreground/30" : ""}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold">№ {apt.apartment_number}</span>
                          <span className={`h-2.5 w-2.5 rounded-full ${m.dot}`} />
                        </div>
                        <div className="mt-1.5 text-[11px] opacity-80">
                          {apt.area ? `${apt.area} м²` : ""}{apt.rooms ? ` · ${apt.rooms} хона` : ""}
                        </div>
                        <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold">
                          {apt.status === "sold" && <CheckCircle2 className="h-3 w-3" />}
                          {m.label}
                        </div>
                        {showPrices && apt.status !== "sold" && apt.price ? (
                          <div className="mt-1 text-[11px] font-bold">{fmt(apt.price)}</div>
                        ) : null}
                        {apt.plan_url ? (
                          <div className="mt-1 text-[10px] font-medium opacity-70">📐 Схема</div>
                        ) : null}
                      </button>
                    );
                  })}
                  {floor.apartments.length === 0 && (
                    <p className="col-span-full text-xs text-muted-foreground">Хона нест</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <footer className="mt-8 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Home className="h-3.5 w-3.5" /> BINO SOZ
        </footer>
      </div>

      {selectedApt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setSelectedApt(null)}
        >
          <button
            type="button"
            onClick={() => setSelectedApt(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <div
            className="w-full max-w-2xl overflow-hidden rounded-2xl bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-border px-5 py-3">
              <h3 className="font-display text-lg font-bold">Квартира № {selectedApt.apartment_number}</h3>
              <p className="text-xs text-muted-foreground">
                {selectedApt.area ? `${selectedApt.area} м²` : ""}
                {selectedApt.rooms ? ` · ${selectedApt.rooms} хона` : ""}
              </p>
            </div>
            <div className="bg-muted/30">
              {selectedApt.plan_url ? (
                <img src={selectedApt.plan_url} alt={`Схема планировки квартиры № ${selectedApt.apartment_number}`} className="max-h-[70vh] w-full object-contain" />
              ) : (
                <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                  Схема нест
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 text-center shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-center gap-1.5">
        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
        <span className="font-display text-2xl font-bold">{value}</span>
      </div>
      <p className="mt-1 text-[11px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
