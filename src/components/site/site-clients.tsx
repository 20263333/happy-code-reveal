import { useEffect, useState } from "react";
import { Building2, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/lib/i18n";

type Item = {
  id: string;
  company_name: string;
  logo_url: string | null;
  website: string | null;
};

export function SiteClients() {
  const { tr } = useT();
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    let active = true;
    (supabase as any)
      .from("showcase_companies_public")
      .select("id, company_name, logo_url, website")
      .order("sort_order", { ascending: true })
      .then(({ data }: any) => {
        if (active) setItems((data ?? []) as Item[]);
      });
    return () => {
      active = false;
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <section id="clients" className="scroll-mt-20 bg-card px-5 py-20 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-xs font-bold uppercase tracking-widest text-primary">{tr("Клиенты")}</div>
          <h2 className="mt-3 font-display text-3xl font-extrabold uppercase md:text-5xl">
            {tr("Пользователи Binosoz.tj")}
          </h2>
          <p className="mt-4 text-sm leading-7 text-muted-foreground md:text-base">
            {tr("Кто уже работает с Binosoz.tj")}
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-background transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-xl"
            >
              <div className="relative aspect-square w-full overflow-hidden bg-muted">
                {item.logo_url ? (
                  <img
                    src={item.logo_url}
                    alt={item.company_name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Building2 className="h-24 w-24 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex flex-col items-center gap-2 p-5 text-center">
                <div className="font-display text-base font-bold leading-tight">{item.company_name}</div>
                {item.website && (
                  <a
                    href={item.website.startsWith("http") ? item.website : `https://${item.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    {tr("Сайт")}
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
