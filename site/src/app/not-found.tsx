import Link from "next/link";
import HatchGroup from "@/components/HatchGroup";
import { HORSE_STANDING } from "@/data/horse-hatch";
import styles from "./not-found.module.css";

export const metadata = { title: "Not found — kedgeway" };

export default function NotFound() {
  return (
    <div className={styles.wrap}>
      <div className={styles.col}>
        <svg width="320" height="190" viewBox="-6 6 160 95" role="img" aria-label="A horse standing still" style={{ display: "block" }}>
          <HatchGroup frame={0} rows={HORSE_STANDING} color="var(--ink)" trails={false} />
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
