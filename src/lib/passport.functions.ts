import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { extractPassportFromImages, type PassportOcrResult } from "./passport-ocr.server";

const InputSchema = z.object({
  front: z.string().min(10), // data:image/...;base64,... OR raw base64
  back: z.string().min(10).optional().nullable(),
});

export type PassportExtractResult = PassportOcrResult;

export const extractPassport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data, context }): Promise<PassportExtractResult> => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    const { data: owned } = await supabase
      .from("companies")
      .select("id")
      .eq("owner_user_id", userId)
      .maybeSingle();
    const companyId = (prof as any)?.company_id ?? (owned as any)?.id;
    if (!companyId) throw new Error("Ширкат ёфт нашуд");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).rpc("consume_scan_credit", {
      _company_id: companyId,
    });
    if (error) {
      if (error.message?.includes("no_scan_credits")) throw new Error("no_scan_credits");
      throw new Error(error.message);
    }

    return extractPassportFromImages(data);
  });

export const getPassportScanCredits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    const { data: owned } = await supabase
      .from("companies")
      .select("id")
      .eq("owner_user_id", userId)
      .maybeSingle();
    const companyId = (prof as any)?.company_id ?? (owned as any)?.id;
    if (!companyId) return { scan_free_limit: 50, scan_free_used: 0, paid_balance: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await (supabaseAdmin as any)
      .from("ai_credits")
      .select("scan_free_limit, scan_free_used, scan_paid_balance")
      .eq("company_id", companyId)
      .maybeSingle();
    return {
      scan_free_limit: row?.scan_free_limit ?? 50,
      scan_free_used: row?.scan_free_used ?? 0,
      paid_balance: row?.scan_paid_balance ?? 0,
    };
  });
