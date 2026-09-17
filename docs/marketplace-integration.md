# Binosoz Market — endpoint to receive listings from Binosoz.tj

Copy the two files below into project **Binosoz Homes** (https://binosoz-casa.lovable.app) and add one secret. Then the "Ба Binosoz Market" button in Binosoz.tj will start working.

## 1. Add secret in Binosoz Homes

`MARKETPLACE_SYNC_SECRET` — **paste the SAME value** you saved in Binosoz.tj.

## 2. Migration

```sql
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS external_ref text,
  ADD COLUMN IF NOT EXISTS source text;

-- Агар пештар як квартира якчанд бор фиристода шуда бошад, duplicate-ҳоро тоза мекунад
DELETE FROM public.listings a
USING public.listings b
WHERE a.external_ref IS NOT NULL
  AND a.external_ref = b.external_ref
  AND a.id > b.id;

-- Муҳим: ин индекс БЕ "WHERE external_ref IS NOT NULL" бошад,
-- вагарна upsert(... onConflict: "external_ref") кор намекунад.
DROP INDEX IF EXISTS public.ux_listings_external_ref;

CREATE UNIQUE INDEX IF NOT EXISTS ux_listings_external_ref
  ON public.listings(external_ref);
```

## 3. Server route: `src/routes/api/public/import-listings.ts`

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Payload = z.object({
  source: z.string(),
  company: z.object({ id: z.string(), name: z.string(), phone: z.string().nullable().optional() }),
  project: z.object({ id: z.string(), name: z.string(), location: z.string().nullable().optional() }).nullable(),
  block: z.object({ id: z.string(), name: z.string() }),
  listings: z.array(z.object({
    external_ref: z.string(),
    title: z.string(),
    description: z.string(),
    price: z.number().nullable(),
    currency: z.string(),
    location: z.string().nullable(),
    images: z.array(z.string()),
  }).passthrough()),
});

export const Route = createFileRoute("/api/public/import-listings")({
  server: { handlers: {
    POST: async ({ request }) => {
      const expected = process.env.MARKETPLACE_SYNC_SECRET;
      if (!expected) return new Response("secret not configured", { status: 500 });
      if (request.headers.get("x-sync-secret") !== expected) {
        return new Response("unauthorized", { status: 401 });
      }
      const body = Payload.parse(await request.json());
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // Owner-и marketplace ба ин listings-ҳо: истифодабари системавии Market
      // ё owner-и ҳамон ширкат агар бо email ҳамоҳанг бошад. Ин ҷо оддӣ:
      // owner_id = owner-и аввалини admin. Иваз кун агар хоҳӣ.
      const { data: admin } = await supabaseAdmin
        .from("profiles").select("id").limit(1).maybeSingle();
      const ownerId = admin?.id;
      if (!ownerId) return new Response("no owner", { status: 500 });

      const rows = body.listings.map(l => ({
        owner_id: ownerId,
        title: l.title,
        description: l.description,
        price: l.price,
        currency: l.currency,
        location: l.location,
        images: l.images,
        status: "pending" as const,
        external_ref: l.external_ref,
        source: body.source,
      }));

      const { data, error } = await supabaseAdmin
        .from("listings")
        .upsert(rows, { onConflict: "external_ref" })
        .select("id, external_ref");
      if (error) return new Response(error.message, { status: 500 });

      const listing_ids: Record<string, string> = {};
      for (const r of data ?? []) if (r.external_ref) listing_ids[r.external_ref] = r.id;

      return Response.json({ imported: data?.length ?? 0, listing_ids });
    },
  } },
});
```

Пас аз ин, тугмаи «Ба Binosoz Market» дар Binosoz.tj дар ҳар як блок кор мекунад.
