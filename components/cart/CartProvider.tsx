"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { ProductId } from "@/lib/product";

export type CartItem = {
  productId: ProductId;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  addItem: (productId: ProductId, quantity?: number) => void;
  setQuantity: (productId: ProductId, quantity: number) => void;
  removeItem: (productId: ProductId) => void;
  clear: () => void;
  count: number;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "petiwell_cart_v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartItem[];
        if (Array.isArray(parsed)) setItems(parsed);
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items, hydrated]);

  const addItem = useCallback((productId: ProductId, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === productId);
      if (existing) {
        return prev.map((i) =>
          i.productId === productId
            ? { ...i, quantity: Math.min(i.quantity + quantity, 20) }
            : i
        );
      }
      return [...prev, { productId, quantity: Math.min(quantity, 20) }];
    });
  }, []);

  const setQuantity = useCallback((productId: ProductId, quantity: number) => {
    const q = Math.floor(quantity);
    if (q < 1) {
      setItems((prev) => prev.filter((i) => i.productId !== productId));
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i.productId === productId ? { ...i, quantity: Math.min(q, 20) } : i
      )
    );
  }, []);

  const removeItem = useCallback((productId: ProductId) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const count = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items]
  );

  const value = useMemo(
    () => ({ items, addItem, setQuantity, removeItem, clear, count }),
    [items, addItem, setQuantity, removeItem, clear, count]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
