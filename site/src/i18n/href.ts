import { DEFAULT_LOCALE, LOCALES, type Locale } from "./config";

/**
 * Locale-aware internal URL. `path` is the English (unprefixed) path, optionally with a hash: "/", "/docs/mcp",
 * "/#install", "/docs/commands#init". English stays unprefixed; Spanish gets "/es". External URLs and bare
 * hashes ("#headless") pass through untouched.
 */
export function href(locale: Locale, path: string): string {
  if (!path.startsWith("/") || locale === DEFAULT_LOCALE) return path;
  const i = path.indexOf("#");
  const pathname = i === -1 ? path : path.slice(0, i);
  const hash = i === -1 ? "" : path.slice(i);
  return `/${locale}${pathname === "/" ? "" : pathname}${hash}`;
}

/** Strip a locale prefix from a pathname: "/es/docs" -> "/docs", "/en" -> "/", "/docs" -> "/docs". */
export function stripLocale(pathname: string): string {
  for (const l of LOCALES) {
    if (pathname === `/${l}`) return "/";
    if (pathname.startsWith(`/${l}/`)) return pathname.slice(l.length + 1);
  }
  return pathname || "/";
}
