import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Рақами телефонро ба формати байналмилалии Тоҷикистон (992XXXXXXXXX) табдил медиҳад
function normalizePhone(phone: string): string | null {
  let d = (phone || "").replace(/\D/g, "");
  if (!d) return null;
  if (d.length === 9) d = "992" + d;
  else if (d.length === 10 && d.startsWith("0")) d = "992" + d.slice(1);
  else if (d.startsWith("8") && d.length === 11) d = "992" + d.slice(1);
  return d.length >= 11 ? d : null;
}

type OsonCfg = {
  login: string;
  token: string;
  sender: string;
  hashSecret?: string | null;
};

type SmsResult =
  | { ok: true; msgId: string | null; txnId: string; raw: string }
  | { ok: false; error: string };

async function osonSend(cfg: OsonCfg, phone: string, msg: string): Promise<SmsResult> {
  const txnId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const params = new URLSearchParams({
    from: cfg.sender,
    phone_number: phone,
    msg,
    txn_id: txnId,
    login: cfg.login,
  });
  if (cfg.hashSecret) {
    const str = `${txnId};${cfg.login};${cfg.sender};${phone};${cfg.hashSecret}`;
    params.set("str_hash", createHash("sha256").update(str).digest("hex"));
  }
  const url = `https://api.osonsms.com/sendsms_v1.php?${params.toString()}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {},
    });
  } catch (e: any) {
    return { ok: false, error: "Пайвастшавӣ ба OSON SMS ноком шуд: " + (e?.message ?? "") };
  }
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  if (json?.error) {
    return {
      ok: false,
      error:
        json.error.msg || json.error.error_type || `Хатои OSON SMS (код ${json.error.code ?? "?"})`,
    };
  }
  if (!res.ok) {
    return { ok: false, error: `OSON SMS HTTP ${res.status}: ${text.slice(0, 200)}` };
  }
  return { ok: true, msgId: json?.msg_id ?? null, txnId, raw: text.slice(0, 300) };
}

// Як СМС ба рақами додашуда мефиристад. Аз танзимоти OSON SMS-и ширкати корбар истифода мебарад.
export const sendSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        phone: z.string().min(3).max(40),
        message: z.string().min(1).max(900),
        project_id: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<SmsResult> => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: prof } = await admin
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();
    const companyId = prof?.company_id;
    if (!companyId) return { ok: false, error: "Ширкат ёфт нашуд" };

    // Аввал танзимоти лоиҳа, агар набошад — танзимоти умумии ширкат
    const { data: rows } = await admin
      .from("company_sms_settings")
      .select("*")
      .eq("company_id", companyId);
    const list = (rows as any[]) ?? [];
    // Агар лоиҳа блок (подпроект) бошад, танзимоти лоиҳаи асосӣ (parent) гирифта мешавад
    let pid = data.project_id ?? null;
    if (pid && !list.some((r) => r.project_id === pid)) {
      const { data: proj } = await admin
        .from("projects")
        .select("parent_id")
        .eq("id", pid)
        .maybeSingle();
      if (proj?.parent_id) pid = proj.parent_id;
    }
    const cfg =
      (pid ? list.find((r) => r.project_id === pid) : null) ??
      list.find((r) => !r.project_id) ??
      null;


    if (!cfg || !cfg.enabled)
      return { ok: false, error: "СМС фаъол нест. Танзимоти OSON SMS-ро пур кунед." };
    if (!cfg.login || !cfg.token || !cfg.sender)
      return { ok: false, error: "Маълумоти OSON SMS пурра нест (login / token / sender)." };

    const phone = normalizePhone(data.phone);
    if (!phone) return { ok: false, error: "Рақами телефон нодуруст аст" };

    return osonSend(
      { login: cfg.login, token: cfg.token, sender: cfg.sender, hashSecret: cfg.hash_secret },
      phone,
      data.message,
    );
  });

// Тасдиқи пардохт: барои графикҳои `paid` СМС мефиристад (агар қаблан фиристода нашуда бошад).
export const sendPaidConfirmation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sale_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // Verify the caller belongs to the same company as the sale — otherwise
    // any authenticated user could burn another company's SMS credits.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: sale } = await admin
      .from("sales")
      .select("customer_id")
      .eq("id", data.sale_id)
      .maybeSingle();
    if (!sale?.customer_id) throw new Error("Фурӯш ёфт нашуд");
    const { data: cust } = await admin
      .from("customers")
      .select("company_id")
      .eq("id", sale.customer_id)
      .maybeSingle();
    const saleCompanyId: string | null = cust?.company_id ?? null;
    if (!saleCompanyId) throw new Error("Ширкати фурӯш номаълум");

    const { data: pa } = await admin
      .from("platform_admins").select("user_id").eq("user_id", context.userId).maybeSingle();
    const isPlatformAdmin = !!pa;
    if (!isPlatformAdmin) {
      const { data: prof } = await admin
        .from("profiles").select("company_id").eq("id", context.userId).maybeSingle();
      const { data: owned } = await admin
        .from("companies").select("id").eq("owner_user_id", context.userId).maybeSingle();
      const callerCompanyId: string | null = prof?.company_id ?? owned?.id ?? null;
      if (callerCompanyId !== saleCompanyId) throw new Error("Дастрасӣ нест");
    }

    const { sendPaidConfirmationForSale } = await import("@/lib/sms-core.server");
    return sendPaidConfirmationForSale(data.sale_id);
  });
