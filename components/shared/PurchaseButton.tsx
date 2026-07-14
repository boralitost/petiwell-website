"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { AnalyticsEvents, trackEvent } from "@/lib/analytics";

type Variant = "primary" | "secondary" | "ghost" | "onDark";

type Props = {
  label: string;
  href: string;
  productId?: string;
  productName?: string;
  note?: string;
  unavailableNote?: string;
  variant?: Variant;
  fullWidth?: boolean;
  icon?: ReactNode;
  placement?: string;
  locale?: string;
  disabled?: boolean;
  external?: boolean;
};

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-accent-action text-white hover:bg-accent-hover border border-transparent shadow-lift focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-action",
  secondary:
    "bg-brand-soft text-brand hover:bg-[#ebe0ef] border border-line",
  ghost:
    "bg-transparent text-charcoal hover:bg-brand-soft/70 border border-transparent",
  onDark:
    "bg-accent-action text-white hover:bg-accent-hover border border-transparent shadow-lift"
};

export function PurchaseButton({
  label,
  href,
  productId,
  productName,
  note,
  unavailableNote,
  variant = "primary",
  fullWidth,
  icon,
  placement = "unknown",
  locale,
  disabled,
  external = true
}: Props) {
  const isDisabled = disabled || !href;
  const noteClass =
    variant === "onDark" ? "text-white/75" : "text-muted";

  const handleClick = () => {
    if (isDisabled) return;
    trackEvent(AnalyticsEvents.clickTrendyol, {
      product_id: productId,
      placement,
      locale,
      campaign_message_seen: true
    });
  };

  const base =
    "group inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold tracking-tight transition-all duration-200";

  if (isDisabled) {
    return (
      <div className={fullWidth ? "w-full" : ""}>
        <button
          type="button"
          disabled
          className={`${base} opacity-55 cursor-not-allowed ${variantClasses[variant]} ${
            fullWidth ? "w-full" : ""
          }`}
          aria-label={productName ? `${label} — ${productName}` : label}
        >
          <span>{label}</span>
        </button>
        {(unavailableNote || note) && (
          <p className={`mt-1.5 text-[11px] max-w-xs ${noteClass}`}>
            {unavailableNote || note}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={fullWidth ? "w-full" : ""}>
      <Link
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        onClick={handleClick}
        className={`${base} hover:-translate-y-0.5 ${variantClasses[variant]} ${
          fullWidth ? "w-full" : ""
        }`}
        aria-label={productName ? `${label} — ${productName}` : label}
      >
        <span>{label}</span>
        {external
          ? icon ?? (
              <span
                aria-hidden="true"
                className="text-xs transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              >
                ↗
              </span>
            )
          : null}
      </Link>
      {note && (
        <p className={`mt-1.5 text-[11px] max-w-xs ${noteClass}`}>{note}</p>
      )}
    </div>
  );
}
