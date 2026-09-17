import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canTransition,
  customerEmailOnStatus,
  isUsableTrackingNumber,
  nextActions,
  normalizeTrackingNumber,
  requiresTrackingNumber,
  shouldRestoreStock,
  needsPaytrRefund
} from "../lib/order-status";

test("paid order may prepare, ship, cancel or refund — not skip to delivered", () => {
  assert.deepEqual(nextActions("paid"), [
    "preparing",
    "shipped",
    "cancelled",
    "refunded"
  ]);
  assert.equal(canTransition("paid", "delivered"), false);
  assert.equal(canTransition("paid", "preparing"), true);
});

test("unpaid order can only be closed, never shipped", () => {
  assert.deepEqual(nextActions("pending_payment"), ["cancelled"]);
  assert.equal(canTransition("pending_payment", "shipped"), false);
  assert.equal(canTransition("pending_payment", "paid"), false);
});

test("cancelled and refunded are frozen", () => {
  assert.deepEqual(nextActions("cancelled"), []);
  assert.deepEqual(nextActions("refunded"), []);
  assert.equal(canTransition("cancelled", "preparing"), false);
  assert.equal(canTransition("refunded", "paid"), false);
});

test("shipped requires a tracking number of at least 5 characters", () => {
  assert.equal(requiresTrackingNumber("shipped"), true);
  assert.equal(requiresTrackingNumber("preparing"), false);
  assert.equal(isUsableTrackingNumber("  ab  "), false);
  assert.equal(isUsableTrackingNumber("PW12345"), true);
  assert.equal(normalizeTrackingNumber("  ABC  99  ").length > 0, true);
});

test("stock returns only while goods are still in-house", () => {
  assert.equal(shouldRestoreStock("paid", "cancelled", "success"), true);
  assert.equal(shouldRestoreStock("preparing", "refunded", "success"), true);
  assert.equal(shouldRestoreStock("shipped", "refunded", "success"), false);
  assert.equal(shouldRestoreStock("delivered", "refunded", "success"), false);
  assert.equal(shouldRestoreStock("paid", "cancelled", "pending"), false);
  assert.equal(shouldRestoreStock("pending_payment", "cancelled", "pending"), false);
});

test("customer emails match the phase, except unpaid cancel", () => {
  assert.equal(customerEmailOnStatus("paid", "preparing", "success"), "preparing");
  assert.equal(customerEmailOnStatus("preparing", "shipped", "success"), "shipped");
  assert.equal(customerEmailOnStatus("shipped", "delivered", "success"), "delivered");
  assert.equal(customerEmailOnStatus("paid", "cancelled", "success"), "cancelled");
  assert.equal(
    customerEmailOnStatus("pending_payment", "cancelled", "pending"),
    null
  );
  assert.equal(customerEmailOnStatus("paid", "paid", "success"), null);
});

test("paid cancel and refund require a PayTR iade, unpaid cancel does not", () => {
  assert.equal(needsPaytrRefund("cancelled", "success"), true);
  assert.equal(needsPaytrRefund("refunded", "success"), true);
  assert.equal(needsPaytrRefund("cancelled", "pending"), false);
  assert.equal(needsPaytrRefund("preparing", "success"), false);
});
