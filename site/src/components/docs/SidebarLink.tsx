import Link from "next/link";
import styles from "./SidebarLink.module.css";

/** Docs sidebar link. Active: ink with a 2px ink bar on the left, and aria-current="page". */
export default function SidebarLink({ href, children, current, onClick }: { href: string; children: string; current: boolean; onClick?: () => void }) {
  return (
    <Link className={styles.link} href={href} aria-current={current ? "page" : undefined} onClick={onClick}>
      {children}
    </Link>
  );
}
