import Link from "next/link";
import Image from "next/image";
import { Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/dictionary";
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher";
import { PromoBanner } from "./PromoBanner";
import { CartNavLink } from "@/components/cart/CartNavLink";
import { AccountNavLink } from "@/components/account/AccountNavLink";

type Props = {
  locale: Locale;
};

export async function Navbar({ locale }: Props) {
  const dict = getDictionary(locale);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur-sm">
      <PromoBanner locale={locale} />
      <div className="px-3 sm:px-4 lg:px-6 py-3 sm:py-3.5 flex flex-col items-center gap-2.5 sm:gap-3">
        <div className="relative flex w-full items-center justify-center">
          <Link
            href={`/${locale}`}
            className="group"
            aria-label={dict.brand.name}
          >
            <div className="relative h-16 w-36 sm:h-20 sm:w-44 overflow-visible">
              <Image
                src="/logo.png"
                alt="Petiwell logo"
                fill
                sizes="176px"
                className="object-contain"
                priority
              />
            </div>
          </Link>
          <div className="absolute right-0 flex items-center gap-3 sm:gap-4">
            <CartNavLink locale={locale} label={dict.nav.cart} />
            <AccountNavLink locale={locale} dict={dict} />
            <LanguageSwitcher currentLocale={locale} />
          </div>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:gap-x-6 text-sm">
          <Link
            href={`/${locale}#products`}
            className="text-muted hover:text-brand transition-colors font-medium"
          >
            {dict.nav.products}
          </Link>
          <Link
            href={`/${locale}#how-to-use`}
            className="text-muted hover:text-brand transition-colors font-medium"
          >
            {dict.nav.howToUse}
          </Link>
          <Link
            href={`/${locale}/faq`}
            className="text-muted hover:text-brand transition-colors font-medium"
          >
            {dict.nav.faq}
          </Link>
          <Link
            href={`/${locale}/about`}
            className="text-muted hover:text-brand transition-colors font-medium"
          >
            {dict.nav.about}
          </Link>
        </nav>
      </div>
    </header>
  );
}
