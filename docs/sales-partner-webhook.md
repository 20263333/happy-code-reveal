# Шарики фурӯш — webhook аз Binosoz.tj ба profit-flow-logic

Binosoz.tj ҳангоми ҳар як ҳодиса POST мефиристад ба URL-и дар секрет `SALES_PARTNER_WEBHOOK_URL` гузошта.

## 1. Секретҳо

Дар Binosoz.tj:
- `SALES_PARTNER_WEBHOOK_URL` = `https://profit-flow-logic.lovable.app/api/public/platform-sales-webhook`
- `SALES_PARTNER_WEBHOOK_SECRET` = сатри тасодуфии дароз

Дар **profit-flow-logic**: ҳамон `SALES_PARTNER_WEBHOOK_SECRET` (айнан ҳамон қимат).

## 2. Формати payload

```json
{
  "source": "binosoz.tj",
  "event": "payout.created",       // member.created | member.updated | payout.created | snapshot.sync
  "sent_at": "2026-08-24T07:00:00.000Z",
  "company": { "id": "uuid" },
  "data": { "payout": { "id": "...", "member_id": "...", "amount": 1500, "note": null, "paid_at": "..." },
            "member": { "id": "...", "fullname": "...", "email": "...", "kind": "manager", "percent": 3, "user_id": "..." } }
}
```

`snapshot.sync` (тугмаи «Синхронизатсия») мефиристад: `data.members[]` бо `earned`, `paid`, `balance` ва `data.payouts[]`.

Header-ҳо: `x-platform-event`, `x-platform-signature` = HMAC-SHA256(raw body, secret) дар hex.

## 3. Ҷадвалҳо дар profit-flow-logic (migration)

```sql
create table if not exists public.platform_partners (
  id uuid primary key default gen_random_uuid(),
  external_id text unique not null,
  company_id text not null,
  fullname text not null,
  email text,
  kind text,
  percent numeric default 0,
  earned numeric default 0,
  paid numeric default 0,
  balance numeric default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.platform_partners to authenticated;
grant all on public.platform_partners to service_role;
alter table public.platform_partners enable row level security;
create policy "read partners" on public.platform_partners for select to authenticated using (true);

create table if not exists public.platform_partner_payouts (
  id uuid primary key default gen_random_uuid(),
  external_id text unique not null,
  partner_external_id text not null,
  company_id text not null,
  amount numeric not null,
  note text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
grant select on public.platform_partner_payouts to authenticated;
grant all on public.platform_partner_payouts to service_role;
alter table public.platform_partner_payouts enable row level security;
create policy "read payouts" on public.platform_partner_payouts for select to authenticated using (true);
```

## 4. Endpoint: `src/routes/api/public/platform-sales-webhook.ts`

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

const Payload = z.object({
  source: z.literal("binosoz.tj"),
  event: z.enum(["member.created", "member.updated", "payout.created", "snapshot.sync"]),
  sent_at: z.string(),
  company: z.object({ id: z.string() }),
  data: z.any(),
});

export const Route = createFileRoute("/api/public/platform-sales-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["SALES_PARTNER_WEBHOOK_SECRET"];
        if (!secret) return new Response("secret not configured", { status: 500 });

        const raw = await request.text();
        const expected = createHmac("sha256", secret).update(raw).digest("hex");
        const got = request.headers.get("x-platform-signature") ?? "";
        const a = Buffer.from(got), b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("invalid signature", { status: 401 });
        }

        const body = Payload.parse(JSON.parse(raw));
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const companyId = body.company.id;

        if (body.event === "payout.created") {
          const p = body.data.payout, m = body.data.member;
          if (m) {
            await supabaseAdmin.from("platform_partners").upsert({
              external_id: m.id, company_id: companyId, fullname: m.fullname,
              email: m.email, kind: m.kind, percent: m.percent, updated_at: new Date().toISOString(),
            }, { onConflict: "external_id" });
          }
          await supabaseAdmin.from("platform_partner_payouts").upsert({
            external_id: p.id, partner_external_id: p.member_id, company_id: companyId,
            amount: p.amount, note: p.note, paid_at: p.paid_at,
          }, { onConflict: "external_id" });
        }

        if (body.event === "snapshot.sync") {
          const members = body.data.members ?? [];
          if (members.length) {
            await supabaseAdmin.from("platform_partners").upsert(
              members.map((m: any) => ({
                external_id: m.id, company_id: companyId, fullname: m.fullname, email: m.email,
                kind: m.kind, percent: m.percent, earned: m.earned, paid: m.paid, balance: m.balance,
                updated_at: new Date().toISOString(),
              })), { onConflict: "external_id" });
          }
          const payouts = body.data.payouts ?? [];
          if (payouts.length) {
            await supabaseAdmin.from("platform_partner_payouts").upsert(
              payouts.map((p: any) => ({
                external_id: p.id, partner_external_id: p.member_id, company_id: companyId,
                amount: p.amount, note: p.note, paid_at: p.paid_at,
              })), { onConflict: "external_id" });
          }
        }

        if (body.event === "member.created" || body.event === "member.updated") {
          const m = body.data;
          if (m?.id) {
            await supabaseAdmin.from("platform_partners").upsert({
              external_id: m.id, company_id: companyId, fullname: m.fullname, email: m.email,
              kind: m.kind, percent: m.percent, updated_at: new Date().toISOString(),
            }, { onConflict: "external_id" });
          }
        }

        return Response.json({ ok: true });
      },
    },
  },
});
```

Пас аз ин, ҳар пардохт ба Шарики фурӯш дар Binosoz.tj фавран дар profit-flow-logic пайдо мешавад; тугмаи «Синхронизатсия» тамоми маълумотро якбора мефиристад.
