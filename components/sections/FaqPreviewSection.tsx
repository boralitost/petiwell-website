import Link from "next/link";
import { Dictionary } from "@/lib/dictionary";
import { Locale } from "@/lib/i18n";

type Props = {
  locale: Locale;
  dict: Dictionary;
};

export function FaqPreviewSection({ locale, dict }: Props) {
  const previewItems = dict.faq.items.slice(0, 4);

  return (
    <section className="bg-background">
      <div className="section-shell">
        <div className="rounded-2xl border border-line bg-surface px-6 py-6 sm:px-8 sm:py-8 shadow-soft">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="section-eyebrow">{dict.faq.eyebrow}</p>
              <h2 className="section-title">{dict.faq.title}</h2>
            </div>
            <Link
              href={`/${locale}/faq`}
              className="inline-flex min-h-[44px] items-center text-sm font-semibold text-brand underline-offset-4 hover:underline"
            >
              {dict.faq.viewAll}
            </Link>
          </div>
          <div className="mt-6 space-y-4">
            {previewItems.map((item) => (
              <div
                key={item.id}
                className="border-b border-line pb-4 last:border-b-0 last:pb-0"
              >
                <p className="text-sm font-medium text-charcoal">
                  {item.question}
                </p>
                <p className="mt-1.5 text-xs sm:text-sm text-muted">
                  {item.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
