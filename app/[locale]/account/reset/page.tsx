import type { Metadata } from "next";
import Link from "next/link";
import { Locale, isLocale } from "@/lib/i18n";
import { getDictionary } from "@/lib/dictionary";
import { ForgotForm } from "@/components/account/ForgotForm";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const locale = (isLocale(params.locale) ? params.locale : "tr") as Locale;
  const dict = getDictionary(locale);
  return { title: `${dict.account.resetTitle} | Petiwell` };
}

export default async function ResetPage(props: Props) {
  const params = await props.params;
  const locale = (isLocale(params.locale) ? params.locale : "tr") as Locale;
  const dict = getDictionary(locale);

  return (
    <section className="section-shell">
      <div className="mx-auto max-w-md rounded-2xl border border-line bg-surface p-6 shadow-soft">
        <h1 className="section-title">{dict.account.resetTitle}</h1>
        <p className="mt-2 text-sm text-muted">{dict.account.forgotLead}</p>
        <div className="mt-6">
          <ForgotForm locale={locale} dict={dict} />
        </div>
        <Link
          href={`/${locale}/account/login`}
          className="mt-4 inline-block text-xs text-brand underline"
        >
          {dict.account.loginTitle}
        </Link>
      </div>
    </section>
  );
}
