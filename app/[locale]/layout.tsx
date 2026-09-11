import type { Metadata } from "next";
import { ReactNode } from "react";
import { isLocale, Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/dictionary";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CookieBanner } from "@/components/layout/CookieBanner";
import { CartProvider } from "@/components/cart/CartProvider";

type Props = {
  children: ReactNode;
  params: { locale: string };
};

export function generateStaticParams() {
  return [{ locale: "tr" }, { locale: "en" }];
}

export async function generateMetadata({
  params
}: Props): Promise<Metadata> {
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

export default function LocaleLayout({ children, params }: Props) {
  const locale = isLocale(params.locale) ? (params.locale as Locale) : "tr";
  const dict = getDictionary(locale);

  return (
    <CartProvider>
      <div className="min-h-screen flex flex-col">
        <Navbar locale={locale} />
        <main className="flex-1">{children}</main>
        <Footer locale={locale} />
        <CookieBanner locale={locale} dict={dict} />
      </div>
    </CartProvider>
  );
}
