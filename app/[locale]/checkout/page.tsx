import type { Metadata } from "next";
import Link from "next/link";
import { Locale, isLocale } from "@/lib/i18n";
import { getDictionary } from "@/lib/dictionary";
import { isDirectSalesEnabled } from "@/lib/commerce";
import { CheckoutShell } from "@/components/cart/CheckoutShell";

type Props = { params: { locale: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = (isLocale(params.locale) ? params.locale : "tr") as Locale;
  const dict = getDictionary(locale);
  return { title: `${dict.cart.checkout} | Petiwell` };
}

export default function CheckoutPage({ params }: Props) {
  const locale = (isLocale(params.locale) ? params.locale : "tr") as Locale;
  const dict = getDictionary(locale);
  const enabled = isDirectSalesEnabled();

  if (!enabled) {
    return (
      <section className="section-shell">
        <div className="mx-auto max-w-xl rounded-2xl border border-line bg-surface p-6 sm:p-8 text-center shadow-soft">
          <h1 className="text-xl font-semibold text-charcoal">{dict.cart.title}</h1>
          <p className="mt-3 text-sm text-muted">{dict.cart.comingSoon}</p>
          <Link
            href={`/${locale}#products`}
            className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-full bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-deep"
          >
            {dict.nav.products}
          </Link>
        </div>
      </section>
    );
  }

  return <CheckoutShell locale={locale} dict={dict} />;
}
