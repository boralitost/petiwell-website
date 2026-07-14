"use client";

import Image from "next/image";
import { useState } from "react";
import { AnalyticsEvents, trackEvent } from "@/lib/analytics";

type Props = {
  images: string[];
  alt: string;
  promoLabel?: string;
  productId?: string;
  accent?: "orange" | "purple";
};

export function ProductGallery({
  images,
  alt,
  promoLabel,
  productId,
  accent = "orange"
}: Props) {
  const safeImages = images.filter(Boolean);
  const [active, setActive] = useState(0);
  const current = safeImages[active] ?? safeImages[0];
  const isOrange = accent === "orange";

  if (!current) return null;

  return (
    <div>
      <div className="relative aspect-[5/4] overflow-hidden bg-white">
        {promoLabel ? (
          <span
            className={`absolute left-2 top-2 z-10 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-semibold tracking-wide shadow-sm border ${
              isOrange
                ? "text-accent-action border-accent/25"
                : "text-brand border-brand/20"
            }`}
          >
            {promoLabel}
          </span>
        ) : null}
        <Image
          src={current}
          alt={alt}
          fill
          sizes="(min-width:1024px) 22vw, 100vw"
          className="object-contain"
          priority={active === 0}
        />
      </div>

      <div className="flex gap-1.5 overflow-x-auto border-t border-line px-2.5 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {safeImages.map((src, index) => (
          <button
            key={src}
            type="button"
            onClick={() => {
              setActive(index);
              trackEvent(AnalyticsEvents.interactProductGallery, {
                product_id: productId,
                image_index: index
              });
            }}
            aria-label={`${alt} ${index + 1}`}
            aria-pressed={active === index}
            className={`relative h-9 w-9 shrink-0 overflow-hidden rounded-md border bg-white transition ${
              active === index
                ? isOrange
                  ? "border-accent-action ring-1 ring-accent-action"
                  : "border-brand ring-1 ring-brand"
                : "border-line hover:border-[#d5cad2]"
            }`}
          >
            <Image
              src={src}
              alt=""
              fill
              sizes="36px"
              className="object-contain"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
