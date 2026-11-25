import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { CompanyTools, allRows, getModule, requireAssistantOwner, summarizeIncome, validateChanges } from "./ai-company-tools.server";

const company = "00000000-0000-4000-8000-000000000001";
const user = "00000000-0000-4000-8000-000000000002";
const project = "00000000-0000-4000-8000-000000000003";
const sale = "00000000-0000-4000-8000-000000000004";
const apartment = "00000000-0000-4000-8000-000000000005";
function fixture(owner = true) {
  const calls: URL[] = [];
  const client = createClient("https://ai-tests.invalid", "fictional-test-publishable-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async input => {
      const url = new URL(String(input)); calls.push(url);
      const table = url.pathname.split("/").pop();
      if (table === "has_role") return Response.json(owner);
      if (table === "profiles") return Response.json(url.searchParams.get("select") === "company_id" ? [{ company_id: company }] : [{ id: user }]);
      if (table === "companies") return Response.json([]);
      if (table === "projects") return Response.json([{ id: project }]);
      if (table === "sales") return Response.json([{ id: sale }]);
      if (table === "apartments") return Response.json([{ id: apartment, apartment_number: "1", area: 50, price: 500000, rooms: 2, price_per_sqm: 10000 }]);
      if (table === "payments") return Response.json([{ status: "confirmed", currency: "TJS", amount: 1200 }]);
      if (table === "expenses") return Response.json([{ currency: "TJS", amount: 200 }]);
      return Response.json([]);
    } },
  });
  return { calls, client, tools: new CompanyTools(client, company, user) };
}

test("assistant access requires the authenticated company's owner", async () => {
  const { client } = fixture(false);
  await assert.rejects(() => requireAssistantOwner(client, user), /соҳиби ширкат/);
});
test("company module queries cannot search another tenant", async () => {
  const { tools, calls } = fixture();
  await tools.list({ table: "customers" });
  assert.equal(calls[0]?.searchParams.get("company_id"), `eq.${company}`);
  await assert.rejects(() => tools.list({ table: "customers", filters: [{ field: "company_id", value: "other" }] }));
});
test("apartment reads are restricted to the authenticated company's projects", async () => {
  const { tools, calls } = fixture(); await tools.list({ table: "apartments" });
  assert.equal(calls.find(url => url.pathname.endsWith("/projects"))?.searchParams.get("company_id"), `eq.${company}`);
  assert.equal(calls.find(url => url.pathname.endsWith("/apartments"))?.searchParams.get("project_id"), `in.(${project})`);
});
test("monthly income includes both first and last calendar day and only confirmed payments", async () => {
  const { tools, calls } = fixture();
  const report = await tools.income({ from_date: "2026-11-01", to_date: "2026-11-30" });
  assert.deepEqual(report.currencies["TJS"], { received: 1200, expenses: 200, balance: 1000 });
  const request = calls.find(url => url.pathname.endsWith("/payments"));
  assert.deepEqual(request?.searchParams.getAll("payment_date"), ["gte.2026-11-01", "lte.2026-11-30"]);
  assert.equal(request?.searchParams.get("status"), "eq.confirmed");
  assert.equal(request?.searchParams.get("sale_id"), `in.(${sale})`);
});
test("financial reports never mix TJS and USD or include unconfirmed payments", () => {
  const report = summarizeIncome([{ status: "confirmed", currency: "TJS", amount: 1200 }, { status: "confirmed", currency: "USD", amount: 100 }, { status: "pending", currency: "TJS", amount: 9999 }], [{ currency: "USD", amount: 20 }]);
  assert.equal(report.currencies["TJS"]?.received, 1200);
  assert.equal(report.currencies["USD"]?.balance, 80);
  assert.equal(report.payment_count, 2);
});
test("reports read every page instead of silently truncating large companies", async () => {
  const pages: number[] = [];
  const data = await allRows(async from => { pages.push(from); return { data: Array.from({ length: from === 0 ? 500 : 2 }, (_, n) => ({ id: from + n })), error: null }; });
  assert.equal(data.length, 502); assert.deepEqual(pages, [0, 500]);
});
test("API keys, passwords, membership and tariffs are not writable assistant fields", () => {
  for (const table of ["platform_settings", "user_roles", "company_sms_settings", "company_kiosk_secrets"]) assert.throws(() => getModule(table));
  for (const field of ["owner_user_id", "company_id", "subscription_tariff_id"]) assert.throws(() => validateChanges("companies", { [field]: user }));
});
test("apartment numbering is proposed without writing to the database", async () => {
  const { tools, calls } = fixture();
  const proposal = await tools.prepareApartments({ updates: [{ id: apartment, apartment_number: "М-1" }] });
  assert.equal(proposal.args.updates[0]?.apartment_number, "М-1");
  assert.equal(proposal.args.updates[0]?.before["apartment_number"], "1");
  assert.equal(calls.every(url => url.searchParams.has("select")), true);
});
test("changing apartment area keeps the existing total price in the confirmation preview", async () => {
  const { tools } = fixture(); const proposal = await tools.prepareApartments({ updates: [{ id: apartment, area: 60 }] });
  assert.equal(proposal.args.updates[0]?.area, 60);
  assert.equal(proposal.args.updates[0]?.before["price"], 500000);
  assert.equal(Object.hasOwn(proposal.args.updates[0] ?? {}, "price"), false);
});
test("invalid area and duplicate selections cannot produce a proposal", async () => {
  const { tools } = fixture();
  await assert.rejects(() => tools.prepareApartments({ updates: [{ id: apartment, area: 0 }] }));
  await assert.rejects(() => tools.prepareApartments({ updates: [{ id: apartment, area: 60 }, { id: apartment, area: 70 }] }));
});
test("impossible and reversed report dates are rejected", async () => {
  const { tools } = fixture();
  await assert.rejects(() => tools.income({ from_date: "2026-02-30", to_date: "2026-03-01" }));
  await assert.rejects(() => tools.income({ from_date: "2026-11-30", to_date: "2026-11-01" }));
});