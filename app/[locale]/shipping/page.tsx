import type { Metadata } from "next";
import { Locale, isLocale } from "@/lib/i18n";
import { getDictionary } from "@/lib/dictionary";
import { PolicyDocument } from "@/components/legal/PolicyDocument";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const locale = (isLocale(params.locale) ? params.locale : "tr") as Locale;
  const dict = getDictionary(locale);
  return { title: `${dict.policies.shipping.title} | Petiwell` };
}

export default async function ShippingPage(props: Props) {
  const params = await props.params;
  const locale = (isLocale(params.locale) ? params.locale : "tr") as Locale;
  const dict = getDictionary(locale);
  return <PolicyDocument doc={dict.policies.shipping} />;
}
