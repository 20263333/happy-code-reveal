import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { loadCompanyProjects } from "./projects-list.server";

const company = "00000000-0000-0000-0000-000000000001";
const otherCompany = "00000000-0000-0000-0000-000000000002";
const root = { id: "root-a", company_id: company, name: "Лоиҳаи санҷишӣ", cover_url: null };
const otherRoot = { ...root, id: "root-b", company_id: otherCompany };

function fixture(options: { noCompany?: boolean; failure?: "profiles" | "roots" | "blocks" | "apartments" | "storage" } = {}) {
  const calls: URL[] = [];
  const client = createClient<Database>("https://projects-tests.invalid", "fictional-publishable-test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input) => {
      const url = new URL(String(input));
      calls.push(url);
      const table = url.pathname.split("/").pop();
      const blocks = table === "projects" && url.searchParams.get("select") === "id,parent_id";
      const stage = table === "projects" ? blocks ? "blocks" : "roots" : table;
      if (options.failure === stage || (options.failure === "storage" && url.pathname.includes("/storage/"))) {
        return Response.json({ code: "42501", message: "permission denied" }, { status: 403 });
      }
      if (table === "profiles") return Response.json(options.noCompany ? [] : [{ company_id: company }]);
      if (table === "companies") return Response.json([]);
      if (blocks) return Response.json([{ id: "block-a", parent_id: root.id }]);
      if (table === "projects") return Response.json([root, otherRoot]);
      if (table === "apartments") return Response.json([{ project_id: "block-a", status: "sold" }]);
      return Response.json([]);
    } },
  });
  return { client, calls };
}

test("company listing never returns another company's projects, even with the same name", async () => {
  const { client, calls } = fixture();
  const projects = await loadCompanyProjects(client, "owner-a");
  assert.deepEqual(projects.map((project) => project.id), [root.id]);
  const projectCalls = calls.filter((url) => url.pathname.endsWith("/projects"));
  assert.equal(projectCalls.length, 2);
  for (const url of projectCalls) assert.equal(url.searchParams.get("company_id"), `eq.${company}`);
  assert.equal(projects[0]?.children[0]?.apartments[0]?.status, "sold");
});

test("missing company identity cannot run an unscoped project read", async () => {
  const { client, calls } = fixture({ noCompany: true });
  await assert.rejects(() => loadCompanyProjects(client, "unlinked-user"));
  assert.equal(calls.some((url) => url.pathname.endsWith("/projects")), false);
});

test("failed company identity lookup cannot run a project read", async () => {
  const { client, calls } = fixture({ failure: "profiles" });
  await assert.rejects(() => loadCompanyProjects(client, "owner-a"));
  assert.equal(calls.some((url) => url.pathname.endsWith("/projects")), false);
});

test("unavailable apartment statistics cannot hide company projects or pretend totals are zero", async () => {
  const { client } = fixture({ failure: "apartments" });
  const projects = await loadCompanyProjects(client, "owner-a");
  assert.deepEqual(projects.map((project) => project.id), [root.id]);
  assert.equal(projects[0]?.stats_available, false);
});

test("unavailable block statistics cannot hide company projects", async () => {
  const { client } = fixture({ failure: "blocks" });
  const projects = await loadCompanyProjects(client, "owner-a");
  assert.equal(projects[0]?.id, root.id);
  assert.equal(projects[0]?.stats_available, false);
});

test("failed root project read is reported, not silently displayed as an empty company", async () => {
  const { client } = fixture({ failure: "roots" });
  await assert.rejects(() => loadCompanyProjects(client, "owner-a"));
});