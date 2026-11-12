import Link from "next/link";
import HatchGroup from "@/components/HatchGroup";
import { STATIC_FRAME } from "@/lib/hatch";
import styles from "./not-found.module.css";

export const metadata = { title: "Not found — kedgeway" };

export default function NotFound() {
  return (
    <div className={styles.wrap}>
      <div className={styles.col}>
        <svg width="160" height="76" viewBox="-6 15 160 76" role="img" aria-label="A horse at full gallop" style={{ display: "block" }}>
          <HatchGroup frame={STATIC_FRAME} color="var(--ink)" trails={false} weight={1.6} />
        </svg>
        <h1>
          Drifted <em>off course.</em>
        </h1>
        <p className={styles.mono}>404 · nothing at this path</p>
        <Link className={styles.back} href="/">
          Back to kedgeway →
        </Link>
      </div>
    </div>
  );
}
