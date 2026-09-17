import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Locale, isLocale } from "@/lib/i18n";
import { getDictionary } from "@/lib/dictionary";
import { getCurrentUser, listAccountOrders } from "@/lib/account";
import { AccountDashboard } from "@/components/account/AccountDashboard";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const locale = (isLocale(params.locale) ? params.locale : "tr") as Locale;
  const dict = getDictionary(locale);
  return { title: `${dict.account.title} | Petiwell` };
}

export default async function AccountPage(props: Props) {
  const params = await props.params;
  const locale = (isLocale(params.locale) ? params.locale : "tr") as Locale;
  const dict = getDictionary(locale);
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/account/login`);
  }
  const orders = await listAccountOrders(user.id);

  return (
    <section className="section-shell">
      <div className="mx-auto max-w-2xl">
        <AccountDashboard
          dict={dict}
          locale={locale}
          user={user}
          orders={orders}
        />
      </div>
    </section>
  );
}
