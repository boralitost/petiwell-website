import type { Metadata } from "next";
import { Locale, isLocale } from "@/lib/i18n";
import { getDictionary } from "@/lib/dictionary";
import { getCompanyInfo } from "@/lib/company";

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
  const company = getCompanyInfo();

  return (
    <section className="section-shell">
      <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] items-start">
        <div>
          <h1 className="section-title">{dict.contact.title}</h1>
          <p className="section-subtitle">{dict.contact.subtitle}</p>

          <dl className="mt-8 space-y-5 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-[0.14em] text-brand font-semibold">
                {dict.contact.companyLabel}
              </dt>
              <dd className="mt-1 text-charcoal font-medium">{company.legalName}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.14em] text-brand font-semibold">
                {dict.contact.addressLabel}
              </dt>
              <dd className="mt-1 text-muted">
                {company.address}
                <br />
                {company.city}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.14em] text-brand font-semibold">
                {dict.contact.phoneLabel}
              </dt>
              <dd className="mt-1">
                <a
                  href={`tel:${company.phone.replace(/\s/g, "")}`}
                  className="text-charcoal font-medium hover:text-brand"
                >
                  {company.phone}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.14em] text-brand font-semibold">
                {dict.contact.emailLabel}
              </dt>
              <dd className="mt-1">
                <a
                  href={`mailto:${company.email}`}
                  className="text-charcoal font-medium underline-offset-4 hover:underline"
                >
                  {company.email}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.14em] text-brand font-semibold">
                {dict.contact.taxLabel}
              </dt>
              <dd className="mt-1 text-muted">
                {company.taxOffice} · VKN {company.taxNumber}
                {company.mersis ? (
                  <>
                    <br />
                    MERSİS {company.mersis}
                  </>
                ) : null}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-line bg-surface px-6 py-6 sm:px-7 sm:py-7 shadow-soft">
          <h2 className="text-sm sm:text-base font-semibold text-charcoal">
            {dict.contact.noteTitle}
          </h2>
          <p className="mt-3 text-sm text-muted">{dict.contact.noteBody}</p>
          <p className="mt-4 text-[11px] text-muted">{dict.contact.formDisclaimer}</p>
        </div>
      </div>
    </section>
  );
}
