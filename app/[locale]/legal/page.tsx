import type { Metadata } from "next";
import { Locale, isLocale } from "@/lib/i18n";
import { getDictionary } from "@/lib/dictionary";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const locale = (isLocale(params.locale) ? params.locale : "tr") as Locale;
  const dict = getDictionary(locale);

  return {
    title: dict.meta.legal.title,
    description: dict.meta.legal.description
  };
}

export default async function LegalPage(props: Props) {
  const params = await props.params;
  const locale = (isLocale(params.locale) ? params.locale : "tr") as Locale;
  const dict = getDictionary(locale);

  return (
    <section className="section-shell">
      <div className="max-w-3xl space-y-8 text-sm text-neutral-700">
        <div>
          <h1 className="section-title">{dict.legal.title}</h1>
        </div>
        {dict.legal.sections.map((section) => (
          <div key={section.id} className="space-y-2">
            <h2 className="text-base font-semibold text-charcoal">
              {section.title}
            </h2>
            <p>{section.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
