import type { Metadata } from "next";
import Link from "next/link";
import { Locale, isLocale } from "@/lib/i18n";
import { getDictionary } from "@/lib/dictionary";
import {
  getShippingFlatTry,
  getShippingFreeOverTry,
  isDirectSalesEnabled
} from "@/lib/commerce";
import { getProducts } from "@/lib/product";
import { CheckoutShell } from "@/components/cart/CheckoutShell";
import { getCurrentUser } from "@/lib/account";
import { getCompanyInfo } from "@/lib/company";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const locale = (isLocale(params.locale) ? params.locale : "tr") as Locale;
  const dict = getDictionary(locale);
  return { title: `${dict.cart.checkout} | Petiwell` };
}

export default async function CheckoutPage(props: Props) {
  const params = await props.params;
  const locale = (isLocale(params.locale) ? params.locale : "tr") as Locale;
  const dict = getDictionary(locale);
  const enabled = isDirectSalesEnabled();
  const user = await getCurrentUser();

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

  const catalog = getProducts(locale).map((p) => ({
    id: p.id,
    shortName: p.shortName,
    priceTry: p.priceTry,
    sellable: p.sellableOnSite
  }));

  return (
    <CheckoutShell
      locale={locale}
      dict={dict}
      catalog={catalog}
      shippingFlatTry={getShippingFlatTry()}
      shippingFreeOverTry={getShippingFreeOverTry()}
      paytrTestMode={process.env.PAYTR_TEST_MODE !== "0"}
      seller={getCompanyInfo()}
      account={
        user
          ? {
              email: user.email,
              name: user.name || user.address?.fullName || "",
              phone: user.phone || user.address?.phone || "",
              shippingAddress: user.address?.address || "",
              city: user.address?.city || "",
              district: user.address?.district || "",
              postalCode: user.address?.postalCode || ""
            }
          : null
      }
    />
  );
}
