import {
  calcShippingTry,
  isSecondProductCampaignEnabled,
  OrderTotals,
  PricedLine
} from "@/lib/commerce";
import { getCatalogProduct } from "@/lib/product";
import { getStock } from "@/lib/inventory";
import { Locale } from "@/lib/i18n";
import {
  applyPromoToTotals,
  findPromoDefinition,
  normalizePromoCode,
  parsePromoCatalog
} from "@/lib/promo";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { ambassadorConfig } from "@/lib/ambassador-config";
import { priceAmbassadorCart, roundTry } from "@/lib/ambassador-pricing";
import { validReferralAttribution } from "@/lib/ambassador-referral";

export type QuoteLineInput = {
  productId: string;
  quantity: number;
};

export type QuoteResult = {
  ok: true;
  lines: PricedLine[];
  totals: OrderTotals;
  ambassador: {
    id: string;
    couponId: string | null;
    referralId: string | null;
    attributionType: "MANUAL_COUPON" | "REFERRAL";
    attributionSource: string;
    commissionRate: number;
    customerDiscountRate: number;
    commissionTry: number;
  } | null;
} | {
  ok: false;
  error: string;
};

export async function syncPromoCatalog() {
  const catalog = parsePromoCatalog(process.env.PROMO_CODES);
  for (const promo of catalog) {
    await prisma.promoCode.upsert({
      where: { code: promo.code },
      create: {
        code: promo.code,
        type: promo.type,
        value: promo.value,
        maxUses: promo.maxUses,
        active: true
      },
      update: {
        type: promo.type,
        value: promo.value,
        maxUses: promo.maxUses,
        active: true
      }
    });
  }
  return catalog;
}

/**
 * Recalculate cart totals from server catalog prices + live inventory.
 * Never trust client-sent unit prices or totals.
 */
