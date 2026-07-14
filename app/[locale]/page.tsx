import { Locale, isLocale } from "@/lib/i18n";
import { getDictionary } from "@/lib/dictionary";
import { getProducts } from "@/lib/product";
import { HeroSection } from "@/components/sections/HeroSection";
import { ProductsSection } from "@/components/sections/ProductsSection";
import { TrustSection } from "@/components/sections/TrustSection";
import { HowToUseSection } from "@/components/sections/HowToUseSection";
import { CampaignSection } from "@/components/sections/CampaignSection";
import { FaqPreviewSection } from "@/components/sections/FaqPreviewSection";
import { VisualStorySection } from "@/components/sections/VisualStorySection";

type Props = {
  params: { locale: string };
};

export default function HomePage({ params }: Props) {
  const locale = (isLocale(params.locale) ? params.locale : "tr") as Locale;
  const dict = getDictionary(locale);
  const products = getProducts(locale);

  return (
    <>
      <HeroSection locale={locale} dict={dict} />
      <ProductsSection locale={locale} dict={dict} products={products} />
      <TrustSection locale={locale} dict={dict} />
      <HowToUseSection locale={locale} dict={dict} products={products} />
      <CampaignSection locale={locale} dict={dict} />
      <VisualStorySection locale={locale} dict={dict} />
      <FaqPreviewSection locale={locale} dict={dict} />
    </>
  );
}
