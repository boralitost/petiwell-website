"use client";

import { useState } from "react";
import Image from "next/image";
import { Dictionary } from "@/lib/dictionary";
import { Locale } from "@/lib/i18n";
import { LocalizedProduct } from "@/lib/product";
import { AnalyticsEvents, trackEvent } from "@/lib/analytics";

type Props = {
  locale: Locale;
  dict: Dictionary;
  products: LocalizedProduct[];
};

export function HowToUseSection({ locale, dict, products }: Props) {
  const [activeId, setActiveId] = useState(products[0]?.id ?? "plus-b");
  const active = products.find((p) => p.id === activeId) ?? products[0];

  if (!active) return null;

  const isOrange = active.accent === "orange";

  return (
    <section
      id="how-to-use"
      className="scroll-mt-36 overflow-hidden bg-brand-soft py-14 sm:py-16 lg:py-20"
    >
      <div className="section-shell !py-0">
        <div className="mx-auto max-w-2xl text-center">
          <p className="section-eyebrow">{dict.howToUse.eyebrow}</p>
          <h2 className="section-title">{dict.howToUse.title}</h2>
          <p className="section-subtitle mx-auto">{dict.howToUse.subtitle}</p>
        </div>

        <div className="mx-auto mt-8 flex max-w-md rounded-full border border-line bg-surface p-1 shadow-lift">
          {products.map((product) => {
            const activeTab = activeId === product.id;
            const orange = product.accent === "orange";
            return (
              <button
                key={product.id}
                type="button"
                onClick={() => {
                  setActiveId(product.id);
                  trackEvent(AnalyticsEvents.viewHowToUse, {
                    product_id: product.id,
                    locale
                  });
                }}
                className={`flex-1 rounded-full px-3 py-2.5 text-sm font-semibold transition ${
                  activeTab
                    ? orange
                      ? "bg-accent-action text-white"
                      : "bg-brand text-white"
                    : "text-charcoal hover:bg-background"
                }`}
              >
                {product.shortName}
              </button>
            );
          })}
        </div>

        <div className="mt-8 grid items-stretch gap-6 lg:grid-cols-2">
          <div className="relative min-h-[280px] overflow-hidden rounded-2xl border border-line bg-surface sm:min-h-[360px]">
            <Image
              src={
                active.images[Math.min(4, active.images.length - 1)] ??
                active.image
              }
              alt={active.name}
              fill
              sizes="(min-width:1024px) 45vw, 100vw"
              className="object-contain p-4"
            />
          </div>

          <div className="flex flex-col justify-center rounded-2xl border border-line bg-surface p-6 sm:p-8 shadow-soft">
            <p className="section-eyebrow">{active.category}</p>
            <h3 className="text-xl font-semibold text-charcoal">
              {active.shortName}
            </h3>
            <div className="mt-6 space-y-5">
              {active.usageSteps.map((step, index) => (
                <div key={step.id} className="flex gap-3">
                  <div
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${
                      isOrange ? "bg-accent-action" : "bg-brand"
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div>
                    <h4 className="text-sm sm:text-base font-medium text-charcoal">
                      {step.title}
                    </h4>
                    <p className="mt-1 text-xs sm:text-sm text-muted">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-7 rounded-xl border border-line bg-background p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">
                {dict.howToUse.tipTitle}
              </p>
              <p className="mt-1.5 text-sm text-muted">{dict.howToUse.tipText}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
