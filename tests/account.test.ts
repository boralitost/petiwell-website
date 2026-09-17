import assert from "node:assert/strict";
import { test } from "node:test";

import {
  hashOtp,
  hashPassword,
  hashToken,
  isValidEmail,
  isValidPassword,
  normalizeEmail,
  verifyPassword
} from "../lib/account-auth";
import { TR_CITY_NAMES, isValidTrLocation } from "../lib/tr-locations";

test("account emails normalize and reject junk", () => {
  assert.equal(normalizeEmail("  A@Petiwell.com "), "a@petiwell.com");
  assert.equal(isValidEmail("a@petiwell.com"), true);
  assert.equal(isValidEmail("not-an-email"), false);
  assert.equal(isValidEmail(""), false);
});

test("passwords must be 8+ characters and are stored hashed", async () => {
  assert.equal(isValidPassword("short"), false);
  assert.equal(isValidPassword("longenough"), true);
  const stored = await hashPassword("longenough");
  assert.equal(stored.startsWith("scrypt$"), true);
  assert.equal(await verifyPassword("longenough", stored), true);
  assert.equal(await verifyPassword("wrongpass", stored), false);
});

test("Turkey city and district pairs are validated", () => {
  assert.equal(TR_CITY_NAMES.length, 81);
  assert.equal(isValidTrLocation("İstanbul", "Başakşehir"), true);
  assert.equal(isValidTrLocation("İstanbul", "Merkez"), false);
  assert.equal(isValidTrLocation("Ankara", "Çankaya"), true);
});

test("email OTP hashes include purpose so codes cannot be reused across flows", () => {
  const verify = hashOtp("a@petiwell.com", "verify_email", "123456");
  const change = hashOtp("a@petiwell.com", "change_password", "123456");
  assert.notEqual(verify, change);
  assert.equal(hashOtp("A@Petiwell.com", "verify_email", "123456"), verify);
});

test("login tokens are hashed, never stored raw", () => {
  const raw = "abc123";
  const hashed = hashToken(raw);
  assert.equal(hashed.length, 64);
  assert.notEqual(hashed, raw);
  assert.equal(hashToken(raw), hashed);
});
