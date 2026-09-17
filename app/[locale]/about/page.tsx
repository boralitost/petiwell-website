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
    title: dict.meta.about.title,
    description: dict.meta.about.description
  };
}

export default async function AboutPage(props: Props) {
  const params = await props.params;
  const locale = (isLocale(params.locale) ? params.locale : "tr") as Locale;
  const dict = getDictionary(locale);

  return (
    <section className="section-shell">
      <div className="max-w-3xl space-y-5 text-sm sm:text-base text-neutral-700">
        <div>
          <p className="section-eyebrow">{dict.brand.name}</p>
          <h1 className="section-title">{dict.about.title}</h1>
          <p className="section-subtitle">{dict.brand.tagline}</p>
        </div>
        {dict.about.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </section>
  );
}
