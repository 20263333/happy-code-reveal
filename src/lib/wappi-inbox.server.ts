import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { parseWappiEvents } from "./wappi-events";

type Client = SupabaseClient<any, any, any>;
const outcomeSchema = z.object({ ok: z.boolean(), result: z.string(), code: z.string().optional() });

export async function receiveWappiDelivery(admin: Client, payload: unknown) {
  const events = parseWappiEvents(payload);
  const results = [];
  const raw = JSON.stringify(payload);
  for (const [index, event] of events.entries()) {
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${raw}:${index}`));
    const deliveryId = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
    const { data, error } = await admin.rpc("receive_wappi_event", { _delivery_id: deliveryId, _payload: payload, _event: event });
    if (error) throw new Error("Қабули WhatsApp сабт нашуд; навсозии база ва журнали серверро санҷед.");
    results.push(outcomeSchema.parse(data));
  }
  const { error: recoveryError } = await admin.rpc("recover_wappi_events", { _limit: 10 });
  if (recoveryError) throw new Error("Барқароркунии паёмҳои WhatsApp иҷро нашуд.");
  return { ok: results.every(result => result.ok), result: results.find(result => !result.ok)?.result ?? "delivery_saved", results };
}