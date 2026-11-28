import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { providerFailure } from "./ai-service-errors.server";
import { ownerRoleMatchesCompany } from "./company-template-access";

const InputSchema = z.object({
  pages: z.array(z.string().min(10)).min(1).max(8),
});

export type ContractExtractResult = {
  contract_title: string | null;
  number_prefix: string | null;
  director_name: string | null;
  director_position: string | null;
  inn: string | null;
  legal_address: string | null;
  bank_details: string | null;
  phone: string | null;
  intro_text: string | null;
  body_text: string | null;
  footer_text: string | null;
};

function asDataUrl(s: string): string {
  return s.startsWith("data:") ? s : `data:image/jpeg;base64,${s}`;
}

export const extractContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }): Promise<ContractExtractResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const userParts: any[] = [
      {
        type: "text",
        text:
          "Это фотографии бумажного шаблона договора купли-продажи квартиры (строительная компания). " +
          "Извлеки реквизиты и текст договора строго в JSON по схеме. " +
          "intro_text — вступительная часть (преамбула, кто/с кем). " +
          "body_text — основные условия (пункты, права, оплата). " +
          "footer_text — заключение и место для подписей. " +
          "В тексте сохрани плейсхолдеры в фигурных скобках если они есть: " +
          "{client} {passport} {phone} {address} {project} {floor} {apartment} {area} {rooms} {price} {date}. " +
          "Если в тексте упомянуты ФИО клиента, № квартиры, цена и т.п. — замени их на соответствующий плейсхолдер. " +
          "Если поле не видно — поставь null.",
      },
      ...data.pages.map((p) => ({ type: "image_url", image_url: { url: asDataUrl(p) } })),
    ];

    const body = {
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: "Ты — OCR-ассистент. Возвращай ТОЛЬКО валидный JSON-объект без пояснений и markdown.",
        },
        { role: "user", content: userParts },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "contract_extract",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              contract_title: { type: ["string", "null"] },
              number_prefix: { type: ["string", "null"] },
              director_name: { type: ["string", "null"] },
              director_position: { type: ["string", "null"] },
              inn: { type: ["string", "null"] },
              legal_address: { type: ["string", "null"] },
              bank_details: { type: ["string", "null"] },
              phone: { type: ["string", "null"] },
              intro_text: { type: ["string", "null"] },
              body_text: { type: ["string", "null"] },
              footer_text: { type: ["string", "null"] },
            },
            required: [
              "contract_title",
              "number_prefix",
              "director_name",
              "director_position",
              "inn",
              "legal_address",
              "bank_details",
              "phone",
              "intro_text",
              "body_text",
              "footer_text",
            ],
          },
        },
      },
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw await providerFailure(res);
    const json: any = await res.json();
    const text: string = json?.choices?.[0]?.message?.content ?? "{}";

    let parsed: any = {};
    try { parsed = JSON.parse(text); } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch { parsed = {}; } }
    }

    return {
      contract_title: parsed.contract_title ?? null,
      number_prefix: parsed.number_prefix ?? null,
      director_name: parsed.director_name ?? null,
      director_position: parsed.director_position ?? null,
      inn: parsed.inn ?? null,
      legal_address: parsed.legal_address ?? null,
      bank_details: parsed.bank_details ?? null,
      phone: parsed.phone ?? null,
      intro_text: parsed.intro_text ?? null,
      body_text: parsed.body_text ?? null,
      footer_text: parsed.footer_text ?? null,
    };
  });


async function verifyCompanyOwnerOrAdmin(supabase: any, userId: string, companyId: string) {
  const { data: pa } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (pa) return true;

  const { data: company } = await supabase
    .from("companies")
    .select("owner_user_id")
    .eq("id", companyId)
    .maybeSingle();
  if (company && company.owner_user_id === userId) return true;

  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "owner")
    .maybeSingle();
  if (role) {
    const { data: ownCompany } = await supabase.rpc("user_company_id", { _user_id: userId });
    if (ownerRoleMatchesCompany(role.role, ownCompany, companyId)) return true;
  }

  throw new Error("Танҳо соҳиби ширкат метавонад шаблонро танзим кунад");
}

