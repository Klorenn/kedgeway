import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import { UI } from "@/content/ui";
import { fontClasses } from "@/lib/fonts";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";

/** <html> for one locale: lang, fonts, skip link, header, main, footer. Used by [locale]/layout and the root 404. */
export default function Shell({ locale, children }: { locale: Locale; children: ReactNode }) {
  const ui = UI[locale];
  return (
    <html lang={locale} className={fontClasses}>
      <body>
        <LocaleProvider locale={locale} ui={ui}>
          <a className="skip" href="#main">{ui.skip}</a>
          <SiteHeader />
          <main id="main" tabIndex={-1}>{children}</main>
          <SiteFooter locale={locale} />
        </LocaleProvider>
      </body>
    </html>
  );
}
