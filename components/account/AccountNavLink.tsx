import Link from "next/link";
import { Locale } from "@/lib/i18n";
import { Dictionary } from "@/lib/dictionary";
import { getCurrentUser } from "@/lib/account";

type Props = {
  locale: Locale;
  dict: Dictionary;
};

export async function AccountNavLink({ locale, dict }: Props) {
  const user = await getCurrentUser();
  return (
    <Link
      href={user ? `/${locale}/account` : `/${locale}/account/login`}
      className="text-muted hover:text-brand transition-colors font-medium"
    >
      {user ? dict.nav.account : dict.nav.login}
    </Link>
  );
}
