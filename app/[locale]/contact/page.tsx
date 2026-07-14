import type { Metadata } from "next";
import { Locale, isLocale } from "@/lib/i18n";
import { getDictionary } from "@/lib/dictionary";

type Props = {
  params: { locale: string };
};

export async function generateMetadata({
  params
}: Props): Promise<Metadata> {
  const locale = (isLocale(params.locale) ? params.locale : "tr") as Locale;
  const dict = getDictionary(locale);

  return {
    title: dict.meta.contact.title,
    description: dict.meta.contact.description
  };
}

export default function ContactPage({ params }: Props) {
  const locale = (isLocale(params.locale) ? params.locale : "tr") as Locale;
  const dict = getDictionary(locale);

  return (
    <section className="section-shell">
      <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] items-start">
        <div>
          <h1 className="section-title">{dict.contact.title}</h1>
          <p className="section-subtitle">{dict.contact.subtitle}</p>

          <div className="mt-6 rounded-2xl bg-brand-soft border border-line px-5 py-4">
            <p className="text-xs uppercase tracking-[0.18em] text-brand">
              {dict.contact.emailLabel}
            </p>
            <a
              href={`mailto:${dict.contact.emailValue}`}
              className="mt-1 block text-sm sm:text-base font-medium text-charcoal underline-offset-4 hover:underline"
            >
              {dict.contact.emailValue}
            </a>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface px-6 py-6 sm:px-7 sm:py-7 shadow-soft">
          <h2 className="text-sm sm:text-base font-semibold text-charcoal">
            {dict.contact.noteTitle}
          </h2>
          <p className="mt-3 text-sm text-neutral-700">{dict.contact.noteBody}</p>
          <p className="mt-4 text-[11px] text-neutral-500">
            {dict.contact.formDisclaimer}
          </p>
        </div>
      </div>
    </section>
  );
}
