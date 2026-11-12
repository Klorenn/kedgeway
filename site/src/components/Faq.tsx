"use client";

import { useState } from "react";
import FaqItem from "./ui/FaqItem";
import styles from "./Faq.module.css";

/** FAQ list. One row open at a time; the first starts expanded. */
export default function Faq({ items, defaultOpen = 0 }: { items: readonly (readonly [string, string])[]; defaultOpen?: number | null }) {
  const [open, setOpen] = useState<number | null>(defaultOpen);
  return (
    <div className={styles.faq}>
      {items.map(([q, a], i) => (
        <FaqItem key={q} question={q} open={open === i} onToggle={() => setOpen(open === i ? null : i)}>
          <p>{a}</p>
        </FaqItem>
      ))}
    </div>
  );
}
