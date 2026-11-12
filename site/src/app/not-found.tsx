import Link from "next/link";
import Gallop from "@/components/Gallop";
import styles from "./not-found.module.css";

export const metadata = { title: "Not found — kedgeway" };

export default function NotFound() {
  return (
    <div className={styles.wrap}>
      <div className={styles.col}>
        <Gallop size={240} startFrame={5} animate={false} />
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
