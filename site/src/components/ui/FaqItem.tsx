"use client";

import { useId, type ReactNode } from "react";
import styles from "./FaqItem.module.css";

interface FaqItemProps {
  question: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/** One FAQ row: heading > button[aria-expanded] controlling a region. The glyph flips - / +. */
export default function FaqItem({ question, open, onToggle, children }: FaqItemProps) {
  const id = useId();
  return (
    <div className={styles.item} data-open={open}>
      <h3 className={styles.h}>
        <button type="button" id={`${id}-q`} className={`${styles.q} t-body-medium`} aria-expanded={open} aria-controls={`${id}-a`} onClick={onToggle}>
          <span>{question}</span>
          <span className={styles.mark} aria-hidden="true">{open ? "−" : "+"}</span>
        </button>
      </h3>
      <div id={`${id}-a`} role="region" aria-labelledby={`${id}-q`} className={styles.panel} inert={!open}>
        <div className={styles.inner}>
          <div className={`t-body ${styles.answer}`}>{children}</div>
        </div>
      </div>
    </div>
  );
}
