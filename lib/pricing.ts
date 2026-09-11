import { calcShippingTry, OrderTotals, PricedLine } from "@/lib/commerce";
import { getCatalogProduct } from "@/lib/product";
import { getStock } from "@/lib/inventory";
import { Locale } from "@/lib/i18n";

export type QuoteLineInput = {
  productId: string;
  quantity: number;
};

export type QuoteResult = {
  ok: true;
  lines: PricedLine[];
  totals: OrderTotals;
} | {
  ok: false;
  error: string;
};

/**
 * Recalculate cart totals from server catalog prices + live inventory.
 * Never trust client-sent unit prices or totals.
 */
export async function quoteCart(
  items: QuoteLineInput[],
  locale: Locale = "tr"
): Promise<QuoteResult> {
  if (!items.length) {
    return { ok: false, error: "empty_cart" };
  }

  const lines: PricedLine[] = [];

  for (const item of items) {
    const qty = Math.floor(Number(item.quantity));
    if (!Number.isFinite(qty) || qty < 1) {
      return { ok: false, error: "invalid_quantity" };
    }

    const product = getCatalogProduct(item.productId);
    if (!product) {
      return { ok: false, error: "product_not_found" };
    }
    if (product.priceTry <= 0) {
      return { ok: false, error: "product_not_priced" };
    }

    const stock = await getStock(item.productId);
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

  const subtotalTry =
    Math.round(lines.reduce((sum, line) => sum + line.lineTotalTry, 0) * 100) /
    100;
  const shippingTry = calcShippingTry(subtotalTry);
  const totalTry = Math.round((subtotalTry + shippingTry) * 100) / 100;

  return {
    ok: true,
    lines,
    totals: { subtotalTry, shippingTry, totalTry }
  };
}
