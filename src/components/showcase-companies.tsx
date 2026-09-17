import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Globe, ChevronLeft, ChevronRight } from "lucide-react";
import { useT } from "@/lib/i18n";

type Item = {
  id: string;
  company_name: string;
  logo_url: string | null;
  website: string | null;
};

const CAROUSEL_THRESHOLD = 2;

export function ShowcaseCompanies() {
  const { tr } = useT();
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    (supabase as any)
      .from("showcase_companies_public")
      .select("id, company_name, logo_url, website")
      .order("sort_order", { ascending: true })
      .then(({ data }: any) => setItems(data ?? []));
  }, []);

  if (items.length === 0) return null;

  const useCarousel = items.length > CAROUSEL_THRESHOLD;

  return (
    <div className="mt-10 border-t border-border pt-8">
      <h2 className="text-center font-display text-xl font-semibold">
        {tr("Истифодабарандагони Binosoz.tj")}
      </h2>
      <p className="mt-1 text-center text-xs text-muted-foreground">
        {tr("Кӣ аллакай бо Binosoz.tj кор мекунад")}
      </p>

      {useCarousel ? (
        <Carousel items={items} label={tr("Сайт")} />
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {items.map((it) => (
            <CompanyCard key={it.id} item={it} label={tr("Сайт")} />
          ))}
        </div>
      )}
    </div>
  );
}

function CompanyCard({ item, label }: { item: Item; label: string }) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-xl">
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {item.logo_url ? (
          <img
            src={item.logo_url}
            alt={item.company_name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Building2 className="h-28 w-28 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="flex flex-col items-center gap-2 p-4 text-center">
        <div className="text-base font-semibold leading-tight line-clamp-2">{item.company_name}</div>
        {item.website && (
          <a
            href={item.website.startsWith("http") ? item.website : `https://${item.website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Globe className="h-3.5 w-3.5" />
            {label}
          </a>
        )}
      </div>
    </div>
  );
}

function Carousel({ items, label }: { items: Item[]; label: string }) {
  const [offset, setOffset] = useState(0);
  const pausedRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      if (!pausedRef.current) setOffset((o) => (o + 1) % items.length);
    }, 3000);
    return () => clearInterval(id);
  }, [items.length]);

  const loop = [...items, ...items];

  const prev = () => setOffset((o) => (o - 1 + items.length) % items.length);
  const next = () => setOffset((o) => (o + 1) % items.length);

  return (
    <div className="relative mt-6 flex items-center gap-3">
      <button
        type="button"
        onClick={prev}
        aria-label="Previous"
        className="shrink-0 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background shadow-md transition hover:bg-primary hover:text-primary-foreground"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <div
        className="flex-1 overflow-hidden"
        onMouseEnter={() => (pausedRef.current = true)}
        onMouseLeave={() => (pausedRef.current = false)}
      >
        <div
          className="flex gap-6 transition-transform duration-700 ease-in-out"
          style={{
            transform: `translateX(-${offset * (100 / getPerView())}%)`,
          }}
        >
          {loop.map((it, i) => (
            <div key={`${it.id}-${i}`} className="w-full shrink-0 sm:w-1/2 lg:w-1/2">
              <CompanyCard item={it} label={label} />
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={next}
        aria-label="Next"
        className="shrink-0 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background shadow-md transition hover:bg-primary hover:text-primary-foreground"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}

function getPerView() {
  if (typeof window === "undefined") return 2;
  if (window.innerWidth >= 1024) return 2;
  if (window.innerWidth >= 640) return 2;
  return 1;
}
