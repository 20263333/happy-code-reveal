import { createHmac } from "crypto";

export type ApartmentEvent =
  | "apartment.created"
  | "apartment.updated"
  | "apartment.snapshot";

export type ApartmentDTO = {
  id: string;
  project_id: string;
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

/**
 * Push-webhook ба барномаи sharora.tj — ҳолати хонаҳо (холӣ/фурӯхта).
 * URL: SHARORA_WEBHOOK_URL, имзо: HMAC-SHA256 бо SHARORA_WEBHOOK_SECRET.
 */
export async function pushApartmentEvent(
  event: ApartmentEvent,
  data: unknown,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const url = process.env["SHARORA_WEBHOOK_URL"];
  const secret = process.env["SHARORA_WEBHOOK_SECRET"];
  if (!url || !secret) return { ok: false, error: "webhook_not_configured" };

  const body = JSON.stringify({
    source: "platform.tj",
    event,
    sent_at: new Date().toISOString(),
    data,
  });
  const signature = createHmac("sha256", secret).update(body).digest("hex");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-platform-signature": signature,
        "x-platform-event": event,
      },
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[sharora-webhook] failed", res.status, text.slice(0, 300));
      return { ok: false, status: res.status, error: text.slice(0, 300) };
    }
    return { ok: true, status: res.status };
  } catch (e: any) {
    console.error("[sharora-webhook] error", e?.message);
    return { ok: false, error: e?.message ?? "network error" };
  }
}

const AVAILABLE = new Set(["empty"]);

export function toApartmentDTO(row: any): ApartmentDTO {
  const project = row.projects ?? null;
  const parent = project?.parent ?? null;
  return {
    id: row.id,
    project_id: row.project_id,
    project_name: parent?.name ?? project?.name ?? null,
    block_name: parent ? (project?.name ?? null) : null,
    floor_number: row.floors?.floor_number ?? null,
    apartment_number: row.apartment_number ?? null,
    rooms: row.rooms ?? null,
    area: row.area != null ? Number(row.area) : null,
    price: row.price != null ? Number(row.price) : null,
    price_per_sqm: row.price_per_sqm != null ? Number(row.price_per_sqm) : null,
    status: row.status,
    is_available: AVAILABLE.has(row.status) && !row.is_historical,
    is_historical: !!row.is_historical,
    updated_at: row.updated_at ?? null,
  };
}

export const APARTMENT_SELECT =
  "id, project_id, apartment_number, rooms, area, price, price_per_sqm, status, is_historical, updated_at, floors(floor_number), projects!apartments_project_id_fkey(name, parent_id, parent:projects!projects_parent_id_fkey(name))";
