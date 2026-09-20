import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SitePlanRequestSchema = z.object({
  plan_code: z.enum(["construction", "construction_sales", "premium_unlimited"]),
  business_type: z.enum(["developer", "management", "other"]),
  full_name: z.string().trim().min(2).max(120),
  company_name: z.string().trim().min(2).max(160),
  job_title: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(7).max(40),
  locale: z.enum(["tg", "ru", "en"]),
});

export const submitSitePlanRequest = createServerFn({ method: "POST" })
  .inputValidator((data) => SitePlanRequestSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("site_plan_requests").insert(data);
    if (error) throw new Error("Не удалось отправить заявку");
    return { ok: true };
  });