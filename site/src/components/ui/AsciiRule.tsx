import type { ElementType } from "react";
import styles from "./AsciiRule.module.css";

interface AsciiRuleProps {
  /** Section overline, e.g. "02 — How it works". Rendered uppercase. */
  label: string;
  /** Heading element for the label. Default h2 (REDESIGN section 8); use "p" when the section's own heading is the h2. */
  as?: "h2" | "h3" | "p";
  id?: string;
}

const DASHES = "-".repeat(400);

/**
 * `+-- LABEL ----------- kedgeway --+` across the content width. The label is real text; every dash and corner is
 * aria-hidden. A flexible middle run of dashes is clipped, so the rule fits any width (mobile ends with a single `+`).
 */
export default function AsciiRule({ label, as = "h2", id }: AsciiRuleProps) {
  const Label = as as ElementType;
  return (
    <div className={`${styles.rule} t-ascii-table`}>
      <span aria-hidden="true">+-- </span>
      <Label id={id} className={styles.label}>{label}</Label>
      <span aria-hidden="true">&nbsp;</span>
      <span className={styles.dashes} aria-hidden="true">{DASHES}</span>
      <span className={styles.brand} aria-hidden="true">&nbsp;kedgeway --+</span>
      <span className={styles.endMobile} aria-hidden="true">+</span>
    </div>
  );
}
