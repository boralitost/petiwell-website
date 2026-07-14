import Link from "next/link";
import { Locale } from "@/lib/i18n";
import { getDictionary } from "@/lib/dictionary";

type Props = {
  locale: Locale;
};

const SOCIAL_LINKS = [
  {
    id: "instagram",
    href: "https://www.instagram.com/petiwelltr/",
    labelKey: "instagram" as const,
    icon: InstagramIcon
  },
  {
    id: "tiktok",
    href: "https://www.tiktok.com/@petiwell",
    labelKey: "tiktok" as const,
    icon: TikTokIcon
  },
  {
    id: "x",
    href: "https://x.com/petiwell",
    labelKey: "x" as const,
    icon: XIcon
  }
];

export function Footer({ locale }: Props) {
  const dict = getDictionary(locale);

  return (
    <footer className="border-t border-line bg-brand-soft/60 mt-0">
      <div className="section-shell py-8 sm:py-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-md">
          <p className="text-sm text-charcoal">{dict.footer.brandLine}</p>
          <p className="mt-2 text-xs text-muted">
            © {new Date().getFullYear()} Petiwell. {dict.footer.rights}
          </p>
          <ul className="mt-4 flex items-center gap-3">
            {SOCIAL_LINKS.map(({ id, href, labelKey, icon: Icon }) => (
              <li key={id}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={dict.footer.social[labelKey]}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-charcoal transition hover:border-brand/30 hover:text-brand"
                >
                  <Icon />
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap gap-4 text-xs sm:text-sm text-muted">
          <Link href={`/${locale}/faq`} className="hover:text-brand">
            {dict.footer.faq}
          </Link>
          <Link href={`/${locale}/contact`} className="hover:text-brand">
            {dict.footer.contact}
          </Link>
          <Link href={`/${locale}/about`} className="hover:text-brand">
            {dict.footer.about}
          </Link>
          <Link href={`/${locale}/legal`} className="hover:text-brand">
            {dict.footer.legal}
          </Link>
        </div>
      </div>
    </footer>
  );
}

function InstagramIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="currentColor"
    >
      <path d="M14.5 3c.4 2.3 1.9 4.1 4.2 4.5v2.3c-1.5-.1-2.9-.6-4.1-1.4v6.2c0 3.2-2.6 5.7-5.8 5.7S2.9 17.8 2.9 14.6c0-3 2.3-5.5 5.2-5.7v2.4c-1.4.2-2.4 1.4-2.4 2.9 0 1.6 1.3 2.9 2.9 2.9s2.9-1.3 2.9-2.9V3h3z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="currentColor"
    >
      <path d="M17.6 3H20l-6.3 7.2L21 21h-5.5l-4.3-5.6L6.3 21H4l6.7-7.7L3 3h5.6l3.9 5.2L17.6 3zm-1.9 16.2h1.5L8.4 4.7H6.8l8.9 14.5z" />
    </svg>
  );
}
