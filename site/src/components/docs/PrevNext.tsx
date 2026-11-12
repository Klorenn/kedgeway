"use client";

import { DOCS_FLAT } from "@/data/docs-nav";
import { href as localeHref } from "@/i18n/href";
import { useLocale } from "@/i18n/LocaleProvider";
import PagerLink from "./PagerLink";
import styles from "./PagerLink.module.css";

/** Previous and next page links, in nav order, in the current locale. `href` is the page's English path. */
export default function PrevNext({ href }: { href: string }) {
  const { locale, ui } = useLocale();
  const i = DOCS_FLAT.findIndex((p) => p.href === href);
  const prev = i > 0 ? DOCS_FLAT[i - 1] : undefined;
  const next = i >= 0 ? DOCS_FLAT[i + 1] : undefined;
  return (
    <nav className={styles.pager} aria-label={ui.docs.pager}>
      {prev ? <PagerLink direction="previous" label={ui.docs.previous} href={localeHref(locale, prev.href)} title={ui.docs.pages[prev.id].title} /> : <span />}
      {next ? <PagerLink direction="next" label={ui.docs.next} href={localeHref(locale, next.href)} title={ui.docs.pages[next.id].title} /> : null}
    </nav>
  );
}
