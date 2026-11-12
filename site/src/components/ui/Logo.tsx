import { LOGO_ASPECT, LOGO_PATHS, LOGO_VIEWBOX } from "./logo-mark.generated";
import styles from "./Logo.module.css";

interface LogoMarkProps {
  /** Rendered height in px. Width follows the mark's aspect ratio. Minimum 16. */
  height?: number;
  className?: string;
  /** Provide when the mark is the only content of a link or standalone; otherwise it is decorative. */
  title?: string;
}

/** The rearing-horse mark (design/logo/mark.svg), filled with currentColor. */
export function LogoMark({ height = 24, className, title }: LogoMarkProps) {
  const h = Math.max(16, height);
  return (
    <svg
      className={`${styles.mark}${className ? ` ${className}` : ""}`}
      width={h * LOGO_ASPECT}
      height={h}
      viewBox={LOGO_VIEWBOX}
      fill="currentColor"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {LOGO_PATHS.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

interface LogoLockupProps {
  /** Wordmark font size in px (Wordmark/Nav = 20, Wordmark/Display = 48). The mark is 1.17x that. */
  size?: number;
  className?: string;
}

/** Mark + 16px + "kedgeway" in Geist Mono 500. */
export function LogoLockup({ size = 20, className }: LogoLockupProps) {
  return (
    <span className={`${styles.lockup}${className ? ` ${className}` : ""}`} style={{ fontSize: size, lineHeight: 1.3 }}>
      <LogoMark height={Math.round(size * 1.17)} />
      <span>kedgeway</span>
    </span>
  );
}
