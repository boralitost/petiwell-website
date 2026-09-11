import { createHash, createHmac } from "crypto";

type TokenParams = {
  email: string;
  paymentAmountKurus: number;
  merchantOid: string;
  userName: string;
  userAddress: string;
  userPhone: string;
  userBasket: string; // base64 JSON basket
  userIp: string;
  merchantOkUrl: string;
  merchantFailUrl: string;
  currency?: string;
  testMode?: "0" | "1";
  noInstallment?: "0" | "1";
  maxInstallment?: string;
  lang?: "tr" | "en";
};

export function encodeBasket(
  lines: { name: string; priceTry: number; quantity: number }[]
): string {
  const basket = lines.map((l) => [
    l.name,
    l.priceTry.toFixed(2),
    l.quantity
  ]);
  return Buffer.from(JSON.stringify(basket)).toString("base64");
}

export async function requestPaytrIframeToken(params: TokenParams): Promise<
  | { ok: true; token: string }
  | { ok: false; error: string }
> {
  const merchantId = process.env.PAYTR_MERCHANT_ID;
  const merchantKey = process.env.PAYTR_MERCHANT_KEY;
  const merchantSalt = process.env.PAYTR_MERCHANT_SALT;

  if (!merchantId || !merchantKey || !merchantSalt) {
    return { ok: false, error: "paytr_not_configured" };
  }

  const noInstallment = params.noInstallment ?? "1";
  const maxInstallment = params.maxInstallment ?? "0";
  const currency = params.currency ?? "TL";
  const testMode =
    params.testMode ??
    (process.env.PAYTR_TEST_MODE === "0" ? "0" : "1");
  const lang = params.lang ?? "tr";

  const hashStr =
    merchantId +
    params.userIp +
    params.merchantOid +
    params.email +
    String(params.paymentAmountKurus) +
    params.userBasket +
    noInstallment +
    maxInstallment +
    currency +
    testMode;

  const paytrToken = createHmac("sha256", merchantKey)
    .update(hashStr + merchantSalt)
    .digest("base64");

  const body = new URLSearchParams({
    merchant_id: merchantId,
    user_ip: params.userIp,
    merchant_oid: params.merchantOid,
    email: params.email,
    payment_amount: String(params.paymentAmountKurus),
    paytr_token: paytrToken,
    user_basket: params.userBasket,
    debug_on: testMode === "1" ? "1" : "0",
    no_installment: noInstallment,
    max_installment: maxInstallment,
    user_name: params.userName,
    user_address: params.userAddress,
    user_phone: params.userPhone,
    merchant_ok_url: params.merchantOkUrl,
    merchant_fail_url: params.merchantFailUrl,
    timeout_limit: "30",
    currency,
    test_mode: testMode,
    lang
  });

  const res = await fetch("https://www.paytr.com/odeme/api/get-token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  const data = (await res.json()) as { status?: string; token?: string; reason?: string };
  if (data.status === "success" && data.token) {
    return { ok: true, token: data.token };
  }
  return { ok: false, error: data.reason || "paytr_token_failed" };
}

/**
 * Verify PayTR notification callback hash.
 * Expected fields from PayTR POST body.
 */
export function verifyPaytrCallback(input: {
  merchantOid: string;
  status: string;
  totalAmount: string;
  hash: string;
}): boolean {
  const merchantKey = process.env.PAYTR_MERCHANT_KEY;
  const merchantSalt = process.env.PAYTR_MERCHANT_SALT;
  if (!merchantKey || !merchantSalt) return false;

  const token = createHmac("sha256", merchantKey)
    .update(
      input.merchantOid + merchantSalt + input.status + input.totalAmount
    )
    .digest("base64");

  return token === input.hash;
}

/** Convert TRY to kuruş integer for PayTR */
export function tryToKurus(amountTry: number): number {
  return Math.round(amountTry * 100);
}

export function hashDebug(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}
