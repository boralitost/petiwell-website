"use client";

import Link from "next/link";
import { Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/dictionary";
import { useEffect, useState } from "react";
import { AnalyticsEvents, trackEvent } from "@/lib/analytics";

type Props = {
  locale: Locale;
};

export function PromoBanner({ locale }: Props) {
  const dict = getDictionary(locale);
  const messages = dict.promo.messages;
  const [index, setIndex] = useState(0);
  const isCampaign = messages[index]?.includes("1 TL") || messages[index]?.includes("1TL");

  useEffect(() => {
    if (messages.length <= 1) return;
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % messages.length);
    }, 4000);
    return () => clearInterval(id);
  }, [messages.length]);

  return (
    <div className="relative flex items-center justify-center gap-2 bg-brand px-10 sm:px-12 py-2">
      <button
        type="button"
        onClick={() =>
          setIndex((prev) => (prev - 1 + messages.length) % messages.length)
        }
        aria-label={dict.promo.prev}
        className="absolute left-2 sm:left-3 inline-flex h-9 w-9 items-center justify-center text-[20px] font-bold text-white/80 hover:text-white transition-colors"
      >
        ‹
      </button>
      <Link
        href={`/${locale}#${dict.campaign.id}`}
        onClick={() =>
          trackEvent(AnalyticsEvents.openCampaignDetails, {
            locale,
            source: "promo_banner"
          })
        }
        className="max-w-[78%] truncate text-center text-[12px] sm:text-[14px] font-semibold tracking-[0.12em] sm:tracking-[0.16em] uppercase text-white hover:text-accent-soft transition-colors"
      >
        {isCampaign ? (
          <span className="inline-flex items-center gap-2">
            <span className="hidden sm:inline-block h-1.5 w-1.5 rounded-full bg-accent" />
            {messages[index]}
          </span>
        ) : (
          messages[index]
        )}
      </Link>
      <button
        type="button"
        onClick={() => setIndex((prev) => (prev + 1) % messages.length)}
        aria-label={dict.promo.next}
        className="absolute right-2 sm:right-3 inline-flex h-9 w-9 items-center justify-center text-[20px] font-bold text-white/80 hover:text-white transition-colors"
      >
        ›
      </button>
    </div>
  );
}
