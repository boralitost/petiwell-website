import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import {
  decryptSensitive,
  encryptSensitive,
  isAdultOn,
  isValidTckn,
  isValidTrIban,
  normalizeTrPhone
} from "../lib/ambassador-security";
import {
  couponCandidates,
  normalizeAmbassadorCoupon
} from "../lib/ambassador-coupon";
import { priceAmbassadorCart } from "../lib/ambassador-pricing";
import { payoutPeriodFor } from "../lib/ambassador-payout";
import { verifyTotp } from "../lib/admin-auth";
import { proportionalCommissionAdjustment } from "../lib/refunds";
import { verifyShipmentWebhookSignature } from "../app/api/webhooks/shipment/route";

function totpCode(secret: Buffer, now: number) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 30_000)));
  const digest = createHmac("sha1", secret).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

test("ambassador identity helpers validate and normalize safely", () => {
  assert.equal(normalizeTrPhone("+90 (555) 111 22 33"), "5551112233");
  assert.equal(isValidTckn("10000000146"), true);
  assert.equal(isValidTckn("10000000145"), false);
  assert.equal(isValidTrIban("TR33 0006 1005 1978 6457 8413 26"), true);
  assert.equal(isValidTrIban("TR33 0006 1005 1978 6457 8413 25"), false);
  assert.equal(
    isAdultOn(new Date("2008-09-17T00:00:00.000Z"), new Date("2026-09-17T12:00:00.000Z")),
    true
  );
  assert.equal(
    isAdultOn(new Date("2008-09-18T00:00:00.000Z"), new Date("2026-09-17T12:00:00.000Z")),
    false
  );
});

test("sensitive ambassador fields round-trip with AES-256-GCM", () => {
  const previous = process.env.AMBASSADOR_DATA_ENCRYPTION_KEY;
  process.env.AMBASSADOR_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  try {
    const encrypted = encryptSensitive("TR330006100519786457841326");
    assert.notEqual(encrypted, "TR330006100519786457841326");
    assert.equal(decryptSensitive(encrypted), "TR330006100519786457841326");
  } finally {
    if (previous === undefined) delete process.env.AMBASSADOR_DATA_ENCRYPTION_KEY;
    else process.env.AMBASSADOR_DATA_ENCRYPTION_KEY = previous;
  }
});

test("coupon codes transliterate Turkish names and remain deterministic", () => {
  assert.equal(normalizeAmbassadorCoupon("  ŞiMŞeK 10 "), "SIMSEK10");
  assert.deepEqual(couponCandidates("Çağrı", "Öztürk").slice(0, 2), [
    "CAGRI10",
    "CAGRIO10"
  ]);
});

test("second unit campaign precedes ambassador discount and ex-VAT commission", () => {
  const result = priceAmbassadorCart({
    lines: [{ productId: "paste", unitPriceTry: 400, quantity: 2 }],
    applySecondProductCampaign: true,
    customerDiscountRate: 0.1,
    commissionRate: 0.15,
    vatRate: 20
  });
  assert.equal(result.grossProductTry, 800);
  assert.equal(result.campaignDiscountTry, 399);
  assert.equal(result.ambassadorDiscountTry, 40.1);
  assert.equal(result.finalProductTry, 360.9);
  assert.equal(result.netProductTry, 300.75);
  assert.equal(result.commissionTry, 45.11);
  assert.equal(result.lines[0].finalProductTotalTry, 360.9);
});

test("mixed-price campaign discounts the cheaper eligible unit", () => {
  const result = priceAmbassadorCart({
    lines: [
      { productId: "expensive", unitPriceTry: 500, quantity: 1 },
      { productId: "cheap", unitPriceTry: 300, quantity: 1 }
    ],
    applySecondProductCampaign: true,
    customerDiscountRate: 0,
    commissionRate: 0,
    vatRate: 20
  });
  assert.equal(result.campaignDiscountTry, 299);
  assert.equal(
    result.lines.find((line) => line.productId === "cheap")?.finalProductTotalTry,
    1
  );
});

test("payout cutoffs use fixed Europe/Istanbul UTC+3 boundaries", () => {
  const firstHalf = payoutPeriodFor(new Date("2026-09-15T06:15:00.000Z"));
  assert.equal(firstHalf.periodStart.toISOString(), "2026-08-31T21:00:00.000Z");
  assert.equal(firstHalf.periodEnd.toISOString(), "2026-09-14T21:00:00.000Z");

  const monthStart = payoutPeriodFor(new Date("2026-10-01T06:15:00.000Z"));
  assert.equal(monthStart.periodStart.toISOString(), "2026-09-14T21:00:00.000Z");
  assert.equal(monthStart.periodEnd.toISOString(), "2026-09-30T21:00:00.000Z");
});

test("admin TOTP accepts the current window and rejects a wrong code", () => {
  const secretBytes = Buffer.from([
    72, 101, 108, 108, 111, 33, 0xde, 0xad, 0xbe, 0xef
  ]);
  const secretBase32 = "JBSWY3DPEHPK3PXP";
  const now = 1_700_000_000_000;
  const code = totpCode(secretBytes, now);
  assert.equal(verifyTotp(secretBase32, code, now), true);
  assert.equal(verifyTotp(secretBase32, code === "000000" ? "000001" : "000000", now), false);
});

test("partial refund commission adjustments are proportional and capped", () => {
  assert.equal(
    proportionalCommissionAdjustment({
      originalCommissionTry: 45,
      discountedProductTry: 360,
      productRefundTry: 120,
      existingAdjustmentsTry: 0
    }),
    15
  );
  assert.equal(
    proportionalCommissionAdjustment({
      originalCommissionTry: 45,
      discountedProductTry: 360,
      productRefundTry: 360,
      existingAdjustmentsTry: -35
    }),
    10
  );
});

test("shipment webhook signatures require the exact raw payload", () => {
  const payload = JSON.stringify({ eventId: "evt-1", eventType: "delivered" });
  const secret = "shipment-test-secret";
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  assert.equal(verifyShipmentWebhookSignature(payload, signature, secret), true);
  assert.equal(
    verifyShipmentWebhookSignature(`${payload} `, signature, secret),
    false
  );
});
