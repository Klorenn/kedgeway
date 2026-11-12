import Link from "next/link";
import styles from "./PagerLink.module.css";

/** Pager link (Figma 33:6748): overline "Previous" / "Next" over the page title with its arrow. Hover shows the surface. */
export default function PagerLink({ direction, href, title }: { direction: "previous" | "next"; href: string; title: string }) {
  const next = direction === "next";
  return (
    <Link className={`${styles.link} ${next ? styles.next : ""}`} href={href} rel={next ? "next" : "prev"}>
      <span className={`t-overline ${styles.dir}`}>{next ? "Next" : "Previous"}</span>
      <span className={`t-card ${styles.title}`}>{next ? `${title} →` : `← ${title}`}</span>
    </Link>
  );
}
