import type { ReactNode } from "react";
import styles from "./Callout.module.css";

interface CalloutProps {
  kind?: "note" | "warning";
  children: ReactNode;
}

/** A note or warning: surface panel with a mono label. No icons (the only icons are X and GitHub). */
export default function Callout({ kind = "note", children }: CalloutProps) {
  return (
    <aside className={kind === "warning" ? `${styles.callout} ${styles.warning}` : styles.callout}>
      <p className={`t-overline ${styles.head}`}>{kind === "warning" ? "Warning" : "Note"}</p>
      <div className={styles.body}>{children}</div>
    </aside>
  );
}
