import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Shell from "@/components/Shell";
import { LOCALES, OG_LOCALE, isLocale } from "@/i18n/config";
import { UI } from "@/content/ui";
import { OG_IMAGE } from "@/lib/seo";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

// Defaults for every page in the locale; each page sets its own title, description, canonical and languages.
export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const ui = UI[locale];
  return {
    description: ui.siteDescription,
    openGraph: { type: "website", siteName: "kedgeway", locale: OG_LOCALE[locale], images: [{ ...OG_IMAGE, alt: ui.ogAlt }] },
    twitter: { card: "summary_large_image", images: [{ url: OG_IMAGE.url, alt: ui.ogAlt }] },
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <Shell locale={locale}>{children}</Shell>;
}
