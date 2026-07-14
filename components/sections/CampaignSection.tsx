"use client";

import Link from "next/link";
import { Dictionary } from "@/lib/dictionary";
import { Locale } from "@/lib/i18n";
import { AnalyticsEvents, trackEvent } from "@/lib/analytics";

type Props = {
  locale: Locale;
  dict: Dictionary;
};

export function CampaignSection({ locale, dict }: Props) {
  return (
    <section
      id={dict.campaign.id}
      className="scroll-mt-36 overflow-hidden bg-surface py-14 sm:py-16 border-y border-line"
    >
      <div className="section-shell !py-0">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center rounded-full bg-accent-soft px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-action border border-accent/20">
            {dict.campaign.eyebrow}
          </span>
          <h2 className="mt-4 section-title text-brand">{dict.campaign.title}</h2>
          <p className="section-subtitle mx-auto">{dict.campaign.subtitle}</p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {dict.campaign.steps.map((step, index) => (
            <div
              key={step.id}
              className="rounded-xl border border-line bg-background p-5"
            >
              <p className="text-xs font-semibold text-accent-action">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-2 text-base font-semibold text-charcoal">
                {step.title}
              </h3>
              <p className="mt-2 text-sm text-muted">{step.description}</p>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-6 max-w-3xl text-center text-xs text-muted">
          {dict.campaign.footnote}
        </p>

        <div className="mt-7 flex justify-center">
          <Link
            href={`/${locale}#products`}
            onClick={() =>
              trackEvent(AnalyticsEvents.openCampaignDetails, { locale })
            }
            className="inline-flex min-h-[46px] items-center justify-center rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-brand-deep"
          >
            {dict.campaign.cta}
          </Link>
        </div>
      </div>
    </section>
  );
}
