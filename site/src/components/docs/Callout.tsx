import type { ReactNode } from "react";
import PixelIcon from "@/components/icons/pixel";
import styles from "./Callout.module.css";

interface CalloutProps {
  kind?: "note" | "warning";
  children: ReactNode;
}

/** A note or warning: 2px left rule, pixel icon and a mono label. */
export default function Callout({ kind = "note", children }: CalloutProps) {
  return (
    <aside className={kind === "warning" ? `${styles.callout} ${styles.warning}` : styles.callout}>
      <div className={styles.head}>
        <PixelIcon name={kind === "warning" ? "warning" : "file"} size={16} />
        <span>{kind === "warning" ? "Warning" : "Note"}</span>
      </div>
      <div className={styles.body}>{children}</div>
    </aside>
  );
}
