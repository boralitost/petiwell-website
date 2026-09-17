import type { Metadata } from "next";
import { ReactNode, Suspense } from "react";
import { isLocale, Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/dictionary";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CookieBanner } from "@/components/layout/CookieBanner";
import { CartProvider } from "@/components/cart/CartProvider";
import { ReferralCapture } from "@/components/ambassador/ReferralCapture";

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return [{ locale: "tr" }, { locale: "en" }];
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const locale = isLocale(params.locale) ? (params.locale as Locale) : "tr";
  const dict = getDictionary(locale);

  return {
    title: dict.meta.home.title,
    description: dict.meta.home.description,
    alternates: {
      languages: {
        tr: "/tr",
        en: "/en"
      }
    }
  };
}

export default async function LocaleLayout(props: Props) {
  const params = await props.params;

  const {
    children
  } = props;

  const locale = isLocale(params.locale) ? (params.locale as Locale) : "tr";
  const dict = getDictionary(locale);

  return (
    <CartProvider>
      <Suspense fallback={null}>
        <ReferralCapture />
      </Suspense>
      <div className="min-h-screen flex flex-col">
        <Navbar locale={locale} />
        <main className="flex-1">{children}</main>
        <Footer locale={locale} />
        <CookieBanner locale={locale} dict={dict} />
      </div>
    </CartProvider>
  );
}
