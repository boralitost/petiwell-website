import assert from "node:assert/strict";
import { test } from "node:test";

import { tryToKurus } from "../lib/paytr";
import {
  applyPromoToTotals,
  findPromoDefinition,
  normalizePromoCode,
  parsePromoCatalog
} from "../lib/promo";

test("promo codes normalize to uppercase without spaces", () => {
  assert.equal(normalizePromoCode(" pw1tl-ab12 "), "PW1TL-AB12");
});

test("set_total promo drops a 497 TRY cart to 1.00 TRY", () => {
  const applied = applyPromoToTotals(497, 0, {
    code: "PW1TL-TEST",
    type: "set_total",
    value: 1,
    maxUses: 10
  });
  assert.equal(applied.ok, true);
  if (!applied.ok) return;
  assert.equal(applied.totalTry, 1);
  assert.equal(applied.discountTry, 496);
  assert.equal(tryToKurus(applied.totalTry), 100);
});

test("set_total does not inflate a cheaper cart", () => {
  const applied = applyPromoToTotals(0.5, 0, {
    code: "PW1TL-TEST",
    type: "set_total",
    value: 1,
    maxUses: 10
  });
  assert.equal(applied.ok, true);
  if (!applied.ok) return;
  assert.equal(applied.totalTry, 0.5);
  assert.equal(applied.discountTry, 0);
});

test("percent_off and amount_off reduce the gross total", () => {
  const percent = applyPromoToTotals(200, 0, {
    code: "SAVE10",
    type: "percent_off",
    value: 10,
    maxUses: 1
  });
  assert.equal(percent.ok, true);
  if (percent.ok) {
    assert.equal(percent.discountTry, 20);
    assert.equal(percent.totalTry, 180);
  }

  const amount = applyPromoToTotals(200, 50, {
    code: "MINUS40",
    type: "amount_off",
    value: 40,
    maxUses: 1
  });
  assert.equal(amount.ok, true);
  if (amount.ok) {
    assert.equal(amount.discountTry, 40);
    assert.equal(amount.totalTry, 210);
  }
});

test("PROMO_SET_TOTAL_* env registers a private 1 TL code", () => {
  const prevCode = process.env.PROMO_SET_TOTAL_CODE;
  const prevTry = process.env.PROMO_SET_TOTAL_TRY;
  const prevUses = process.env.PROMO_SET_TOTAL_MAX_USES;
  process.env.PROMO_SET_TOTAL_CODE = "pw1tl-secret";
  process.env.PROMO_SET_TOTAL_TRY = "1";
  process.env.PROMO_SET_TOTAL_MAX_USES = "10";

  const catalog = parsePromoCatalog("");
  const promo = findPromoDefinition(catalog, "PW1TL-SECRET");
  assert.ok(promo);
  assert.equal(promo?.type, "set_total");
  assert.equal(promo?.value, 1);
  assert.equal(promo?.maxUses, 10);

  if (prevCode === undefined) delete process.env.PROMO_SET_TOTAL_CODE;
  else process.env.PROMO_SET_TOTAL_CODE = prevCode;
  if (prevTry === undefined) delete process.env.PROMO_SET_TOTAL_TRY;
  else process.env.PROMO_SET_TOTAL_TRY = prevTry;
  if (prevUses === undefined) delete process.env.PROMO_SET_TOTAL_MAX_USES;
  else process.env.PROMO_SET_TOTAL_MAX_USES = prevUses;
});
