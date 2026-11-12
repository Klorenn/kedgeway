"use client";

import { DOCS_FLAT, DOCS_GROUPS } from "@/data/docs-nav";
import { href } from "@/i18n/href";
import { useLocale, useLocalePath } from "@/i18n/LocaleProvider";
import SidebarLink from "./SidebarLink";
import SectionMenu from "./SectionMenu";
import styles from "./DocsNav.module.css";

function Groups({ path, idPrefix }: { path: string; idPrefix: string }) {
  const { locale, ui } = useLocale();
  return (
    <div className={styles.groups}>
      {DOCS_GROUPS.map((g) => (
        <div key={g.id} className={styles.group} role="group" aria-labelledby={`${idPrefix}-${g.id}`}>
          <p id={`${idPrefix}-${g.id}`} className={`t-overline ${styles.label}`}>{ui.docs.groups[g.id]}</p>
          <ul className={styles.list}>
            {g.pages.map((p) => (
              <li key={p.id}>
                <SidebarLink href={href(locale, p.href)} current={path === p.href}>{ui.docs.pages[p.id].title}</SidebarLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Docs navigation: sticky sidebar on desktop (>=1024), Section menu disclosure below. */
export default function DocsNav() {
  const { ui } = useLocale();
  const path = useLocalePath();
  const page = DOCS_FLAT.find((p) => p.href === path);
  const current = page ? ui.docs.pages[page.id].title : ui.docs.menu;
  return (
    <div className={styles.wrap}>
      <nav className={styles.mobile} aria-label={ui.docs.navMobile}>
        <SectionMenu current={current} hint={ui.docs.inThisSection}>
          <Groups path={path} idPrefix="m" />
        </SectionMenu>
      </nav>
      <nav className={styles.sidebar} aria-label={ui.docs.nav}>
        <Groups path={path} idPrefix="d" />
      </nav>
    </div>
  );
}
