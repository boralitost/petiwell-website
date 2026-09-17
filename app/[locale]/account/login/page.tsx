import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Locale, isLocale } from "@/lib/i18n";
import { getDictionary } from "@/lib/dictionary";
import { getCurrentUser } from "@/lib/account";
import { LoginForm } from "@/components/account/LoginForm";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const locale = (isLocale(params.locale) ? params.locale : "tr") as Locale;
  const dict = getDictionary(locale);
  return { title: `${dict.account.loginTitle} | Petiwell` };
}

export default async function AccountLoginPage(props: Props) {
  const params = await props.params;
  const locale = (isLocale(params.locale) ? params.locale : "tr") as Locale;
  const dict = getDictionary(locale);
  const user = await getCurrentUser();
  if (user) {
    redirect(`/${locale}/account`);
  }

  return (
    <section className="section-shell">
      <div className="mx-auto max-w-md rounded-2xl border border-line bg-surface p-6 shadow-soft">
        <h1 className="section-title">{dict.account.loginTitle}</h1>
        <div className="mt-6">
          <LoginForm locale={locale} dict={dict} />
        </div>
        <p className="mt-4 text-xs text-muted">{dict.account.guestNote}</p>
        <Link
          href={`/${locale}/checkout`}
          className="mt-2 inline-block text-xs text-brand underline"
        >
          {dict.cart.checkout}
        </Link>
      </div>
    </section>
  );
}
