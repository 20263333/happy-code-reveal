import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const repair = readFileSync(new URL("./vps-scan-credit-sync.sql", import.meta.url), "utf8");
const company = "00000000-0000-0000-0000-000000000001";
const other = "00000000-0000-0000-0000-000000000002";

test("VPS repair restores scan RPC, preserves balances, and isolates charges", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE TABLE public.companies(id uuid PRIMARY KEY);
      CREATE TABLE public.ai_credits(company_id uuid);
      INSERT INTO public.companies VALUES ('${company}'), ('${other}');
    `);
    await db.exec(repair);
    await db.exec(`INSERT INTO public.ai_credits VALUES ('${other}', 50, 7, 3, now());`);
    const scan = () => db.query<{ scan_free_limit: number; scan_free_used: number; paid_balance: number }>(
      "SELECT * FROM public.consume_scan_credit($1::uuid)", [company]);
    assert.deepEqual((await scan()).rows, [{ scan_free_limit: 50, scan_free_used: 1, paid_balance: 0 }]);
    await db.exec(`UPDATE public.ai_credits SET scan_free_used=50, scan_paid_balance=2 WHERE company_id='${company}';`);
    await db.exec(repair); // Repeat deployment cannot reset balances.
    assert.deepEqual((await scan()).rows, [{ scan_free_limit: 50, scan_free_used: 50, paid_balance: 1 }]);
    await scan();
    await assert.rejects(scan, /no_scan_credits/);
    assert.deepEqual((await db.query("SELECT scan_free_used, scan_paid_balance FROM public.ai_credits WHERE company_id=$1", [other])).rows,
      [{ scan_free_used: 7, scan_paid_balance: 3 }]);
    await assert.rejects(() => db.query("SELECT * FROM public.consume_scan_credit(NULL)"), /company_not_found/);
    await db.exec("SET ROLE authenticated;");
    await assert.rejects(scan, /permission denied/);
  } finally {
    await db.close();
  }
});