import { DOCS_FLAT } from "@/data/docs-nav";
import PagerLink from "./PagerLink";
import styles from "./PagerLink.module.css";

/** Previous and next page links, in nav order. */
export default function PrevNext({ href }: { href: string }) {
  const i = DOCS_FLAT.findIndex((p) => p.href === href);
  const prev = i > 0 ? DOCS_FLAT[i - 1] : undefined;
  const next = i >= 0 ? DOCS_FLAT[i + 1] : undefined;
  return (
    <nav className={styles.pager} aria-label="Previous and next pages">
      {prev ? <PagerLink direction="previous" href={prev.href} title={prev.title} /> : <span />}
      {next ? <PagerLink direction="next" href={next.href} title={next.title} /> : null}
    </nav>
  );
}
