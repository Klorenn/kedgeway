/** Supported locales. English is the default and lives at unprefixed URLs; Spanish lives under /es. */
export const LOCALES = ["en", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const isLocale = (v: string): v is Locale => (LOCALES as readonly string[]).includes(v);

/** Open Graph locale codes. Spanish targets Latin America (es_419). */
export const OG_LOCALE: Record<Locale, string> = { en: "en_US", es: "es_419" };

/** Pick the value for a locale from a complete map (a missing locale is a type error). */
export const byLocale = <T,>(locale: Locale, map: Record<Locale, T>): T => map[locale];

/** The other locale, for the header toggle. */
export const otherLocale = (locale: Locale): Locale => (locale === "en" ? "es" : "en");
