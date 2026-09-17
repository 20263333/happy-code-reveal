# Binosoz Market — SSO аз Binosoz.tj

Тугмаи «Ба Binosoz Market» ва «Кушодани кабинет дар Market» аз Binosoz.tj ба ин endpoint дар лоиҳаи **Binosoz Homes** (https://binosoz-casa.lovable.app) мурочиат мекунанд. Пас аз даромадан ба Market, соҳиби ширкат бе воридкунии SMS/паррол кабинети худро мекушояд (тавассути телефони ширкат).

## 1. Секрет

`MARKETPLACE_SYNC_SECRET` — ҳамон қиматеро, ки дар Binosoz.tj гузоштаед, дар Binosoz Homes ҳам бо ҳамин ном илова кунед.

## 2. Server route: `src/routes/api/public/sso-login.ts`

```typescript
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Payload = z.object({
  source: z.string(),
  external_user_id: z.string(),
  phone: z.string().min(6),
  fullname: z.string().optional().nullable(),
  company: z.object({
    id: z.string(),
    name: z.string(),
    phone: z.string().nullable().optional(),
  }),
});

// Телефонро ба формати ягона табдил медиҳем: танҳо рақамҳо, + дар аввал
function normPhone(p: string) {
  const t = p.replace(/[^\d+]/g, "");
  return t.startsWith("+") ? t : `+${t.replace(/^0+/, "")}`;
}

export const Route = createFileRoute("/api/public/sso-login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.MARKETPLACE_SYNC_SECRET;
        if (!expected) return new Response("secret not configured", { status: 500 });
        if (request.headers.get("x-sync-secret") !== expected) {
          return new Response("unauthorized", { status: 401 });
        }
        const body = Payload.parse(await request.json());
        const phone = normPhone(body.phone);
        const email = `tj_${phone.replace(/[^\d]/g, "")}@binosoz.market`;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // 1) Корбарро аз рӯи телефон/email пайдо кун ё созед
        let userId: string | null = null;
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
        const found = list?.users?.find(u => u.phone === phone || u.email === email);
        if (found) {
          userId = found.id;
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            phone,
            email,
            phone_confirm: true,
            email_confirm: true,
            user_metadata: {
              fullname: body.fullname ?? undefined,
              company_name: body.company.name,
              source: body.source,
              external_user_id: body.external_user_id,
            },
          });
        } else {
          const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
            phone,
            email,
            phone_confirm: true,
            email_confirm: true,
            user_metadata: {
              fullname: body.fullname ?? null,
              company_name: body.company.name,
              source: body.source,
              external_user_id: body.external_user_id,
            },
          });
          if (error || !created?.user) return new Response(error?.message ?? "createUser failed", { status: 500 });
          userId = created.user.id;
        }

        // 2) Magic-link созед — истифодабаранда бо клик автоматӣ ворид мешавад
        const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email,
          options: { redirectTo: `${new URL(request.url).origin}/` },
        });
        if (linkErr || !link?.properties?.action_link) {
          return new Response(linkErr?.message ?? "generateLink failed", { status: 500 });
        }

        return Response.json({ url: link.properties.action_link, user_id: userId });
      },
    },
  },
});
```

## 3. Талаботи Auth дар Binosoz Homes

- Email provider фаъол бошад (magic-link истифода мекунад).
- Дар Auth → URL Configuration Site URL ва redirect URL ба `https://binosoz-casa.lovable.app` (ва домени custom-и худ) илова карда шаванд.

Пас аз ин, вақте ки соҳиби ширкат аз Binosoz.tj тугмаро пахш мекунад, дар як табчаи нав мустақим ба кабинети худ дар Binosoz Market ворид мешавад.
