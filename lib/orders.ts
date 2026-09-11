import { createHash, randomBytes } from "crypto";
import { Locale } from "@/lib/i18n";
import { quoteCart, QuoteLineInput } from "@/lib/pricing";
import { isCompanyInfoComplete, getCompanyInfo } from "@/lib/company";
import { isDirectSalesEnabled } from "@/lib/commerce";
import { prisma } from "@/lib/db";

export function generateOrderNumber(): string {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = randomBytes(3).toString("hex").toUpperCase();
  return `PW-${stamp}-${rand}`;
}

/** PayTR merchant_oid: alphanumeric, unique */
export function generateMerchantOid(): string {
  return `PW${Date.now()}${randomBytes(4).toString("hex")}`.slice(0, 64);
}

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
  locale?: Locale;
  items: QuoteLineInput[];
};

export async function createPendingOrder(input: CheckoutCustomerInput) {
  if (!isDirectSalesEnabled()) {
    return { ok: false as const, error: "sales_disabled" };
  }
  if (!isCompanyInfoComplete()) {
    return { ok: false as const, error: "company_incomplete" };
  }
  if (!input.distanceSalesAccepted || !input.preInfoAccepted) {
    return { ok: false as const, error: "legal_not_accepted" };
  }

  const locale = input.locale ?? "tr";
  const quote = await quoteCart(input.items, locale);
  if (!quote.ok) {
    return { ok: false as const, error: quote.error };
  }

  const orderNumber = generateOrderNumber();
  const merchantOid = generateMerchantOid();

  const order = await prisma.order.create({
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
      totalTry: quote.totals.totalTry,
      status: "pending_payment",
      paymentStatus: "pending",
      paytrMerchantOid: merchantOid,
      distanceSalesAccepted: true,
      preInfoAccepted: true,
      items: {
        create: quote.lines.map((line) => ({
          productId: line.productId,
          sku: line.sku,
          productName: line.name,
          unitPriceTry: line.unitPriceTry,
          quantity: line.quantity,
          lineTotalTry: line.lineTotalTry
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

  return {
    ok: true as const,
    order,
    quote,
    company: getCompanyInfo()
  };
}

export function paytrConfigReady(): boolean {
  return Boolean(
    process.env.PAYTR_MERCHANT_ID &&
      process.env.PAYTR_MERCHANT_KEY &&
      process.env.PAYTR_MERCHANT_SALT
  );
}

/** Build PayTR iframe token request payload helpers */
export function paytrTokenHash(parts: string[]): string {
  const key = process.env.PAYTR_MERCHANT_KEY!;
  const salt = process.env.PAYTR_MERCHANT_SALT!;
  const paytrToken = parts.join("") + salt;
  return createHash("sha256").update(paytrToken).digest("base64");
}
