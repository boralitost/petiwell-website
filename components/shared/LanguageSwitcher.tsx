"use client";

import { usePathname, useRouter } from "next/navigation";
import { Locale, locales } from "@/lib/i18n";

type Props = {
  currentLocale: Locale;
};

export function LanguageSwitcher({ currentLocale }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const handleSwitch = (locale: Locale) => {
    if (!pathname) return;
    const segments = pathname.split("/");
    segments[1] = locale;
    const target = segments.join("/") || `/${locale}`;
    router.push(target);
  };

  return (
    <div className="inline-flex items-center rounded-full border border-line bg-surface px-1 py-0.5 text-xs">
      {locales.map((locale) => {
        const active = locale === currentLocale;
        return (
          <button
            key={locale}
            type="button"
            onClick={() => handleSwitch(locale)}
            className={`px-2.5 py-1 rounded-full transition-colors ${
              active
                ? "bg-brand text-white"
                : "text-muted hover:text-charcoal"
            }`}
            aria-pressed={active}
          >
            {locale.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
