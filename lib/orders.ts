import { createHash } from "crypto";
import { Locale } from "@/lib/i18n";
import { quoteCart, QuoteLineInput } from "@/lib/pricing";
import { isCompanyInfoComplete, getCompanyInfo } from "@/lib/company";
import { isDirectSalesEnabled } from "@/lib/commerce";
import { prisma } from "@/lib/db";
import { decrementStock, ensureInventorySeeded } from "@/lib/inventory";
import { sendOrderPaidEmail } from "@/lib/email";
import { queryPaytrOrderStatus, paytrReportedAmountMatches } from "@/lib/paytr";
import {
  generateMerchantOid,
  generateOrderNumber
} from "@/lib/order-id";
import { updateAccountProfile, upsertDefaultAddress } from "@/lib/account";
import { isValidTrLocation } from "@/lib/tr-locations";
import { orderToGa4Purchase, sendGa4Purchase } from "@/lib/ga4-mp";
import { normalizeTrPhone } from "@/lib/ambassador-security";
import { evaluateAmbassadorOrderFraud } from "@/lib/ambassador-fraud";
import { getConsumerLegalSnapshot } from "@/lib/legal-consumer";

export {
  generateMerchantOid,
  generateOrderNumber,
  isPetiwellOrderNumber
} from "@/lib/order-id";

export type CheckoutCustomerInput = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  billingAddress: string;
  city: string;
  district?: string;
  postalCode?: string;
  notes?: string;
  distanceSalesAccepted: boolean;
  preInfoAccepted: boolean;
  privacyAccepted: boolean;
  locale?: Locale;
  items: QuoteLineInput[];
  promoCode?: string;
  userId?: string | null;
  ambassadorReferralId?: string | null;
};

export async function createPendingOrder(input: CheckoutCustomerInput) {
  if (!isDirectSalesEnabled()) {
    return { ok: false as const, error: "sales_disabled" };
  }
  if (!isCompanyInfoComplete()) {
    return { ok: false as const, error: "company_incomplete" };
  }
  if (
    !input.distanceSalesAccepted ||
    !input.preInfoAccepted ||
    !input.privacyAccepted
  ) {
    return { ok: false as const, error: "legal_not_accepted" };
  }
  if (!isValidTrLocation(input.city.trim(), (input.district || "").trim())) {
    return { ok: false as const, error: "invalid_location" };
  }

  const locale = input.locale ?? "tr";
  const consumerLegal = getConsumerLegalSnapshot(locale);
  const quote = await quoteCart(
    input.items,
    locale,
    input.promoCode,
    input.ambassadorReferralId
  );
  if (!quote.ok) {
    return { ok: false as const, error: quote.error };
  }

  const orderNumber = generateOrderNumber();
  const merchantOid = generateMerchantOid();

  try {
    const order = await prisma.$transaction(async (tx) => {
      if (quote.totals.promoCode && !quote.ambassador?.couponId) {
        const promo = await tx.promoCode.findUnique({
          where: { code: quote.totals.promoCode }
        });
        const consumed = await tx.promoCode.updateMany({
          where: {
            code: quote.totals.promoCode,
            active: true,
            usedCount: { lt: promo?.maxUses ?? 0 }
          },
          data: { usedCount: { increment: 1 } }
        });
        if (consumed.count !== 1) {
          throw new Error("promo_exhausted");
        }
      }

      const created = await tx.order.create({
        data: {
          orderNumber,
          customerName: input.customerName.trim(),
          customerEmail: input.customerEmail.trim().toLowerCase(),
          customerPhone: input.customerPhone.trim(),
          shippingAddress: input.shippingAddress.trim(),
          billingAddress: (input.billingAddress || input.shippingAddress).trim(),
          city: input.city.trim(),
          district: (input.district ?? "").trim(),
          postalCode: (input.postalCode ?? "").trim(),
          notes: (input.notes ?? "").trim(),
          subtotalTry: quote.totals.subtotalTry,
          shippingTry: quote.totals.shippingTry,
          discountTry: quote.totals.discountTry,
          totalTry: quote.totals.totalTry,
          promoCode: quote.totals.promoCode || null,
          ambassadorId: quote.ambassador?.id || null,
          ambassadorCouponId: quote.ambassador?.couponId || null,
          ambassadorReferralId: quote.ambassador?.referralId || null,
          attributionType: quote.ambassador?.attributionType || "NONE",
          attributionSource: quote.ambassador?.attributionSource || null,
          commissionRateSnapshot:
            quote.totals.commissionRateSnapshot || 0,
          customerDiscountRateSnapshot:
            quote.totals.customerDiscountRateSnapshot || 0,
          campaignDiscountTry: quote.totals.campaignDiscountTry || 0,
          ambassadorDiscountTry:
            quote.totals.ambassadorDiscountTry || 0,
          productTotalAfterDiscountTry:
            quote.totals.productTotalAfterDiscountTry ||
            quote.totals.subtotalTry,
          productNetExVatTry:
            quote.totals.productNetExVatTry || quote.totals.subtotalTry,
          vatRateSnapshot: quote.totals.vatRateSnapshot || 20,
          status: "pending_payment",
          paymentStatus: "pending",
          paytrMerchantOid: merchantOid,
          userId: input.userId || null,
          distanceSalesAccepted: true,
          preInfoAccepted: true,
          privacyAccepted: true,
          consumerLegalVersion: consumerLegal.version,
          consumerLegalHash: consumerLegal.hash,
          items: {
            create: quote.lines.map((line) => ({
              productId: line.productId,
              sku: line.sku,
              productName: line.name,
              unitPriceTry: line.unitPriceTry,
              quantity: line.quantity,
              lineTotalTry: line.lineTotalTry,
              campaignDiscountTry: line.campaignDiscountTry || 0,
              ambassadorDiscountTry: line.ambassadorDiscountTry || 0,
              finalProductTotalTry:
                line.finalProductTotalTry ?? line.lineTotalTry,
              vatRateSnapshot: line.vatRateSnapshot || 20,
              netProductTry: line.netProductTry || line.lineTotalTry
            }))
          },
          payments: {
            create: {
              merchantOid,
              amountTry: quote.totals.totalTry,
              currency: "TRY",
              status: "pending"
            }
          }
        },
        include: { items: true, payments: true }
      });
      if (quote.ambassador?.referralId) {
        await tx.ambassadorReferral.update({
          where: { id: quote.ambassador.referralId },
          data: { convertedAt: new Date() }
        });
      }
      if (quote.ambassador) {
        const owner = await tx.ambassador.findUnique({
          where: { id: quote.ambassador.id },
          select: { email: true, phone: true, shippingAddress: true }
        });
        const normalizeAddress = (value: string) =>
          value.toLocaleUpperCase("tr-TR").replace(/\s+/g, " ").trim();
        const matches = [
          owner?.email === input.customerEmail.trim().toLowerCase()
            ? "e-posta"
            : "",
          owner?.phone === normalizeTrPhone(input.customerPhone)
            ? "telefon"
            : "",
          owner &&
          normalizeAddress(owner.shippingAddress) ===
            normalizeAddress(input.shippingAddress)
            ? "adres"
            : ""
        ].filter(Boolean);
        if (matches.length) {
          await tx.ambassadorFraudFlag.create({
            data: {
              ambassadorId: quote.ambassador.id,
              orderId: created.id,
              type: "SELF_PURCHASE",
              severity: "HIGH",
              notes: `Sipariş ${matches.join(", ")} bilgisi Marka Elçisi kaydıyla eşleşti.`
            }
          });
        }
      }
      return created;
    });

    if (input.userId) {
      await updateAccountProfile(input.userId, {
        name: input.customerName,
        phone: input.customerPhone
      });
      await upsertDefaultAddress(input.userId, {
        fullName: input.customerName,
        phone: input.customerPhone,
        address: input.shippingAddress,
        city: input.city,
        district: input.district,
        postalCode: input.postalCode
      });
    }

    return {
      ok: true as const,
      order,
      quote,
      company: getCompanyInfo()
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "promo_exhausted") {
      return { ok: false as const, error: "promo_exhausted" };
    }
    throw err;
  }
}

