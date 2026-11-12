import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./Cards.module.css";

/** Card/Stat: top hairline, 48px number, mono label. Static. Use inside a <dl>. */
export function CardStat({ value, label }: { value: string; label: string }) {
  return (
    <div className={styles.stat}>
      <dt className={`t-mono-label ${styles.statLabel}`}>{label}</dt>
      <dd className={`t-stat ${styles.statValue}`}>{value}</dd>
    </div>
  );
}

/** Card/Step: a step in a sequence (number, title, detail). Static. */
export function CardStep({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  return (
    <div className={styles.step}>
      <p className={`t-overline ${styles.stepNo}`}>{String(step).padStart(2, "0")}</p>
      <h3 className={`t-card ${styles.stepTitle}`}>{title}</h3>
      <p className={`t-mono-label ${styles.detail}`}>{children}</p>
    </div>
  );
}

/** Card/Way: the whole card is the link. Hover: surface fill and a stronger border. */
export function CardWay({ href, title, children, cta }: { href: string; title: string; children: ReactNode; cta: string }) {
  return (
    <Link href={href} className={styles.way}>
      <span className={`t-card ${styles.wayTitle}`}>{title}</span>
      <span className={`t-body-small ${styles.detail}`}>{children}</span>
      <span className={`t-button ${styles.wayCta}`}>{cta} →</span>
    </Link>
  );
}