export async function quoteCart(
  items: QuoteLineInput[],
  locale: Locale = "tr",
  promoCode?: string,
  ambassadorReferralId?: string | null
): Promise<QuoteResult> {
  if (!items.length) {
    return { ok: false, error: "empty_cart" };
  }

  const lines: PricedLine[] = [];
  const mergedItems = new Map<string, number>();
  for (const item of items) {
    const qty = Math.floor(Number(item.quantity));
    if (!Number.isFinite(qty) || qty < 1) {
      return { ok: false, error: "invalid_quantity" };
    }
    mergedItems.set(item.productId, (mergedItems.get(item.productId) || 0) + qty);
  }

  for (const [productId, qty] of mergedItems) {
    const product = getCatalogProduct(productId);
    if (!product) {
      return { ok: false, error: "product_not_found" };
    }
    if (product.priceTry <= 0) {
      return { ok: false, error: "product_not_priced" };
    }

    const stock = await getStock(productId);
    if (stock < qty) {
      return { ok: false, error: "insufficient_stock" };
    }

    const unit = product.priceTry;
    lines.push({
      productId: product.id,
      sku: product.sku,
      name: product.name[locale],
      unitPriceTry: unit,
      quantity: qty,
      lineTotalTry: Math.round(unit * qty * 100) / 100
    });
  }

  const requested = (promoCode || "").trim();
  const normalizedRequested = normalizePromoCode(requested);
  let ambassadorCoupon: Prisma.AmbassadorCouponGetPayload<{
    include: { ambassador: true };
  }> | null = null;
  if (normalizedRequested) {
    ambassadorCoupon = await prisma.ambassadorCoupon.findUnique({
      where: { code: normalizedRequested },
      include: { ambassador: true }
    });
    if (
      !ambassadorCoupon?.active ||
      !ambassadorCoupon.ambassador ||
      ![
        "ACTIVE_PENDING_SHIPMENT",
        "ACTIVE_PENDING_FIRST_CONTENT",
        "ACTIVE"
      ].includes(ambassadorCoupon.ambassador.status)
    ) {
      ambassadorCoupon = null;
    }
  }
  const referral = ambassadorCoupon
    ? null
    : await validReferralAttribution(ambassadorReferralId || null);
  const attributedAmbassador =
    ambassadorCoupon?.ambassador || referral?.ambassador || null;
  const config = ambassadorConfig();
  const automaticCampaign =
    isSecondProductCampaignEnabled();

  let generalPromo: ReturnType<typeof findPromoDefinition> = null;
  if (requested && !ambassadorCoupon) {
    const catalog = await syncPromoCatalog();
    const promo = findPromoDefinition(catalog, requested);
    if (!promo) {
      return { ok: false, error: "promo_invalid" };
    }
    if (referral) {
      return { ok: false, error: "promo_not_stackable" };
    }
    const row = await prisma.promoCode.findUnique({
      where: { code: promo.code }
    });
    if (!row || !row.active || row.usedCount >= row.maxUses) {
      return { ok: false, error: "promo_exhausted" };
    }
    generalPromo = promo;
  }

  const ambassadorPricing = priceAmbassadorCart({
    lines,
    applySecondProductCampaign: automaticCampaign,
    customerDiscountRate: attributedAmbassador
      ? Number(attributedAmbassador.customerDiscountRate)
      : 0,
    commissionRate: attributedAmbassador
      ? Number(attributedAmbassador.commissionRate)
      : 0,
    vatRate: config.vatRate
  });
  const pricedById = new Map(
    ambassadorPricing.lines.map((line) => [line.productId, line])
  );
  const pricedLines = lines.map((line) => {
    const discounts = pricedById.get(line.productId);
    return {
      ...line,
      campaignDiscountTry: discounts?.campaignDiscountTry || 0,
      ambassadorDiscountTry: discounts?.ambassadorDiscountTry || 0,
      finalProductTotalTry:
        discounts?.finalProductTotalTry ?? line.lineTotalTry,
      vatRateSnapshot: config.vatRate,
      netProductTry:
        discounts?.netProductTry ??
        roundTry(line.lineTotalTry / (1 + config.vatRate / 100))
    };
  });

  const subtotalTry = ambassadorPricing.grossProductTry;
  const shippingTry = calcShippingTry(ambassadorPricing.finalProductTry);
  let generalDiscountTry = 0;
  let totalTry = roundTry(ambassadorPricing.finalProductTry + shippingTry);
  let appliedCode: string | null = ambassadorCoupon?.code || null;
  if (generalPromo) {
    const applied = applyPromoToTotals(
      ambassadorPricing.finalProductTry,
      shippingTry,
      generalPromo
    );
    if (!applied.ok) {
      return { ok: false, error: applied.error };
    }
    generalDiscountTry = applied.discountTry;
    totalTry = applied.totalTry;
    appliedCode = generalPromo.code;
  }
  const discountTry = roundTry(
    ambassadorPricing.campaignDiscountTry +
      ambassadorPricing.ambassadorDiscountTry +
      generalDiscountTry
  );

  return {
    ok: true,
    lines: pricedLines,
    totals: {
      subtotalTry,
      shippingTry,
      discountTry,
      totalTry,
      promoCode: appliedCode,
      campaignDiscountTry: ambassadorPricing.campaignDiscountTry,
      ambassadorDiscountTry: ambassadorPricing.ambassadorDiscountTry,
      productTotalAfterDiscountTry: ambassadorPricing.finalProductTry,
      productNetExVatTry: ambassadorPricing.netProductTry,
      vatRateSnapshot: config.vatRate,
      ambassadorPublicId: attributedAmbassador?.publicId || null,
      attributionType: ambassadorCoupon
        ? "MANUAL_COUPON"
        : referral
          ? "REFERRAL"
          : "NONE",
      customerDiscountRateSnapshot: attributedAmbassador
        ? Number(attributedAmbassador.customerDiscountRate)
        : 0,
      commissionRateSnapshot: attributedAmbassador
        ? Number(attributedAmbassador.commissionRate)
        : 0
    },
    ambassador: attributedAmbassador
      ? {
          id: attributedAmbassador.id,
          couponId: ambassadorCoupon?.id || null,
          referralId: referral?.id || null,
          attributionType: ambassadorCoupon ? "MANUAL_COUPON" : "REFERRAL",
          attributionSource: ambassadorCoupon
            ? ambassadorCoupon.code
            : referral?.source || "referral",
          commissionRate: Number(attributedAmbassador.commissionRate),
          customerDiscountRate: Number(
            attributedAmbassador.customerDiscountRate
          ),
          commissionTry: ambassadorPricing.commissionTry
        }
      : null
  };
}
