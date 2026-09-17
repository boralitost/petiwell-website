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
    title: dict.meta.faq.title,
    description: dict.meta.faq.description
  };
}

export default async function FaqPage(props: Props) {
  const params = await props.params;
  const locale = (isLocale(params.locale) ? params.locale : "tr") as Locale;
  const dict = getDictionary(locale);

  return (
    <section className="section-shell">
      <div className="max-w-3xl">
        <p className="section-eyebrow">{dict.faq.eyebrow}</p>
        <h1 className="section-title">{dict.faq.title}</h1>
        <div className="mt-6 space-y-4">
          {dict.faq.items.map((item) => (
            <details
              key={item.id}
              className="group rounded-2xl border border-line bg-surface px-4 py-3 sm:px-5 sm:py-4"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <span className="text-sm sm:text-base font-medium text-charcoal">
                  {item.question}
                </span>
                <span
                  aria-hidden="true"
                  className="text-xs text-neutral-500 group-open:rotate-45 transition-transform"
                >
                  +
                </span>
              </summary>
              <p className="mt-2.5 text-xs sm:text-sm text-neutral-700">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

