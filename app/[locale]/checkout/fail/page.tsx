import type { Metadata } from "next";
import Link from "next/link";
import { Locale, isLocale } from "@/lib/i18n";

type Props = { params: Promise<{ locale: string }>; searchParams?: Promise<{ oid?: string }> };

export const metadata: Metadata = {
  title: "Ödeme başarısız | Petiwell"
};

export default async function CheckoutFailPage(props: Props) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const locale = (isLocale(params.locale) ? params.locale : "tr") as Locale;

  return (
    <section className="section-shell">
      <div className="mx-auto max-w-lg rounded-2xl border border-line bg-surface p-8 text-center shadow-soft">
        <h1 className="text-2xl font-semibold text-charcoal">Ödeme tamamlanamadı</h1>
        <p className="mt-3 text-sm text-muted">
          Kart işlemi başarısız oldu veya iptal edildi. Tekrar deneyebilirsiniz.
        </p>
        {searchParams?.oid ? (
          <p className="mt-4 text-sm text-muted">Referans: {searchParams.oid}</p>
        ) : null}
        <Link
          href={`/${locale}/checkout`}
          className="mt-6 inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white"
        >
          Sepete dön
        </Link>
      </div>
    </section>
  );
}
