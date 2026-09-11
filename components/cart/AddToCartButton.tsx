"use client";

import { useState } from "react";
import { ProductId } from "@/lib/product";
import { useCart } from "@/components/cart/CartProvider";
import { isDirectSalesEnabled } from "@/lib/commerce";

type Props = {
  productId: ProductId;
  label: string;
  disabled?: boolean;
};

export function AddToCartButton({ productId, label, disabled }: Props) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const enabled = isDirectSalesEnabled();

  if (!enabled) return null;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        addItem(productId, 1);
        setAdded(true);
        window.setTimeout(() => setAdded(false), 1600);
      }}
      className="inline-flex min-h-[46px] w-full items-center justify-center rounded-full border border-brand bg-brand-soft px-5 py-2.5 text-sm font-semibold text-brand transition hover:bg-[#ebe0ef] disabled:opacity-50"
    >
      {added ? "✓" : label}
    </button>
  );
}
