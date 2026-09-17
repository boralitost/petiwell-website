"use client";

import { useEffect } from "react";
import { useCart } from "@/components/cart/CartProvider";

/** PayTR ok_url means the customer finished the iframe — empty the cart. */
export function ClearCartOnSuccess() {
  const { clear } = useCart();
  useEffect(() => {
    clear();
  }, [clear]);
  return null;
}
