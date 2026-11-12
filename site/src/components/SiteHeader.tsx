"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import HorseMark from "./HorseMark";
import styles from "./SiteHeader.module.css";

/** Fixed, transparent navbar. After 24px of scroll it gains a backdrop blur and a hairline, never a fill. */
export default function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = (): void => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={styles.header} data-scrolled={scrolled}>
      <div className={`colWide ${styles.inner}`}>
        <Link className={styles.brand} href="/" aria-label="kedgeway, home">
          <HorseMark size={40} />
          <span>kedgeway</span>
        </Link>
        <nav className={styles.nav} aria-label="Primary">
          <Link href="/#install">Install</Link>
          <Link href="/docs">Docs</Link>
          <a href="https://github.com/Klorenn/kedgeway">GitHub</a>
        </nav>
      </div>
    </header>
  );
}
