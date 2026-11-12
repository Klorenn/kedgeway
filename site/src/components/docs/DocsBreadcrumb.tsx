"use client";

import { DOCS_GROUPS } from "@/data/docs-nav";
import { useLocale, useLocalePath } from "@/i18n/LocaleProvider";

/** "Docs / Start / Getting started": the current page and the group it belongs to. */
export default function DocsBreadcrumb({ className }: { className?: string }) {
  const { ui } = useLocale();
  const path = useLocalePath();
  const t = ui.docs;
  for (const g of DOCS_GROUPS) {
    const page = g.pages.find((p) => p.href === path);
    if (page) return <p className={className}>{t.crumb} / {t.groups[g.id]} / {t.pages[page.id].title}</p>;
  }
  return <p className={className}>{t.crumb}</p>;
}
