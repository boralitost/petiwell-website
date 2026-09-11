"use client";

import Link from "next/link";
import { Locale } from "@/lib/i18n";
import { useCart } from "@/components/cart/CartProvider";

type Props = {
  locale: Locale;
  label: string;
};

export function CartNavLink({ locale, label }: Props) {
  const { count } = useCart();

  return (
    <Link
      href={`/${locale}/checkout`}
      className="text-muted hover:text-brand transition-colors font-medium"
    >
      {label}
      {count > 0 ? (
        <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-action px-1.5 text-[10px] font-semibold text-white">
          {count}
        </span>
      ) : null}
    </Link>
  );
}
