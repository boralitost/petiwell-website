import type { Metadata } from "next";
import { Locale, isLocale } from "@/lib/i18n";
import { getConsumerPolicy } from "@/lib/legal-consumer";
import { PolicyDocument } from "@/components/legal/PolicyDocument";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const locale = (isLocale(params.locale) ? params.locale : "tr") as Locale;
  const doc = getConsumerPolicy(locale, "legal");
  return {
    title: `${doc.title} | Petiwell`,
    description: doc.intro
  };
}

export default async function LegalPage(props: Props) {
  const params = await props.params;
  const locale = (isLocale(params.locale) ? params.locale : "tr") as Locale;
  return <PolicyDocument doc={getConsumerPolicy(locale, "legal")} />;
}
