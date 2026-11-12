"use client";

import { usePathname } from "next/navigation";
import { DOCS_FLAT, DOCS_GROUPS } from "@/data/docs-nav";
import SidebarLink from "./SidebarLink";
import SectionMenu from "./SectionMenu";
import styles from "./DocsNav.module.css";

function Groups({ pathname, idPrefix }: { pathname: string; idPrefix: string }) {
  return (
    <div className={styles.groups}>
      {DOCS_GROUPS.map((g) => (
        <div key={g.label} className={styles.group} role="group" aria-labelledby={`${idPrefix}-${g.label}`}>
          <p id={`${idPrefix}-${g.label}`} className={`t-overline ${styles.label}`}>{g.label}</p>
          <ul className={styles.list}>
            {g.pages.map((p) => (
              <li key={p.href}>
                <SidebarLink href={p.href} current={pathname === p.href}>{p.title}</SidebarLink>
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
  const pathname = usePathname();
  const current = DOCS_FLAT.find((p) => p.href === pathname)?.title ?? "Menu";
  return (
    <div className={styles.wrap}>
      <nav className={styles.mobile} aria-label="Documentation sections">
        <SectionMenu current={current}>
          <Groups pathname={pathname} idPrefix="m" />
        </SectionMenu>
      </nav>
      <nav className={styles.sidebar} aria-label="Documentation">
        <Groups pathname={pathname} idPrefix="d" />
      </nav>
    </div>
  );
}
