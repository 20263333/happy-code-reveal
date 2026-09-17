# Интегратсияи хонаҳо: Binosoz.tj → sharora.tj

Binosoz.tj ҳолати хонаҳоро (холӣ / рассрочка / фурӯхта / банд) бо **webhook (push)**
мефиристад. Ҳар дафъа ки хона сохта, тағйир ё фурӯхта шавад — дархост меояд.

## 1. Формати дархост

```
POST  <SHARORA_WEBHOOK_URL>
Headers:
  content-type: application/json
  x-platform-signature: <HMAC-SHA256(body, SHARORA_WEBHOOK_SECRET) hex>
  x-platform-event: apartment.created | apartment.updated | apartment.snapshot
```

Body (як хона):

```json
{
  "source": "binosoz.tj",
  "event": "apartment.updated",
  "sent_at": "2026-08-24T10:00:00.000Z",
  "data": {
    "id": "uuid",
    "project_id": "uuid",
    "project_name": "ЖМ Шарқ",
    "block_name": "Блоки Л",
    "floor_number": 5,
    "apartment_number": "28",
    "rooms": 3,
    "area": 84.5,
    "price": 360600,
    "price_per_sqm": 4267,
    "status": "sold",
    "is_available": false,
    "is_historical": false,
    "updated_at": "2026-08-24T09:59:58.000Z"
  }
}
```

Body (синхронизатсияи пурра — `apartment.snapshot`):

```json
{
  "source": "binosoz.tj",
  "event": "apartment.snapshot",
  "sent_at": "...",
  "data": { "apartments": [ { ...ҳамон сохтор... } ] }
}
```

`status`: `empty` (холӣ), `reserved` (банд), `installment` (рассрочка),
`sold` (фурӯхта), `unavailable` (фурӯхта намешавад).

---

## 2. SQL — ҷадвал дар sharora.tj

```sql
CREATE TABLE public.platform_apartments (
  id uuid PRIMARY KEY,
  project_id uuid,
  project_name text,
  block_name text,
  floor_number integer,
  apartment_number text,
  rooms integer,
  area numeric,
  price numeric,
  price_per_sqm numeric,
  status text NOT NULL,
  is_available boolean NOT NULL DEFAULT false,
  is_historical boolean NOT NULL DEFAULT false,
  source_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_apartments TO anon, authenticated;
GRANT ALL ON public.platform_apartments TO service_role;

ALTER TABLE public.platform_apartments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view apartments"
  ON public.platform_apartments FOR SELECT
  USING (true);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER platform_apartments_updated_at
  BEFORE UPDATE ON public.platform_apartments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX platform_apartments_status_idx ON public.platform_apartments (status);
CREATE INDEX platform_apartments_project_idx ON public.platform_apartments (project_id);
```

---

## 3. Коди қабулкунанда (TanStack Start — агар sharora.tj дар Lovable бошад)

Файл: `src/routes/api/public/platform-apartments-webhook.ts`

```ts
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

type ApartmentDTO = {
  id: string;
  project_id: string | null;
  project_name: string | null;
  block_name: string | null;
  floor_number: number | null;
  apartment_number: string | number | null;
  rooms: number | null;
  area: number | null;
  price: number | null;
  price_per_sqm: number | null;
  status: string;
  is_available: boolean;
  is_historical: boolean;
  updated_at: string | null;
};

function toRow(a: ApartmentDTO) {
  return {
    id: a.id,
    project_id: a.project_id,
    project_name: a.project_name,
    block_name: a.block_name,
    floor_number: a.floor_number,
    apartment_number: a.apartment_number != null ? String(a.apartment_number) : null,
    rooms: a.rooms,
    area: a.area,
    price: a.price,
    price_per_sqm: a.price_per_sqm,
    status: a.status,
    is_available: !!a.is_available,
    is_historical: !!a.is_historical,
    source_updated_at: a.updated_at,
  };
}

export const Route = createFileRoute("/api/public/platform-apartments-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["PLATFORM_WEBHOOK_SECRET"];
        if (!secret) return new Response("Not configured", { status: 500 });

        const raw = await request.text();
        const provided = request.headers.get("x-platform-signature") ?? "";
        const expected = createHmac("sha256", secret).update(raw).digest("hex");
        const a = Buffer.from(provided);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: any;
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (payload.event === "apartment.snapshot") {
          const list: ApartmentDTO[] = payload?.data?.apartments ?? [];
          if (!Array.isArray(list)) return new Response("Bad request", { status: 400 });
          for (let i = 0; i < list.length; i += 500) {
            const chunk = list.slice(i, i + 500).map(toRow);
            const { error } = await supabaseAdmin
              .from("platform_apartments")
              .upsert(chunk, { onConflict: "id" });
            if (error) return new Response(error.message, { status: 500 });
          }
          return Response.json({ ok: true, count: list.length });
        }

        const apt: ApartmentDTO | null = payload?.data ?? null;
        if (!apt?.id) return new Response("Bad request", { status: 400 });

        const { error } = await supabaseAdmin
          .from("platform_apartments")
          .upsert(toRow(apt), { onConflict: "id" });
        if (error) return new Response(error.message, { status: 500 });

        return Response.json({ ok: true });
      },
    },
  },
});
```

