import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LowStockItem = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  min_quantity: number;
};

export type LowStockResult = {
  low: LowStockItem[];
  created: number;
  resolved: number;
  smsSent: number;
  smsError: string | null;
};

// Захираҳои камшударо месанҷад, огоҳиҳо (supply_alerts) месозад ва
// ба снабженецҳои ширкат СМС мефиристад.
export const checkLowStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LowStockResult> => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: prof } = await admin
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    const { data: owned } = await admin
      .from("companies")
      .select("id")
      .eq("owner_user_id", userId)
      .maybeSingle();
    const companyId: string | null = prof?.company_id ?? owned?.id ?? null;
    if (!companyId) return { low: [], created: 0, resolved: 0, smsSent: 0, smsError: null };

    const { data: itemRows } = await admin
      .from("warehouse_items")
      .select("id, name, unit, quantity, min_quantity")
      .eq("company_id", companyId);

    const items = ((itemRows ?? []) as any[]).map((i) => ({
      id: i.id as string,
      name: i.name as string,
      unit: (i.unit ?? "") as string,
      quantity: Number(i.quantity ?? 0),
      min_quantity: Number(i.min_quantity ?? 10),
    }));
    const low = items.filter((i) => i.quantity < i.min_quantity);

    const { data: openRows } = await admin
      .from("supply_alerts")
      .select("id, item_id, quantity")
      .eq("company_id", companyId)
      .eq("resolved", false);
    const open = (openRows ?? []) as any[];
    const openByItem = new Map(open.map((a) => [a.item_id as string, a]));

    // Огоҳиҳои кӯҳна, ки захира дубора пур шудааст — пӯшида мешаванд
    const lowIds = new Set(low.map((i) => i.id));
    const toResolve = open.filter((a) => !lowIds.has(a.item_id)).map((a) => a.id);
    if (toResolve.length) {
      await admin.from("supply_alerts").update({ resolved: true }).in("id", toResolve);
    }

    const fresh = low.filter((i) => !openByItem.has(i.id));
    // Миқдори нави ҳамон мавод — навсозӣ мешавад
    for (const i of low) {
      const a = openByItem.get(i.id);
      if (a && Number(a.quantity) !== i.quantity) {
        await admin.from("supply_alerts").update({ quantity: i.quantity }).eq("id", a.id);
      }
    }

    let smsSent = 0;
    let smsError: string | null = null;

    if (fresh.length) {
      await admin.from("supply_alerts").insert(
        fresh.map((i) => ({
          company_id: companyId,
          item_id: i.id,
          item_name: i.name,
          quantity: i.quantity,
          threshold: i.min_quantity,
          unit: i.unit,
          sms_status: null,
        })),
      );

      // Гирандагон: корманде, ки ба саҳифаи /supply дастрасӣ дорад
      // (ҳам аз рӯи шӯъба, ҳам аз рӯи дастрасии иловагӣ)
      const { computeAllowedPages } = await import("@/lib/app-pages");
      const { data: staff } = await admin
        .from("profiles")
        .select("id, fullname, phone, department, extra_pages, denied_pages")
        .eq("company_id", companyId);
      const recipients = ((staff ?? []) as any[])
        .filter(
          (p) =>
            p.phone &&
            computeAllowedPages(p.department ?? null, p.extra_pages ?? [], p.denied_pages ?? []).has("/supply"),
        )
        .map((p) => p.phone as string);


      if (recipients.length) {
        const { resolveSmsCfg, osonSend, normalizePhone } = await import("@/lib/sms-core.server");
        const cfg = await resolveSmsCfg(admin, companyId, null);
        if (!cfg) {
          smsError = "СМС фаъол нест (OSON SMS)";
        } else {
          const body =
            "Склад: захира кам шуд — " +
            fresh
              .slice(0, 5)
              .map((i) => `${i.name}: ${i.quantity}`)
              .join(", ") +
            (fresh.length > 5 ? ` ва ${fresh.length - 5} мавод` : "");
          for (const raw of recipients) {
            const phone = normalizePhone(raw);
            if (!phone) continue;
            const res = await osonSend(cfg, phone, body.slice(0, 300));
            if (res.ok) smsSent += 1;
            else smsError = res.error;
          }
        }
      }

      await admin
        .from("supply_alerts")
        .update({ sms_status: smsSent > 0 ? "sent" : (smsError ?? "no-recipients") })
        .eq("company_id", companyId)
        .eq("resolved", false)
        .is("sms_status", null);
    }

    return { low, created: fresh.length, resolved: toResolve.length, smsSent, smsError };
  });
