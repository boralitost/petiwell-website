import type { Metadata } from "next";
import Link from "next/link";
import { Locale, isLocale } from "@/lib/i18n";

type Props = { params: { locale: string }; searchParams?: { oid?: string } };

export const metadata: Metadata = {
  title: "Sipariş alındı | Petiwell"
};

export default function CheckoutSuccessPage({ params, searchParams }: Props) {
  const locale = (isLocale(params.locale) ? params.locale : "tr") as Locale;
  const oid = searchParams?.oid;

  return (
    <section className="section-shell">
      <div className="mx-auto max-w-lg rounded-2xl border border-line bg-surface p-8 text-center shadow-soft">
        <h1 className="text-2xl font-semibold text-charcoal">Teşekkürler</h1>
        <p className="mt-3 text-sm text-muted">
          Ödeme sonucu PayTR tarafından doğrulanıyor. Onay e-postası
          başarılı ödemeden sonra gönderilir.
        </p>
        {oid ? (
          <p className="mt-4 text-sm font-medium text-charcoal">
            Sipariş no: {oid}
          </p>
        ) : null}
        <Link
          href={`/${locale}`}
          className="mt-6 inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white"
        >
          Ana sayfa
        </Link>
      </div>
    </section>
  );
}
