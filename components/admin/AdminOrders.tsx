"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type OrderRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  status: string;
  paymentStatus: string;
  totalTry: { toString(): string } | number | string;
  trackingNumber: string | null;
  createdAt: string | Date;
  items: { productName: string; quantity: number }[];
};

export function AdminOrders({ orders }: { orders: OrderRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function updateOrder(
    id: string,
    patch: { status?: string; trackingNumber?: string }
  ) {
    setBusyId(id);
    await fetch("/api/admin/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch })
    });
    setBusyId(null);
    router.refresh();
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Siparişler</h1>
        <button
          type="button"
          onClick={logout}
          className="text-sm text-neutral-600 hover:underline"
        >
          Çıkış
        </button>
      </div>

      <div className="mt-8 space-y-4">
        {orders.length === 0 ? (
          <p className="text-sm text-neutral-600">Henüz sipariş yok.</p>
        ) : (
          orders.map((order) => (
            <article
              key={order.id}
              className="rounded-2xl border border-neutral-200 bg-white p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{order.orderNumber}</p>
                  <p className="text-sm text-neutral-600">
                    {order.customerName} · {order.customerEmail} ·{" "}
                    {order.customerPhone}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {order.items
                      .map((i) => `${i.productName} ×${i.quantity}`)
                      .join(", ")}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-semibold">{String(order.totalTry)} TL</p>
                  <p>
                    {order.status} / {order.paymentStatus}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {["preparing", "shipped", "delivered", "cancelled"].map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={busyId === order.id}
                    onClick={() => updateOrder(order.id, { status: s })}
                    className="rounded-full border border-neutral-200 px-3 py-1 text-xs hover:bg-neutral-50"
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  defaultValue={order.trackingNumber ?? ""}
                  placeholder="Kargo takip no"
                  className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                  id={`track-${order.id}`}
                />
                <button
                  type="button"
                  className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold text-white"
                  onClick={() => {
                    const el = document.getElementById(
                      `track-${order.id}`
                    ) as HTMLInputElement | null;
                    updateOrder(order.id, {
                      trackingNumber: el?.value || "",
                      status: "shipped"
                    });
                  }}
                >
                  Kargoya ver
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
