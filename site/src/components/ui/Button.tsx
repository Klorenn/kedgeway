import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "link";

interface CommonProps {
  variant?: ButtonVariant;
  children: ReactNode;
  className?: string;
}
type AsLink = CommonProps & { href: string } & { external?: boolean };
type AsButton = CommonProps & { href?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

/** Primary (accent fill), Secondary (rule border) or Link (accent text). One Primary per view. Sentence case labels. */
export default function Button(props: AsLink | AsButton) {
  const { variant = "primary", children, className } = props;
  const cls = `${styles.btn} ${styles[variant]} t-button${className ? ` ${className}` : ""}`;
  if (props.href !== undefined) {
    const { href, external } = props as AsLink;
    return href.startsWith("/") && !external ? (
      <Link className={cls} href={href}>{children}</Link>
    ) : (
      <a className={cls} href={href}>{children}</a>
    );
  }
  const { variant: _v, children: _c, className: _cn, href: _h, ...rest } = props as AsButton;
  void _v; void _c; void _cn; void _h;
  return <button type="button" className={cls} {...rest}>{children}</button>;
}
