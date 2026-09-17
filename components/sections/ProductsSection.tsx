"use client";

import { useEffect, useRef } from "react";
import { Dictionary } from "@/lib/dictionary";
import { Locale } from "@/lib/i18n";
import { LocalizedProduct } from "@/lib/product";
import { ProductGallery } from "@/components/shared/ProductGallery";
import { AddToCartButton } from "@/components/cart/AddToCartButton";
import { AnalyticsEvents, trackEvent } from "@/lib/analytics";

type Props = {
  locale: Locale;
  dict: Dictionary;
  products: LocalizedProduct[];
};

export function ProductsSection({ locale, dict, products }: Props) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    trackEvent(AnalyticsEvents.viewProductSection, { locale });
  }, [locale]);

  return (
    <section
      id="products"
      className="scroll-mt-36 overflow-hidden bg-surface py-14 sm:py-16 lg:py-20"
    >
      <div className="section-shell !py-0">
        <div className="mx-auto max-w-2xl text-center">
          <p className="section-eyebrow">{dict.products.eyebrow}</p>
          <h2 className="section-title">{dict.products.title}</h2>
          <p className="section-subtitle mx-auto">{dict.products.subtitle}</p>
          <p className="mt-3 text-sm font-semibold text-brand">
            {dict.products.promoNote}
          </p>
          <p className="mt-1 text-xs text-muted">{dict.products.promoDisclaimer}</p>
        </div>

        <div className="mx-auto mt-8 grid max-w-4xl gap-4 lg:grid-cols-2 lg:gap-5 lg:items-stretch">
          {products.map((product, index) => {
            const isOrange = product.accent === "orange";
            return (
              <article
                key={product.id}
                id={product.id}
                className="animate-fade-up-soft scroll-mt-40 flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-soft"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <ProductGallery
                  images={product.images}
                  alt={product.name}
                  promoLabel={
                    product.campaignEligible ? product.promoLabel : undefined
                  }
                  productId={product.id}
                  accent={product.accent}
                />

                <div className="flex flex-1 flex-col gap-2.5 p-3.5 sm:p-4">
                  <div>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                        isOrange
                          ? "bg-accent-soft text-accent-action border border-accent/20"
                          : "bg-brand-soft text-brand border border-brand/15"
                      }`}
                    >
                      {product.category}
                    </span>
                    <h3 className="mt-1.5 text-base sm:text-lg font-semibold tracking-tight text-charcoal">
                      {product.shortName}
                    </h3>
                    <p className="mt-0.5 text-xs font-medium text-muted">
                      {product.format}
                    </p>
                    <p className="mt-1.5 text-sm font-medium text-charcoal">
                      {product.positioning}
                    </p>
                    <p className="mt-1 text-xs sm:text-sm text-muted leading-snug">
                      {product.shortDescription}
                    </p>
                  </div>

                  <ul className="space-y-1 text-xs sm:text-sm text-charcoal">
                    {product.highlights.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span
                          aria-hidden="true"
                          className={`mt-0.5 text-[9px] ${
                            isOrange ? "text-accent-action" : "text-brand"
                          }`}
                        >
                          ●
                        </span>
                        <span className="leading-snug">{item}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto space-y-1.5 border-t border-line pt-3">
                    {product.priceTry > 0 ? (
                      <p className="text-sm font-semibold text-charcoal">
                        {new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-TR", {
                          style: "currency",
                          currency: "TRY"
                        }).format(product.priceTry)}
                      </p>
                    ) : (
                      <p className="text-xs font-medium text-charcoal">
                        {dict.products.priceHint}
                      </p>
                    )}
                    <AddToCartButton
                      productId={product.id}
                      label={dict.cart.add}
                      disabled={!product.sellableOnSite}
                      itemName={product.shortName}
                      priceTry={product.priceTry}
                      sku={product.sku}
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-line bg-surface px-6 py-6 text-center sm:px-8 sm:py-7 shadow-lift">
          <h3 className="text-base sm:text-lg font-semibold text-charcoal">
            {dict.products.complementaryTitle}
          </h3>
          <p className="mt-2 text-sm text-muted">
            {dict.products.complementaryBody}
          </p>
          <p className="mt-3 text-xs font-medium text-brand">
            {dict.products.complementaryNote}
          </p>
        </div>
      </div>
    </section>
  );
}
