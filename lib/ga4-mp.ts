import { isGa4Id } from "@/lib/tracking-ids";

type PurchaseItem = {
  item_id: string;
  item_name: string;
  price: number;
  quantity: number;
};

export function orderToGa4Purchase(order: {
  id: string;
  orderNumber: string;
  totalTry: { toString(): string } | number | string;
  currency?: string | null;
  items: {
    sku: string;
    productId: string;
    productName: string;
    unitPriceTry: { toString(): string } | number | string;
    quantity: number;
  }[];
}) {
  return {
    clientId: `server.${order.id}`,
    transactionId: order.orderNumber,
    value: Number(order.totalTry),
    currency: order.currency || "TRY",
    items: order.items.map((item) => ({
      item_id: item.sku || item.productId,
      item_name: item.productName,
      price: Number(item.unitPriceTry),
      quantity: item.quantity
    }))
  };
}

export function buildGa4PurchaseBody(input: {
  clientId: string;
  transactionId: string;
  value: number;
  currency?: string;
  items?: PurchaseItem[];
}) {
  return {
    client_id: input.clientId,
    events: [
      {
        name: "purchase",
        params: {
          transaction_id: input.transactionId,
          value: input.value,
          currency: input.currency || "TRY",
          engagement_time_msec: 1,
          items: input.items || []
        }
      }
    ]
  };
}

export async function sendGa4Purchase(input: {
  clientId: string;
  transactionId: string;
  value: number;
  currency?: string;
  items?: PurchaseItem[];
}) {
  const measurementId = (process.env.NEXT_PUBLIC_GA4_ID || "").trim();
  const apiSecret = (process.env.GA4_API_SECRET || "").trim();
  if (!isGa4Id(measurementId) || !apiSecret) return { ok: false as const, skipped: true };
  if (!input.transactionId || !Number.isFinite(input.value)) {
    return { ok: false as const, skipped: true };
  }

  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(
    measurementId
  )}&api_secret=${encodeURIComponent(apiSecret)}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildGa4PurchaseBody(input)),
      cache: "no-store"
    });
    return { ok: res.ok, skipped: false as const };
  } catch {
    return { ok: false as const, skipped: false as const };
  }
}
