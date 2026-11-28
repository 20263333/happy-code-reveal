import { test } from "node:test";
import assert from "node:assert/strict";
import { ownerRoleMatchesCompany } from "./company-template-access";

test("a company owner can manage their own document templates", () => {
  assert.equal(ownerRoleMatchesCompany("owner", "company-a", "company-a"), true);
});
test("owner role cannot authorize another company's document templates", () => {
  assert.equal(ownerRoleMatchesCompany("owner", "company-a", "company-b"), false);
});
test("staff and unbound owners cannot use the owner-role fallback", () => {
  assert.equal(ownerRoleMatchesCompany("manager", "company-a", "company-a"), false);
  assert.equal(ownerRoleMatchesCompany("owner", null, "company-a"), false);
});