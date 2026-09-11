"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type InventoryRow = {
  productId: string;
  sku: string;
  stock: number;
  name: string;
  priceTry: number;
};

export function AdminInventory({ inventory }: { inventory: InventoryRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(inventory);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function save(productId: string, stock: number) {
    setBusy(productId);
    setError("");
    const res = await fetch("/api/admin/inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, stock })
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok || !data.ok) {
      setError("Stok güncellenemedi.");
      return;
    }
    setRows((prev) =>
      prev.map((r) => (r.productId === productId ? { ...r, stock } : r))
    );
    router.refresh();
  }

  return (
    <section className="mt-12">
      <h2 className="text-xl font-semibold">Stok</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Canlı stok `ProductInventory` tablosundan gelir. Fiyatlar env / katalog.
      </p>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <ul className="mt-4 space-y-3">
        {rows.map((row) => (
          <li
            key={row.productId}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-4"
          >
            <div>
              <p className="font-medium">{row.name}</p>
              <p className="text-xs text-neutral-500">
                {row.sku}
                {row.priceTry > 0 ? ` · ${row.priceTry} TL` : " · fiyat yok"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor={`stock-${row.productId}`}>
                Stok
              </label>
              <input
                id={`stock-${row.productId}`}
                type="number"
                min={0}
                className="w-24 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                value={row.stock}
                onChange={(e) => {
                  const next = Math.max(0, Math.floor(Number(e.target.value) || 0));
                  setRows((prev) =>
                    prev.map((r) =>
                      r.productId === row.productId ? { ...r, stock: next } : r
                    )
                  );
                }}
              />
              <button
                type="button"
                disabled={busy === row.productId}
                onClick={() => save(row.productId, row.stock)}
                className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                Kaydet
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
