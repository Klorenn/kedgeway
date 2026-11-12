"use client";

import { useId, useState } from "react";
import styles from "./Faq.module.css";

/** Accordion: buttons with aria-expanded; each panel opens by animating grid rows (200ms). */
export default function Faq({ items }: { items: readonly (readonly [string, string])[] }) {
  const base = useId();
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className={styles.faq}>
      {items.map(([q, a], i) => {
        const isOpen = open === i;
        return (
          <div key={q} className={styles.item} data-open={isOpen}>
            <h3 style={{ margin: 0, font: "inherit" }}>
              <button type="button" className={styles.q} aria-expanded={isOpen} aria-controls={`${base}-${i}`} onClick={() => setOpen(isOpen ? null : i)}>
                <span>{q}</span>
                <span className={styles.mark} aria-hidden="true">{isOpen ? "\u2212" : "+"}</span>
              </button>
            </h3>
            <div id={`${base}-${i}`} role="region" aria-label={q} className={styles.panel}>
              <div className={styles.inner}>
                <p>{a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
