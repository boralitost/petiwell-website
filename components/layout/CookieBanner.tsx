"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Dictionary } from "@/lib/dictionary";
import { Locale } from "@/lib/i18n";
import {
  applyConsent,
  readConsentChoice,
  type ConsentChoice
} from "@/lib/consent";

type Props = {
  locale: Locale;
  dict: Dictionary;
};

export function CookieBanner({ locale, dict }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!readConsentChoice());
  }, []);

  function choose(choice: ConsentChoice) {
    applyConsent(choice);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface/95 backdrop-blur-sm">
      <div className="container-page flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted max-w-2xl">{dict.cookiesBanner.message}</p>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Link
            href={`/${locale}/cookies`}
            className="text-sm font-medium text-brand hover:underline"
          >
            {dict.cookiesBanner.learnMore}
          </Link>
          <button
            type="button"
            className="inline-flex min-h-[40px] items-center rounded-full border border-line px-4 py-2 text-sm font-semibold text-charcoal hover:bg-brand-soft"
            onClick={() => choose("essential")}
          >
            {dict.cookiesBanner.essential}
          </button>
          <button
            type="button"
            className="inline-flex min-h-[40px] items-center rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-deep"
            onClick={() => choose("accepted")}
          >
            {dict.cookiesBanner.accept}
          </button>
        </div>
      </div>
    </div>
  );
}
