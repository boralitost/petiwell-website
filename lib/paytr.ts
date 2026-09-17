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

export async function queryPaytrOrderStatus(merchantOid: string): Promise<
  | {
      ok: true;
      status: "success";
      paymentAmount?: string;
      returns: {
        amountTry: number;
        referenceNo: string;
        completedAt?: string;
      }[];
    }
  | { ok: false; error: string }
> {
  const merchantId = process.env.PAYTR_MERCHANT_ID;
  const merchantKey = process.env.PAYTR_MERCHANT_KEY;
  const merchantSalt = process.env.PAYTR_MERCHANT_SALT;
  if (!merchantId || !merchantKey || !merchantSalt) {
    return { ok: false, error: "paytr_not_configured" };
  }

  const paytrToken = createHmac("sha256", merchantKey)
    .update(merchantId + merchantOid + merchantSalt)
    .digest("base64");

  const body = new URLSearchParams({
    merchant_id: merchantId,
    merchant_oid: merchantOid,
    paytr_token: paytrToken
  });

  const res = await fetch("https://www.paytr.com/odeme/durum-sorgu", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const text = await res.text();
  let data: {
    status?: string;
    payment_amount?: string;
    payment_total?: string;
    returns?: {
      return_amount?: string;
      reference_no?: string;
      date_completed?: string;
    }[];
    err_msg?: string;
    err_no?: string;
  };
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    return { ok: false, error: "paytr_status_not_json" };
  }

  if (data.status !== "success") {
    return {
      ok: false,
      error: data.err_msg || data.err_no || data.status || "paytr_status_failed"
    };
  }

  return {
    ok: true,
    status: "success",
    paymentAmount: data.payment_total || data.payment_amount,
    returns: Array.isArray(data.returns)
      ? data.returns.map((refund) => ({
          amountTry: Number(
            String(refund.return_amount || "0").replace(",", ".")
          ),
          referenceNo: String(refund.reference_no || ""),
          completedAt: refund.date_completed
        }))
      : []
  };
}

/** PayTR iade API uses a two-decimal TRY string, e.g. 497.00 */
export function formatPaytrRefundAmount(amountTry: number): string {
  return Number(amountTry).toFixed(2);
}

export function paytrRefundToken(input: {
  merchantId: string;
  merchantOid: string;
  returnAmount: string;
  merchantKey: string;
  merchantSalt: string;
}): string {
  return createHmac("sha256", input.merchantKey)
    .update(
      input.merchantId +
        input.merchantOid +
        input.returnAmount +
        input.merchantSalt
    )
    .digest("base64");
}

function isAlreadyRefundedMessage(message: string): boolean {
  return /iade edilmi[sş]|daha önce iade|already refund|refunded already|iade kayd[ıi]/i.test(
    message
  );
}

/**
 * Full refund / cancel on PayTR (iade API). Idempotent if PayTR already refunded.
 */
export async function refundPaytrOrder(
  merchantOid: string,
  amountTry: number,
  referenceNo?: string
): Promise<{ ok: true; alreadyRefunded?: boolean } | { ok: false; error: string }> {
  const merchantId = process.env.PAYTR_MERCHANT_ID;
  const merchantKey = process.env.PAYTR_MERCHANT_KEY;
  const merchantSalt = process.env.PAYTR_MERCHANT_SALT;
  if (!merchantId || !merchantKey || !merchantSalt) {
    return { ok: false, error: "paytr_not_configured" };
  }

  const returnAmount = formatPaytrRefundAmount(amountTry);
  const paytrToken = paytrRefundToken({
    merchantId,
    merchantOid,
    returnAmount,
    merchantKey,
    merchantSalt
  });

  const body = new URLSearchParams({
    merchant_id: merchantId,
    merchant_oid: merchantOid,
    return_amount: returnAmount,
    paytr_token: paytrToken
  });
  if (referenceNo) {
    body.set("reference_no", referenceNo.replace(/[^a-zA-Z0-9]/g, "").slice(0, 64));
  }

  const res = await fetch("https://www.paytr.com/odeme/iade", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const text = await res.text();
  let data: { status?: string; err_msg?: string; err_no?: string };
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    return { ok: false, error: "paytr_refund_not_json" };
  }

  if (data.status === "success") {
    return { ok: true };
  }

  const message = `${data.err_no || ""} ${data.err_msg || ""}`.trim();
  if (isAlreadyRefundedMessage(message)) {
    return { ok: true, alreadyRefunded: true };
  }

  return {
    ok: false,
    error: data.err_msg || data.err_no || "paytr_refund_failed"
  };
}

export function paytrReportedAmountMatches(
  orderTry: number,
  reported?: string
): boolean {
  if (!reported) return false;
  const expectedKurus = Math.round(Number(orderTry) * 100);
  const raw = reported.trim().replace(",", ".");
  if (!raw) return false;
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    if (n === expectedKurus) return true;
    if (Math.round(n * 100) === expectedKurus) return true;
  }
  const asTry = Number(raw);
  return Number.isFinite(asTry) && Math.round(asTry * 100) === expectedKurus;
}

/** Convert TRY to kuruş integer for PayTR */
export function tryToKurus(amountTry: number): number {
  return Math.round(amountTry * 100);
}

export function hashDebug(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}
