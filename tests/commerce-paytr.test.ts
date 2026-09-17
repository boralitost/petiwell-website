import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";

import {
  calcShippingTry,
  getShippingFlatTry,
  isDirectSalesEnabled
} from "../lib/commerce";
import {
  generateOrderNumber,
  isPetiwellOrderNumber
} from "../lib/order-id";
import { resolveEmailFrom, DEFAULT_EMAIL_FROM, resolveShopNotify, DEFAULT_SHOP_NOTIFY } from "../lib/email-from";
import { tryToKurus, verifyPaytrCallback, formatPaytrRefundAmount, paytrRefundToken, paytrReportedAmountMatches } from "../lib/paytr";
import { paytrRefundReference } from "../lib/refunds";

test("sales flag is off unless explicitly true", () => {
  const previous = process.env.NEXT_PUBLIC_DIRECT_SALES_ENABLED;
  delete process.env.NEXT_PUBLIC_DIRECT_SALES_ENABLED;
  assert.equal(isDirectSalesEnabled(), false);
  process.env.NEXT_PUBLIC_DIRECT_SALES_ENABLED = "false";
  assert.equal(isDirectSalesEnabled(), false);
  process.env.NEXT_PUBLIC_DIRECT_SALES_ENABLED = "true";
  assert.equal(isDirectSalesEnabled(), true);
  if (previous === undefined) delete process.env.NEXT_PUBLIC_DIRECT_SALES_ENABLED;
  else process.env.NEXT_PUBLIC_DIRECT_SALES_ENABLED = previous;
});

test("shipping defaults to zero when env is unset (price includes cargo)", () => {
  const flat = process.env.SHIPPING_FLAT_TRY;
  const free = process.env.SHIPPING_FREE_OVER_TRY;
  delete process.env.SHIPPING_FLAT_TRY;
  delete process.env.SHIPPING_FREE_OVER_TRY;
  assert.equal(getShippingFlatTry(), 0);
  assert.equal(calcShippingTry(497), 0);
  if (flat === undefined) delete process.env.SHIPPING_FLAT_TRY;
  else process.env.SHIPPING_FLAT_TRY = flat;
  if (free === undefined) delete process.env.SHIPPING_FREE_OVER_TRY;
  else process.env.SHIPPING_FREE_OVER_TRY = free;
});

test("497 TRY is 49700 kuruş for PayTR", () => {
  assert.equal(tryToKurus(497), 49700);
});

test("generated order numbers match the public confirm pattern", () => {
  const oid = generateOrderNumber();
  assert.equal(isPetiwellOrderNumber(oid), true);
  assert.equal(isPetiwellOrderNumber("nope"), false);
  assert.equal(isPetiwellOrderNumber("PW-20260916-ABCDEF"), true);
});

test("PayTR callback hash accepts only the signed payload", () => {
  process.env.PAYTR_MERCHANT_KEY = "test-key";
  process.env.PAYTR_MERCHANT_SALT = "test-salt";
  const merchantOid = "PWtestoid1";
  const status = "success";
  const totalAmount = "49700";
  const hash = createHmac("sha256", "test-key")
    .update(merchantOid + "test-salt" + status + totalAmount)
    .digest("base64");

  assert.equal(
    verifyPaytrCallback({ merchantOid, status, totalAmount, hash }),
    true
  );
  assert.equal(
    verifyPaytrCallback({
      merchantOid,
      status,
      totalAmount: "1",
      hash
    }),
    false
  );
});

test("sender is noreply@petiwell.com, never Gmail or siparis@", () => {
  assert.equal(resolveEmailFrom(""), DEFAULT_EMAIL_FROM);
  assert.equal(resolveEmailFrom("Petiwell <siparis@petiwell.com>"), DEFAULT_EMAIL_FROM);
  assert.equal(resolveEmailFrom("Petiwell <onboarding@resend.dev>"), DEFAULT_EMAIL_FROM);
  assert.equal(resolveEmailFrom("petiwelltr@gmail.com"), null);
  assert.equal(
    resolveEmailFrom("Petiwell <noreply@petiwell.com>"),
    DEFAULT_EMAIL_FROM
  );
});

test("shop notify uses Gmail, not placeholder petiwell.com inboxes", () => {
  assert.equal(resolveShopNotify(""), DEFAULT_SHOP_NOTIFY);
  assert.equal(resolveShopNotify("hello@petiwell.com"), DEFAULT_SHOP_NOTIFY);
  assert.equal(resolveShopNotify("siparis@petiwell.com"), DEFAULT_SHOP_NOTIFY);
  assert.equal(resolveShopNotify("noreply@petiwell.com"), DEFAULT_SHOP_NOTIFY);
  assert.equal(
    resolveShopNotify("petiwelltr@gmail.com"),
    "petiwelltr@gmail.com"
  );
});

test("PayTR refund token matches merchant_id + oid + amount + salt", () => {
  const token = paytrRefundToken({
    merchantId: "123",
    merchantOid: "PWoid",
    returnAmount: "497.00",
    merchantKey: "test-key",
    merchantSalt: "test-salt"
  });
  const expected = createHmac("sha256", "test-key")
    .update("123PWoid497.00test-salt")
    .digest("base64");
  assert.equal(token, expected);
  assert.equal(formatPaytrRefundAmount(497), "497.00");
});

test("PayTR refund references are stable and strictly alphanumeric", () => {
  assert.equal(
    paytrRefundReference("refund_123e4567-e89b-12d3-a456-426614174000"),
    "refund123e4567e89b12d3a456426614174000"
  );
});

test("PayTR reported amount matches order TRY in kuruş or decimal form", () => {
  assert.equal(paytrReportedAmountMatches(497, "49700"), true);
  assert.equal(paytrReportedAmountMatches(497, "497.00"), true);
  assert.equal(paytrReportedAmountMatches(497, "497"), true);
  assert.equal(paytrReportedAmountMatches(497, "1"), false);
  assert.equal(paytrReportedAmountMatches(497, ""), false);
});
