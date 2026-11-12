import type { Metadata } from "next";
import { LOCALES, OG_LOCALE, type Locale } from "@/i18n/config";
import { href } from "@/i18n/href";

export const SITE = "https://kedgeway.vercel.app";

/** Shared social image: the exported 1200x630 Open Graph card (English text), reused by every page. */
export const OG_IMAGE = { url: "/og.png", width: 1200, height: 630 } as const;

/** canonical + hreflang alternates for one logical (English) path. x-default points at English. */
export function alternates(locale: Locale, path: string): NonNullable<Metadata["alternates"]> {
  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[l] = href(l, path);
  languages["x-default"] = href("en", path);
  return { canonical: href(locale, path), languages };
}

interface PageMetaInput {
  locale: Locale;
  /** English (unprefixed) path of the page, e.g. "/docs/mcp". */
  path: string;
  title: string;
  description: string;
  /** Social title and description, when they differ from the page's (the landing page). */
  ogTitle?: string;
  ogDescription?: string;
  /** Alt text of og.png in this locale. */
  ogAlt: string;
}

/** Metadata for any page: own title and description, canonical + languages, og.png for Open Graph and Twitter. */
export function pageMeta({ locale, path, title, description, ogTitle, ogDescription, ogAlt }: PageMetaInput): Metadata {
  const socialTitle = ogTitle ?? title;
  const socialDescription = ogDescription ?? description;
  return {
    title,
    description,
    alternates: alternates(locale, path),
    openGraph: {
      type: "website",
      siteName: "kedgeway",
      locale: OG_LOCALE[locale],
      alternateLocale: LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
      title: socialTitle,
      description: socialDescription,
      url: href(locale, path),
      images: [{ ...OG_IMAGE, alt: ogAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description: socialDescription,
      images: [{ url: OG_IMAGE.url, alt: ogAlt }],
    },
  };
}