export const saveContractTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      company_id: z.string().uuid(),
      contract_title: z.string().nullable().optional(),
      number_prefix: z.string().nullable().optional(),
      director_name: z.string().nullable().optional(),
      director_position: z.string().nullable().optional(),
      inn: z.string().nullable().optional(),
      legal_address: z.string().nullable().optional(),
      bank_details: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      intro_text: z.string().nullable().optional(),
      body_text: z.string().nullable().optional(),
      footer_text: z.string().nullable().optional(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await verifyCompanyOwnerOrAdmin(supabase, userId, data.company_id);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: existing } = await admin
      .from("contract_templates")
      .select("id")
      .eq("company_id", data.company_id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await admin
        .from("contract_templates")
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await admin
        .from("contract_templates")
        .insert({
          ...data,
          updated_at: new Date().toISOString(),
        });
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });

export const uploadContractTemplateDocx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      company_id: z.string().uuid(),
      kind: z.enum(["full", "installment", "shop_full", "shop_installment", "schedule", "receipt"]),
      file_base64: z.string().min(1).max(28_000_000),
      file_name: z.string().min(1).max(255).regex(/\.docx$/i),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await verifyCompanyOwnerOrAdmin(supabase, userId, data.company_id);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const columnMap: Record<string, string> = {
      full: "docx_full_path",
      installment: "docx_installment_path",
      shop_full: "docx_shop_full_path",
      shop_installment: "docx_shop_installment_path",
      schedule: "docx_schedule_path",
      receipt: "docx_receipt_path",
    };
    const column = columnMap[data.kind];
    if (!column) throw new Error("Шаблон муайян нашуд");

    const { data: current } = await admin
      .from("contract_templates")
      .select(`id, ${column}`)
      .eq("company_id", data.company_id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const oldPath = current?.[column];
    const buffer = Buffer.from(data.file_base64, "base64");
    if (buffer.length > 20 * 1024 * 1024 || buffer[0] !== 80 || buffer[1] !== 75) throw new Error("Файли DOCX нодуруст ё аз 20 MB зиёд аст");
    const objPath = `${data.company_id}/${data.kind}-${Date.now()}.docx`;

    const { error: upErr } = await admin.storage
      .from("contract-templates")
      .upload(objPath, buffer, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });
    if (upErr) throw new Error(upErr.message);

    if (current?.id) {
      const { error: dbErr } = await admin
        .from("contract_templates")
        .update({ [column]: objPath, updated_at: new Date().toISOString() })
        .eq("id", current.id);
      if (dbErr) throw new Error(dbErr.message);
    } else {
      const { error: dbErr } = await admin
        .from("contract_templates")
        .insert({
          company_id: data.company_id,
          [column]: objPath,
          updated_at: new Date().toISOString(),
        });
      if (dbErr) throw new Error(dbErr.message);
    }

    if (oldPath && oldPath !== objPath) await admin.storage.from("contract-templates").remove([oldPath]);
    return { ok: true, path: objPath };
  });

export const deleteContractTemplateDocx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      company_id: z.string().uuid(),
      kind: z.enum(["full", "installment", "shop_full", "shop_installment", "schedule", "receipt"]),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await verifyCompanyOwnerOrAdmin(supabase, userId, data.company_id);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const columnMap: Record<string, string> = {
      full: "docx_full_path",
      installment: "docx_installment_path",
      shop_full: "docx_shop_full_path",
      shop_installment: "docx_shop_installment_path",
      schedule: "docx_schedule_path",
      receipt: "docx_receipt_path",
    };
    const column = columnMap[data.kind];
    if (!column) throw new Error("Шаблон муайян нашуд");

    const { data: current } = await admin
      .from("contract_templates")
      .select(`id, ${column}`)
      .eq("company_id", data.company_id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const oldPath = current?.[column];
    if (oldPath) {
      await admin.storage.from("contract-templates").remove([oldPath]);
    }

    if (current?.id) {
      const { error } = await admin
        .from("contract_templates")
        .update({ [column]: null, updated_at: new Date().toISOString() })
        .eq("id", current.id);
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });
