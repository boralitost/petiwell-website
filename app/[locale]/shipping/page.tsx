import type { Metadata } from "next";
import { Locale, isLocale } from "@/lib/i18n";
import { getDictionary } from "@/lib/dictionary";
import { PolicyDocument } from "@/components/legal/PolicyDocument";

type Props = { params: { locale: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = (isLocale(params.locale) ? params.locale : "tr") as Locale;
  const dict = getDictionary(locale);
  return { title: `${dict.policies.shipping.title} | Petiwell` };
}

export default function ShippingPage({ params }: Props) {
  const locale = (isLocale(params.locale) ? params.locale : "tr") as Locale;
  const dict = getDictionary(locale);
  return <PolicyDocument doc={dict.policies.shipping} />;
}
