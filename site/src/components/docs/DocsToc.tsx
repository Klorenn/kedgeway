"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./DocsToc.module.css";

interface Heading {
  id: string;
  text: string;
}

const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** "On this page": built from the article's h2s, with the current one in ink. Desktop only. */
export default function DocsToc() {
  const pathname = usePathname();
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [active, setActive] = useState("");

  useEffect(() => {
    const els = [...document.querySelectorAll<HTMLElement>("article h2")];
    const list = els.map((el) => {
      if (!el.id) el.id = slug(el.textContent ?? "");
      return { id: el.id, text: el.textContent ?? "" };
    });
    setHeadings(list);
    setActive(list[0]?.id ?? "");
    if (els.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-96px 0px -65% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);

  if (headings.length < 2) return <div className={styles.toc} aria-hidden="true" />;
  return (
    <nav className={styles.toc} aria-label="On this page">
      <p className={styles.label}>On this page</p>
      <ul className={styles.list}>
        {headings.map((h) => (
          <li key={h.id}>
            <a className={styles.link} href={`#${h.id}`} data-active={active === h.id}>
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
