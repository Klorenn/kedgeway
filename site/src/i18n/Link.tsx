import NextLink from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "./config";
import { href } from "./href";

/** Internal link that stays in `locale`. `to` is the English path ("/docs/ci", "/docs/commands#init"). */
export function LocaleLink({ locale, to, children }: { locale: Locale; to: string; children: ReactNode }) {
  return <NextLink href={href(locale, to)}>{children}</NextLink>;
}

/** Bind a locale once per dictionary module: `const L = linkFor("es")` then `<L to="/docs/ci">CI</L>`. */
export function linkFor(locale: Locale) {
  return function L({ to, children }: { to: string; children: ReactNode }) {
    return <LocaleLink locale={locale} to={to}>{children}</LocaleLink>;
  };
}
