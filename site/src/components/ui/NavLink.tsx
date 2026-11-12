import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./NavLink.module.css";

interface NavLinkProps {
  href: string;
  children: ReactNode;
  current?: boolean;
  onClick?: () => void;
  className?: string;
}

/** Text link for nav and footer columns: ink-2, ink on hover. Internal paths use next/link. */
export default function NavLink({ href, children, current, onClick, className }: NavLinkProps) {
  const cls = `${styles.link}${className ? ` ${className}` : ""}`;
  const aria = current ? ("page" as const) : undefined;
  return href.startsWith("/") ? (
    <Link className={cls} href={href} aria-current={aria} onClick={onClick} prefetch={href.startsWith("/#") ? false : undefined}>{children}</Link>
  ) : (
    <a className={cls} href={href} onClick={onClick}>{children}</a>
  );
}
