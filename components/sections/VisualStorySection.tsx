import Image from "next/image";
import { Dictionary } from "@/lib/dictionary";
import { Locale } from "@/lib/i18n";

type Props = {
  locale: Locale;
  dict: Dictionary;
};

export function VisualStorySection({ dict }: Props) {
  return (
    <section className="overflow-hidden py-0" aria-label={dict.visualStory.title}>
      <div className="relative min-h-[420px] sm:min-h-[560px] lg:min-h-[640px] animate-fade-up-soft">
        <Image
          src="/VisualStorySection-main.png"
          alt={dict.visualStory.title}
          fill
          sizes="100vw"
          className="object-cover"
          priority={false}
        />
      </div>
    </section>
  );
}
