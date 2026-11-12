"use client";

import type { ReactNode } from "react";
import { useLocale } from "@/i18n/LocaleProvider";
import styles from "./Callout.module.css";

interface CalloutProps {
  kind?: "note" | "warning";
  children: ReactNode;
}

/** A note or warning: surface panel with a mono label. No icons (the only icons are X and GitHub). */
export default function Callout({ kind = "note", children }: CalloutProps) {
  const { ui } = useLocale();
  return (
    <aside className={kind === "warning" ? `${styles.callout} ${styles.warning}` : styles.callout}>
      <p className={`t-overline ${styles.head}`}>{kind === "warning" ? ui.docs.warning : ui.docs.note}</p>
      <div className={styles.body}>{children}</div>
    </aside>
  );
}
