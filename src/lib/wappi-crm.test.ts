import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { createClient } from "@supabase/supabase-js";
import { parseWappiEvents, wappiWebhookUrl } from "./wappi-events";
import { loadCrmCustomers } from "./crm-data";
import type { Database } from "@/integrations/supabase/types";

const tenant = "00000000-0000-0000-0000-000000000001";
const other = "00000000-0000-0000-0000-000000000002";
test("every message in a Wappi batch is parsed, including a nested profile and string false direction", () => {
  const events = parseWappiEvents({ data: { profile_id: "profile-a", messages: [
    { id: "a", from: "992900000001@c.us", body: "Салом", is_me: "false" },
    { id: "b", to: "992900000002@c.us", body: "Ҷавоб", is_me: "true" },
  ] } });
  assert.equal(events.length, 2); assert.equal(events[0]?.kind, "incoming"); assert.equal(events[1]?.kind, "outgoing");
  assert.equal(events[0]?.profileId, "profile-a"); assert.equal(events[1]?.phone, "992900000002");
});
test("group chats cannot become personal customer phone numbers", () => {
  assert.equal(parseWappiEvents({ profile_id: "a", messages: [{ id: "a", from: "992900000001@g.us", body: "test" }] })[0]?.phone, null);
});
test("VPS webhook uses binosoz.tj instead of the remixed project's old host", () => {
  assert.equal(wappiWebhookUrl("https://binosoz.tj"), "https://binosoz.tj/api/public/hooks/whatsapp-leads");
});
test("CRM reads work without foreign-key embedding and remain tenant scoped", async () => {
  const calls: URL[] = [];
  const client = createClient<Database>("https://crm.invalid", "fixture", { auth: { persistSession: false }, global: { fetch: async input => {
    const url = new URL(String(input)); calls.push(url);
    const table = url.pathname.split("/").pop();
    if (table === "customers") return Response.json([{ id: "a", company_id: tenant, assigned_manager_id: "m" }, { id: "b", company_id: other }]);
    if (table === "sales_team_members") return Response.json([{ id: "m", company_id: tenant, fullname: "Manager" }]);
    return Response.json([{ id: "s", company_id: tenant, customer_id: "a" }]);
  } } });
  const rows = await loadCrmCustomers(client, tenant);
  assert.equal(rows.length, 1); assert.equal(rows[0]?.sales[0]?.id, "s"); assert.equal(rows[0]?.manager?.id, "m");
  for (const url of calls) { assert.equal(url.searchParams.get("company_id"), `eq.${tenant}`); assert.equal(url.searchParams.get("select")?.includes("("), false); }
});
test("verified Wappi receipts atomically create a lead/chat/message, deduplicate, recover and never misroute an explicit profile", async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE whatsapp_accounts(id uuid default gen_random_uuid(),company_id uuid,profile_id text,enabled boolean default true);
      CREATE TABLE customers(id uuid default gen_random_uuid(),company_id uuid,fullname text,phone text,status text,funnel_stage text,source text,created_at timestamptz default now());
      CREATE TABLE whatsapp_chats(id uuid default gen_random_uuid(),company_id uuid,profile_id text,chat_id text,phone text,display_name text,customer_id uuid,avatar_url text,last_message_text text,last_direction text,last_message_at timestamptz,unread_count int default 0,created_at timestamptz default now());
      CREATE TABLE whatsapp_messages(id uuid default gen_random_uuid(),company_id uuid,chat_id uuid,customer_id uuid,direction text,body text,message_type text,media_url text,media_meta jsonb,wappi_message_id text,status text,sent_at timestamptz,raw jsonb,created_at timestamptz default now());
      CREATE TABLE whatsapp_webhook_logs(company_id uuid,event text,level text,message text);
      INSERT INTO whatsapp_accounts(company_id,profile_id) VALUES('${tenant}','profile-a'),('${other}','profile-b');`);
    await db.exec(await readFile(new URL("../../scripts/vps-wappi-crm-sync.sql", import.meta.url), "utf8"));
    const event = parseWappiEvents({ profile_id: "profile-a", messages: [{ id: "a", from: "992900000001@c.us", body: "Салом", time: 1795860000 }] })[0];
    assert.ok(event);
    const receive = (id: string, ev = event) => db.query<{ outcome: { ok: boolean; result: string } }>("select receive_wappi_event($1,$2::jsonb,$3::jsonb) as outcome", [id.repeat(64), JSON.stringify({ fixture: true }), JSON.stringify(ev)]);
    assert.equal((await receive("a")).rows[0]?.outcome.result, "message_saved");
    assert.equal((await receive("a")).rows[0]?.outcome.result, "duplicate_skipped");
    assert.equal((await db.query<{ count: number }>("select count(*)::int as count from customers where company_id=$1 and funnel_stage='lead'", [tenant])).rows[0]?.count, 1);
    assert.equal((await db.query<{ count: number }>("select count(*)::int as count from whatsapp_messages")).rows[0]?.count, 1);
    assert.equal((await receive("b", { ...event, profileId: "missing", messageId: "missing" })).rows[0]?.outcome.result, "unmapped_profile");
    assert.equal((await db.query<{ count: number }>("select count(*)::int as count from whatsapp_messages where company_id=$1", [other])).rows[0]?.count, 0);
    await db.exec("UPDATE whatsapp_accounts SET profile_id='missing' WHERE profile_id='profile-b'; UPDATE wappi_webhook_events SET retry_at=now() WHERE processing_error='unmapped_profile';");
    await db.query("select recover_wappi_events(10)");
    assert.equal((await db.query<{ count: number }>("select count(*)::int as count from whatsapp_messages where company_id=$1", [other])).rows[0]?.count, 1);
    await db.exec("ALTER TABLE whatsapp_messages ADD CONSTRAINT reject_fixture CHECK (body<>'reject');");
    assert.equal((await receive("c", { ...event, messageId: "c", phone: "992900000003", chatId: "992900000003@c.us", text: "reject" })).rows[0]?.outcome.ok, false);
    assert.equal((await db.query<{ count: number }>("select count(*)::int as count from customers where phone='+992900000003'")).rows[0]?.count, 0);
    assert.equal((await db.query<{ count: number }>("select count(*)::int as count from wappi_webhook_events where delivery_id=$1 and processed_at is null", ["c".repeat(64)])).rows[0]?.count, 1);
  } finally { await db.close(); }
});