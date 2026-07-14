import Image from "next/image";
import Link from "next/link";
import { Dictionary } from "@/lib/dictionary";
import { Locale } from "@/lib/i18n";

type Props = {
  locale: Locale;
  dict: Dictionary;
};

export function TrustSection({ locale, dict }: Props) {
  return (
    <section
      id="why-petiwell"
      className="scroll-mt-36 overflow-hidden bg-[#6A457F] py-14 sm:py-16 lg:py-20"
    >
      <div className="section-shell !py-0">
        <div className="grid items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="relative min-h-[280px] overflow-hidden rounded-2xl sm:min-h-[360px]">
            <Image
              src="/BenefitsSection.png"
              alt={dict.brand.name}
              fill
              sizes="(min-width:1024px) 40vw, 100vw"
              className="object-cover"
            />
          </div>

          <div>
            <p className="section-eyebrow-inverse">{dict.trust.eyebrow}</p>
            <h2 className="section-title-inverse">{dict.trust.title}</h2>
            <p className="section-subtitle-inverse">{dict.trust.subtitle}</p>

            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {dict.trust.items.map((item) => (
                <div key={item.id} className="space-y-2">
                  <div className="h-1 w-8 rounded-full bg-accent" />
                  <h3 className="text-sm sm:text-base font-semibold text-white">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-white/75 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <Link
                href={`/${locale}#products`}
                className="inline-flex min-h-[46px] items-center justify-center rounded-full bg-accent-action px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-accent-hover"
              >
                {dict.trust.cta}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
