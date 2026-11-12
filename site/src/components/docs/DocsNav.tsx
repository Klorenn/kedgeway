"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import PixelIcon, { type PixelIconName } from "@/components/icons/pixel";
import { DOCS_GROUPS } from "@/data/docs-nav";

const GROUP_ICON: Record<string, PixelIconName> = { Start: "anchor", Use: "terminal", Reference: "file", More: "clock" };
import styles from "./DocsNav.module.css";

/** Left navigation: sticky on desktop, collapsible on mobile. */
export default function DocsNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <nav className={styles.nav} aria-label="Documentation">
      <button className={styles.toggle} type="button" aria-expanded={open} aria-controls="docs-panel" onClick={() => setOpen((o) => !o)}>
        <span>Docs menu</span>
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      <div id="docs-panel" className={styles.panel} data-open={open}>
        {DOCS_GROUPS.map((g) => (
          <div key={g.label} className={styles.group}>
            <p className={styles.label}>
              <PixelIcon name={GROUP_ICON[g.label] ?? "file"} size={16} />
              <span>{g.label}</span>
            </p>
            <ul className={styles.list}>
              {g.pages.map((p) => (
                <li key={p.href}>
                  <Link className={styles.link} href={p.href} aria-current={pathname === p.href ? "page" : undefined}>
                    {p.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