export function paytrConfigReady(): boolean {
  return Boolean(
    process.env.PAYTR_MERCHANT_ID &&
      process.env.PAYTR_MERCHANT_KEY &&
      process.env.PAYTR_MERCHANT_SALT
  );
}

async function dispatchPaidEmail(order: {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  shippingAddress: string;
  city: string;
  subtotalTry: { toString(): string } | number;
  shippingTry: { toString(): string } | number;
  discountTry?: { toString(): string } | number;
  totalTry: { toString(): string } | number;
  promoCode?: string | null;
  items: {
    productName: string;
    quantity: number;
    unitPriceTry: { toString(): string } | number;
    lineTotalTry: { toString(): string } | number;
  }[];
}) {
  return sendOrderPaidEmail({
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    shippingAddress: order.shippingAddress,
    city: order.city,
    subtotalTry: Number(order.subtotalTry),
    shippingTry: Number(order.shippingTry),
    discountTry: Number(order.discountTry || 0),
    totalTry: Number(order.totalTry),
    promoCode: order.promoCode,
    items: order.items.map((i) => ({
      productName: i.productName,
      quantity: i.quantity,
      unitPriceTry: Number(i.unitPriceTry),
      lineTotalTry: Number(i.lineTotalTry)
    }))
  });
}

async function markPaidEmailSent(orderId: string) {
  await prisma.order.update({
    where: { id: orderId },
    data: { paidEmailSentAt: new Date() }
  });
  const attempts = await prisma.paymentAttempt.findMany({
    where: { orderId }
  });
  for (const attempt of attempts) {
    const note = attempt.errorMessage || "";
    if (!note.includes("email:")) continue;
    const cleaned = note
      .split(";")
      .map((p) => p.trim())
      .filter((p) => p && !p.startsWith("email:"))
      .join("; ");
    await prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: { errorMessage: cleaned || null }
    });
  }
}

