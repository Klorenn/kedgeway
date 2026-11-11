import Link from "next/link";
import { DOCS_FLAT } from "@/data/docs-nav";
import styles from "./PrevNext.module.css";

/** Previous and next page links, in nav order. */
export default function PrevNext({ href }: { href: string }) {
  const i = DOCS_FLAT.findIndex((p) => p.href === href);
  const prev = i > 0 ? DOCS_FLAT[i - 1] : undefined;
  const next = i >= 0 ? DOCS_FLAT[i + 1] : undefined;
  return (
    <nav className={styles.pn} aria-label="Previous and next pages">
      {prev ? (
        <Link href={prev.href}>
          <span className={styles.dir}>Previous</span>
          <span className={styles.title}>{prev.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link className={styles.next} href={next.href}>
          <span className={styles.dir}>Next</span>
          <span className={styles.title}>{next.title}</span>
        </Link>
      ) : null}
    </nav>
  );
}
