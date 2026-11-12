"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import styles from "./SectionMenu.module.css";

/** Docs mobile disclosure (Figma 33:6816): hint ("In this section") + current page, expands to every group. Escape closes it. */
export default function SectionMenu({ current, hint, children }: { current: string; hint: string; children: ReactNode }) {
  const id = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className={styles.menu} data-open={open} onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}>
      <button type="button" className={styles.toggle} aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <span className={styles.text}>
          <span className={`t-overline ${styles.hint}`}>{hint}</span>
          <span className={`t-body-medium ${styles.current}`}>{current}</span>
        </span>
        <span className={`t-mono-label ${styles.glyph}`} aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      <div id={id} className={styles.panel} hidden={!open}>{children}</div>
    </div>
  );
}
