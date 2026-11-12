import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UI } from "@/content/ui";
import type { PageMetaDict } from "@/content/schema/common";
import { pageMeta } from "@/lib/seo";
import { isLocale, type Locale } from "./config";

/** Resolve the [locale] param of a page; anything but "en" / "es" is a 404. */
export async function localeOf(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}

/** generateMetadata body for a page: localized title/description + canonical, hreflang and OG locale. */
export async function metaFor(params: Promise<{ locale: string }>, path: string, map: Record<Locale, { meta: PageMetaDict }>): Promise<Metadata> {
  const locale = await localeOf(params);
  const { title, description } = map[locale].meta;
  return pageMeta({ locale, path, title, description, ogAlt: UI[locale].ogAlt });
}
