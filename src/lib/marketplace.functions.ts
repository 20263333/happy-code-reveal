import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MARKETPLACE_URL = "https://binosoz-casa.lovable.app";

const Input = z.object({ block_id: z.string().uuid() });

export const publishBlockToMarket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v) => Input.parse(v))
  .handler(async ({ data, context }) => {
    const secret = process.env.MARKETPLACE_SYNC_SECRET;
    if (!secret) throw new Error("MARKETPLACE_SYNC_SECRET нест");

    const { supabase, userId } = context;

    // Санҷиш: коргар соҳиби ширкат аст ва блок ба худаш тааллуқ дорад.
    const { data: block, error: bErr } = await supabase
      .from("projects")
      .select("id, name, parent_id, company_id, location, description")
      .eq("id", data.block_id)
      .maybeSingle();
    if (bErr || !block) throw new Error("Блок ёфт нашуд");

    if (!block.company_id) throw new Error("Ширкат ёфт нашуд");
    const { data: company } = await supabase
      .from("companies")
      .select("id, name, owner_user_id, phone")
      .eq("id", block.company_id)
      .maybeSingle();
    if (!company || company.owner_user_id !== userId) {
      throw new Error("Танҳо соҳиби ширкат ин корро карда метавонад");
    }

    // ЖК-и волидайн (агар блок бошад)
    let parent: any = null;
    if (block.parent_id) {
      const { data: p } = await supabase
        .from("projects")
        .select("id, name, location")
        .eq("id", block.parent_id)
        .maybeSingle();
      parent = p;
    }

    // Квартираҳои холӣ бо тарҳ
    const { data: apts, error: aErr } = await supabase
      .from("apartments")
      .select("id, apartment_number, rooms, area, price, status, plan_image_path, floor_id, floors(floor_number)")
      .eq("project_id", data.block_id)
      .in("status", ["empty", "reserved"]);
    if (aErr) throw new Error(aErr.message);
    if (!apts || apts.length === 0) throw new Error("Квартираҳои холӣ нест");

    // Барои ҳар як плани хона signed URL созем (bucket хусусӣ)
    const planUrls = new Map<string, string>();
    await Promise.all(
      (apts ?? [])
        .filter((a: any) => a.plan_image_path)
        .map(async (a: any) => {
          const { data: signed } = await supabase.storage
            .from("apartment-plans")
            .createSignedUrl(a.plan_image_path, 60 * 60 * 24 * 30);
          if (signed?.signedUrl) planUrls.set(a.id, signed.signedUrl);
        }),
    );
    if (!apts || apts.length === 0) throw new Error("Квартираҳои холӣ нест");

    const listings = apts.map((a: any) => ({
      external_ref: `binosoz_tj:${a.id}`,
      title: `${parent?.name ?? ""} ${block.name} — Кв. ${a.apartment_number}${a.rooms ? `, ${a.rooms}-хона` : ""}`.trim(),
      description: [
        parent?.name && `ЖК: ${parent.name}`,
        `Блок: ${block.name}`,
        a.floors?.floor_number && `Этаж: ${a.floors.floor_number}`,
        a.rooms && `Хонаҳо: ${a.rooms}`,
        a.area && `Масоҳат: ${a.area} м²`,
      ].filter(Boolean).join("\n"),
      price: a.price ?? null,
      currency: "TJS",
      location: parent?.location ?? block.location ?? null,
      images: planUrls.get(a.id) ? [planUrls.get(a.id)!] : [],
      rooms: a.rooms ?? null,
      area: a.area ?? null,
      floor: a.floors?.floor_number ?? null,
      apartment_number: a.apartment_number,
    }));

    const payload = {
      source: "binosoz_tj",
      company: {
        id: company.id,
        name: company.name,
        phone: company.phone ?? null,
        
      },
      project: parent ? { id: parent.id, name: parent.name, location: parent.location } : null,
      block: { id: block.id, name: block.name },
      listings,
    };

    const res = await fetch(`${MARKETPLACE_URL}/api/public/import-listings`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-sync-secret": secret,
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Marketplace: ${res.status} ${text.slice(0, 200)}`);
    }

    let result: any = {};
    try { result = JSON.parse(text); } catch { /* ignore */ }

    // Захира: quotron ба apartments мегузорем то дубора нафиристем
    const now = new Date().toISOString();
    const idMap: Record<string, string> = result?.listing_ids ?? {};
    await Promise.all(
      apts.map(async (a: any) => {
        const ref = `binosoz_tj:${a.id}`;
        await supabase
          .from("apartments")
          .update({
            marketplace_listing_id: idMap[ref] ?? ref,
            marketplace_synced_at: now,
          })
          .eq("id", a.id);
      }),
    );

    return { ok: true, count: listings.length, imported: result?.imported ?? listings.length };
  });

// ── SSO: соҳиби ширкатро автоматӣ ба кабинети Binosoz Market медарорад ─────
export const getMarketplaceSsoUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const secret = process.env.MARKETPLACE_SYNC_SECRET;
    if (!secret) throw new Error("MARKETPLACE_SYNC_SECRET нест");

    const { supabase, userId } = context;

    const { data: company } = await supabase
      .from("companies")
      .select("id, name, phone, owner_user_id")
      .eq("owner_user_id", userId)
      .maybeSingle();
    if (!company) throw new Error("Танҳо соҳиби ширкат вориди Market шуда метавонад");
    if (!company.phone) throw new Error("Дар ширкат рақами телефон нест — онро дар танзимот илова кунед");

    const { data: prof } = await supabase
      .from("profiles").select("fullname").eq("id", userId).maybeSingle();

    const payload = {
      source: "binosoz_tj",
      external_user_id: userId,
      phone: company.phone,
      fullname: prof?.fullname ?? company.name,
      company: { id: company.id, name: company.name, phone: company.phone },
    };

    const res = await fetch(`${MARKETPLACE_URL}/api/public/sso-login`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-sync-secret": secret },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Marketplace SSO: ${res.status} ${text.slice(0, 200)}`);
    const result = JSON.parse(text) as { url: string };
    if (!result?.url) throw new Error("Marketplace URL барнагашт");
    return { url: result.url };
  });