URL-и натиҷа: `https://sharora.tj/api/public/platform-apartments-webhook`

---

## 4. Варианти Supabase Edge Function (агар sharora.tj дар Lovable набошад)

Файл: `supabase/functions/platform-apartments-webhook/index.ts`

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const enc = new TextEncoder();

async function hmacHex(secret: string, body: string) {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function toRow(a: any) {
  return {
    id: a.id,
    project_id: a.project_id,
    project_name: a.project_name,
    block_name: a.block_name,
    floor_number: a.floor_number,
    apartment_number: a.apartment_number != null ? String(a.apartment_number) : null,
    rooms: a.rooms,
    area: a.area,
    price: a.price,
    price_per_sqm: a.price_per_sqm,
    status: a.status,
    is_available: !!a.is_available,
    is_historical: !!a.is_historical,
    source_updated_at: a.updated_at,
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const secret = Deno.env.get("PLATFORM_WEBHOOK_SECRET")!;
  const raw = await req.text();
  const expected = await hmacHex(secret, raw);
  const provided = req.headers.get("x-platform-signature") ?? "";
  if (provided !== expected) return new Response("Invalid signature", { status: 401 });

  const payload = JSON.parse(raw);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const rows = payload.event === "apartment.snapshot"
    ? (payload.data?.apartments ?? []).map(toRow)
    : [toRow(payload.data)];

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase
      .from("platform_apartments")
      .upsert(rows.slice(i, i + 500), { onConflict: "id" });
    if (error) return new Response(error.message, { status: 500 });
  }

  return Response.json({ ok: true, count: rows.length });
});
```

Дар `supabase/config.toml`:

```toml
[functions.platform-apartments-webhook]
verify_jwt = false
```

URL: `https://<project-ref>.supabase.co/functions/v1/platform-apartments-webhook`

---

## 5. Намоиши хонаҳо дар sharora.tj

```tsx
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function ApartmentsList() {
  const { data } = useQuery({
    queryKey: ["platform-apartments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_apartments")
        .select("*")
        .eq("is_historical", false)
        .order("block_name")
        .order("floor_number")
        .order("apartment_number");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {(data ?? []).map((a) => (
        <div key={a.id} className="rounded-xl border p-4">
          <div className="font-semibold">
            {a.block_name ? `${a.block_name} · ` : ""}Хона №{a.apartment_number}
          </div>
          <div className="text-sm text-muted-foreground">
            Этаж {a.floor_number} · {a.area} м²
          </div>
          <div className="mt-2 font-bold">{Number(a.price ?? 0).toLocaleString()} сомонӣ</div>
          <div className="mt-1 text-sm">
            {a.is_available ? "Холӣ" : a.status === "installment" ? "Рассрочка" : "Фурӯхта шуд"}
          </div>
        </div>
      ))}
    </div>
  );
}
```

Realtime (ихтиёрӣ) — навсозии фаврии рӯйхат:

```ts
supabase
  .channel("platform-apartments")
  .on("postgres_changes",
      { event: "*", schema: "public", table: "platform_apartments" },
      () => queryClient.invalidateQueries({ queryKey: ["platform-apartments"] }))
  .subscribe();
```

---

## 6. Секретҳо

| Барнома | Ном | Қимат |
|---|---|---|
| sharora.tj | `PLATFORM_WEBHOOK_SECRET` | як пароли тасодуфӣ (масалан `openssl rand -hex 32`) |
| Binosoz.tj | `SHARORA_WEBHOOK_SECRET` | **айнан ҳамон қимат** |
| Binosoz.tj | `SHARORA_WEBHOOK_URL` | `https://sharora.tj/api/public/platform-apartments-webhook` |

Баъд аз танзим: дар Binosoz.tj → **Танзимот → Интегратсия бо sharora.tj** →
тугмаи «Синхронизатсияи пурра» — ҳамаи хонаҳо якбора мераванд.