export async function retryPaidEmailIfNeeded(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      payments: { orderBy: { createdAt: "desc" } }
    }
  });
  if (!order || order.paymentStatus !== "success") {
    return { ok: false as const, error: "not_paid" };
  }
  if (order.paidEmailSentAt) {
    return { ok: true as const, skipped: true as const };
  }
  const email = await dispatchPaidEmail(order);
  if (email.ok) {
    await markPaidEmailSent(order.id);
  }
  return { ok: email.ok, error: email.error };
}

export async function markOrderPaid(orderId: string, merchantOid: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true }
  });
  if (!order) return { ok: false as const, error: "order_not_found" };
  if (order.paymentStatus === "success" && order.status === "paid") {
    const retry = await retryPaidEmailIfNeeded(order.id);
    return { ok: true as const, alreadyPaid: true, emailError: retry.error };
  }

  let stockError = "";
  await ensureInventorySeeded();
  await prisma.$transaction(async (tx) => {
    const fresh = await tx.order.findUnique({ where: { id: order.id } });
    if (!fresh || fresh.paymentStatus === "success") return;

    try {
      for (const item of order.items) {
        await decrementStock(item.productId, item.quantity, tx);
      }
    } catch (err) {
      stockError = err instanceof Error ? err.message : "stock_error";
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "paid",
        paymentStatus: "success"
      }
    });

    if (fresh.ambassadorId && Number(fresh.productNetExVatTry) > 0) {
      const selfPurchase = await tx.ambassadorFraudFlag.findFirst({
        where: {
          ambassadorId: fresh.ambassadorId,
          orderId: fresh.id,
          type: "SELF_PURCHASE",
          status: { in: ["OPEN", "REVIEWING", "RESOLVED"] }
        },
        select: { id: true }
      });
      if (!selfPurchase) {
        const commissionRate = Number(fresh.commissionRateSnapshot);
        const commissionAmount =
          Math.round(
            Number(fresh.productNetExVatTry) * commissionRate * 100
          ) / 100;
        await tx.ambassadorCommission.upsert({
          where: { orderId: fresh.id },
          create: {
            ambassadorId: fresh.ambassadorId,
            orderId: fresh.id,
            grossProductAmount: fresh.subtotalTry,
            discountedProductAmount: fresh.productTotalAfterDiscountTry,
            netProductAmountExVat: fresh.productNetExVatTry,
            commissionRate,
            commissionAmount,
            status: "PENDING"
          },
          update: {}
        });
      }
    }

    await tx.paymentAttempt.updateMany({
      where: { merchantOid },
      data: {
        status: "success",
        callbackAt: new Date(),
        errorMessage: stockError || null
      }
    });
  });
  await evaluateAmbassadorOrderFraud(order.id).catch(() => undefined);

  const email = await dispatchPaidEmail(order);
  void sendGa4Purchase(orderToGa4Purchase(order)).catch(() => undefined);

  if (email.ok) {
    await markPaidEmailSent(order.id);
  } else if (email.error) {
    await prisma.paymentAttempt.updateMany({
      where: { merchantOid },
      data: {
        errorMessage: [stockError, `email:${email.error}`].filter(Boolean).join("; ")
      }
    });
  }

  return {
    ok: true as const,
    alreadyPaid: false,
    stockError,
    emailError: email.error
  };
}

export async function syncPaidFromPaytr(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true }
  });
  if (!order?.paytrMerchantOid) {
    return { ok: false as const, error: "missing_oid" };
  }
  if (order.paymentStatus === "success" && order.status === "paid") {
    const retry = await retryPaidEmailIfNeeded(order.id);
    return {
      ok: true as const,
      alreadyPaid: true,
      paymentStatus: "success" as const,
      emailError: retry.error
    };
  }

  const paytr = await queryPaytrOrderStatus(order.paytrMerchantOid);
  if (!paytr.ok) {
    await prisma.paymentAttempt.updateMany({
      where: { merchantOid: order.paytrMerchantOid },
      data: { errorMessage: paytr.error }
    });
    return { ok: false as const, error: paytr.error, paymentStatus: order.paymentStatus };
  }
  if (!paytrReportedAmountMatches(Number(order.totalTry), paytr.paymentAmount)) {
    await prisma.paymentAttempt.updateMany({
      where: { merchantOid: order.paytrMerchantOid },
      data: { errorMessage: "amount_mismatch" }
    });
    return { ok: false as const, error: "amount_mismatch", paymentStatus: order.paymentStatus };
  }

  const marked = await markOrderPaid(order.id, order.paytrMerchantOid);
  if (!marked.ok) {
    return { ok: false as const, error: marked.error };
  }
  return {
    ok: true as const,
    alreadyPaid: marked.alreadyPaid,
    paymentStatus: "success" as const,
    emailError: marked.emailError
  };
}

/** Build PayTR iframe token request payload helpers */
export function paytrTokenHash(parts: string[]): string {
  const key = process.env.PAYTR_MERCHANT_KEY!;
  const salt = process.env.PAYTR_MERCHANT_SALT!;
  const paytrToken = parts.join("") + salt;
  return createHash("sha256").update(paytrToken).digest("base64");
}
