import { test } from "node:test";
import assert from "node:assert/strict";
import { buildContractTags, buildReceiptTags, contractTagsFromRecords, fillDocumentTags, type ContractTagSource } from "./template-tags";

const ctx: ContractTagSource = { contract_number: "42", contract_date: "28.11.2026", client_full_name: "Муштарии санҷишӣ", client_birth_year: "1990", client_tin: "123456789", passport_series: "A 12345", passport_authority: "ШВКД", passport_issue_date: "01.01.2020", client_address: "Душанбе", client_phone: "+992900000001", apt_number: "12", floor_number: "0", rooms_number: "3", area: "80", total_price: 880000, usd_rate: 11, sale_price_per_m2: 11000 };
const tags = buildContractTags(ctx);
const expected = { contract_number: "42", contract_date: "28.11.2026", client_full_name: "Муштарии санҷишӣ", client_birth_year: "1990", client_tin: "123456789", passport_series: "A 12345", passport_authority: "ШВКД", Issue_date: "01.01.2020", client_address: "Душанбе", client_phone: "+992900000001", apt_number: "12", floor_number: "0", rooms_number: "3", area: "80", price_per_sqm_tjs: "11 000,00", price_per_sqm_tjs_words: "Ёздаҳ ҳазор сомонӣ 00 дирам", price_per_sqm_usd: "1 000,00", price_per_sqm_usd_words: "Як ҳазор доллар 00 сент", total_price: "880 000,00", total_price_words: "Ҳаштсад у ҳаштод ҳазор сомонӣ 00 дирам", price_usd: "80 000,00", price_usd_words_us_dollars: "Ҳаштод ҳазор доллар 00 сент" };
for (const [key, value] of Object.entries(expected)) test(`requested tag ${key} resolves its concrete document value`, () => assert.equal(tags[key], value));
test("receipt payment amount stays distinct from apartment total price", () => {
  const receipt = buildReceiptTags(tags, { receipt_number: "7", receipt_date: "28.11.2026", amount: 5000 });
  assert.equal(receipt.amount, "5 000,00"); assert.equal(receipt['total_price'], "880 000,00");
  assert.equal(receipt.amount_words, "Панҷ ҳазор сомонӣ 00 дирам");
});
test("HTML double-brace tags are filled before legacy single-brace aliases", () => {
  assert.equal(fillDocumentTags("{{Issue_date}} {{rooms_number}} {client}", tags), "01.01.2020 3 {client}");
});
test("bundled legacy receipt still prints the payment, not the whole sale", () => {
  const receipt = buildReceiptTags(tags, { receipt_number: "7", receipt_date: "28.11.2026", amount: 5000 }, true);
  assert.equal(receipt['total_price'], "5 000,00");
  assert.equal(receipt.amount, "5 000,00");
});
test("editing today's area cannot change the stored sale area and price in document tags", () => {
  const output = contractTagsFromRecords({ full_price: 880000, area_snapshot: 80, sale_price_per_m2: 11000 }, {}, { area: 90, rooms: 3 }, 11);
  assert.equal(output['area'], "80"); assert.equal(output['price_per_sqm_tjs'], "11 000,00");
});