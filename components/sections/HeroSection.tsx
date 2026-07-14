import Image from "next/image";
import Link from "next/link";
import { Dictionary } from "@/lib/dictionary";
import { Locale } from "@/lib/i18n";

type Props = {
  locale: Locale;
  dict: Dictionary;
};

export function HeroSection({ locale, dict }: Props) {
  return (
    <section className="pt-0">
      <div className="relative overflow-hidden animate-fade-up-soft">
        <div className="relative min-h-[78vh] sm:min-h-[calc(100vh-120px)]">
          <Image
            src="/herosection.png"
            alt={dict.brand.name}
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-black/10" />
          <div className="absolute inset-0 hero-grain" />

          <div className="relative z-10 flex min-h-[78vh] sm:min-h-[calc(100vh-120px)] items-end justify-center px-5 sm:px-8 lg:px-10 pb-10 sm:pb-14 lg:pb-16">
            <div className="mx-auto max-w-3xl text-center text-white">
              <p className="mb-3 text-sm sm:text-base font-semibold tracking-[0.22em] uppercase text-white drop-shadow-md">
                {dict.brand.name}
              </p>
              <h1 className="text-[1.85rem] sm:text-[2.4rem] lg:text-[2.85rem] font-semibold tracking-tight text-white drop-shadow-md font-sans leading-tight">
                {dict.hero.title}
              </h1>
              <p className="mx-auto mt-3 max-w-2xl text-sm sm:text-base text-white/95 drop-shadow-sm">
                {dict.hero.subtitle}
              </p>
              <p className="mx-auto mt-2 max-w-xl text-xs sm:text-sm text-white/80">
                {dict.hero.promoNote}
              </p>

              <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                <Link
                  href={`/${locale}#products`}
                  className="inline-flex min-h-[46px] items-center justify-center rounded-full bg-accent-action px-8 py-3 text-sm sm:text-base font-semibold text-white shadow-lift transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-hover"
                >
                  {dict.hero.primaryCta}
                </Link>
                <Link
                  href={`/${locale}#how-to-use`}
                  className="inline-flex min-h-[46px] items-center justify-center rounded-full border border-white/70 bg-white/10 px-6 py-3 text-sm sm:text-base font-medium text-white backdrop-blur-sm transition-all duration-200 hover:bg-white/20"
                >
                  {dict.hero.secondaryCta}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
