import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const owner = "00000000-0000-4000-8000-000000000001";
const company = "00000000-0000-4000-8000-000000000002";
const otherCompany = "00000000-0000-4000-8000-000000000003";
const project = "00000000-0000-4000-8000-000000000004";
const apartment = "00000000-0000-4000-8000-000000000005";
const second = "00000000-0000-4000-8000-000000000006";
const before = { apartment_number: "1", area: 50, price: 500000, rooms: 2, price_per_sqm: 10000 };
const beforeSecond = { ...before, apartment_number: "2" };
async function fixture() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '${owner}'::uuid $$;
    CREATE TABLE public.companies(id uuid PRIMARY KEY,owner_user_id uuid);
    CREATE TABLE public.profiles(id uuid PRIMARY KEY,company_id uuid);
    CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
    CREATE TABLE public.projects(id uuid PRIMARY KEY,company_id uuid);
    CREATE TABLE public.apartments(id uuid PRIMARY KEY,project_id uuid,apartment_number text,area numeric,price numeric,rooms integer,price_per_sqm numeric,UNIQUE(project_id,apartment_number));
    INSERT INTO companies VALUES ('${company}','${owner}'),('${otherCompany}','00000000-0000-4000-8000-000000000009');
    INSERT INTO projects VALUES ('${project}','${company}');
    INSERT INTO apartments VALUES ('${apartment}','${project}','1',50,500000,2,10000),('${second}','${project}','2',50,500000,2,10000);`);
  await db.exec(await readFile(new URL("../../scripts/vps-ai-assistant-sync.sql", import.meta.url), "utf8"));
  return db;
}
async function apply(db: PGlite, updates: Record<string, unknown>[], tenant = company) {
  return db.query("SELECT public.ai_apply_apartment_updates($1::uuid,$2::jsonb) AS result", [tenant, JSON.stringify(updates)]);
}
test("confirmed batch atomically changes area and recomputes per-m² price without changing total price or ids", async () => {
  const db = await fixture();
  try {
    await apply(db, [{ id: apartment, area: 60, before }]);
    const { rows } = await db.query("SELECT id,area,price,price_per_sqm FROM apartments WHERE id=$1", [apartment]);
    assert.deepEqual(rows[0], { id: apartment, area: "60", price: "500000", price_per_sqm: "8333.33" });
  } finally { await db.close(); }
});
test("atomic renumbering allows swapping two apartment numbers even with a uniqueness constraint", async () => {
  const db = await fixture();
  try {
    await apply(db, [{ id: apartment, apartment_number: "2", before }, { id: second, apartment_number: "1", before: beforeSecond }]);
    const { rows } = await db.query("SELECT apartment_number FROM apartments WHERE id=$1", [apartment]); assert.deepEqual(rows[0], { apartment_number: "2" });
  } finally { await db.close(); }
});
test("duplicate apartment numbers roll back the entire batch", async () => {
  const db = await fixture();
  try {
    await assert.rejects(() => apply(db, [{ id: apartment, apartment_number: "2", area: 60, before }]), /такрории/);
    const { rows } = await db.query("SELECT apartment_number,area FROM apartments WHERE id=$1", [apartment]); assert.deepEqual(rows[0], { apartment_number: "1", area: "50" });
  } finally { await db.close(); }
});
test("a stale confirmation cannot overwrite an apartment changed after preview", async () => {
  const db = await fixture();
  try { await db.exec(`UPDATE apartments SET area=55 WHERE id='${apartment}'`); await assert.rejects(() => apply(db, [{ id: apartment, area: 60, before }]), /баъди пешниҳод/); }
  finally { await db.close(); }
});
test("authenticated apartment updates cannot target another company", async () => {
  const db = await fixture();
  try { await assert.rejects(() => apply(db, [{ id: apartment, area: 60, before }], otherCompany), /Дастрасӣ/); }
  finally { await db.close(); }
});
test("only one confirmation can claim a pending user-bound action", async () => {
  const db = await fixture();
  try {
    const { rows: added } = await db.query<{ id: string }>("INSERT INTO ai_action_requests(company_id,user_id,tool_name,arguments,preview) VALUES ($1,$2,'bulk_update_apartments','{}','{}') RETURNING id", [company, owner]);
    const id = added[0]?.id; assert.ok(id);
    const sql = "UPDATE ai_action_requests SET status='executing' WHERE id=$1 AND user_id=$2 AND company_id=$3 AND status='pending' AND expires_at>now() RETURNING id";
    assert.equal((await db.query(sql, [id, owner, company])).rows.length, 1);
    assert.equal((await db.query(sql, [id, owner, company])).rows.length, 0);
  } finally { await db.close(); }
});