"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LogoLockup } from "./ui/Logo";
import NavLink from "./ui/NavLink";
import Button from "./ui/Button";
import MenuButton from "./ui/MenuButton";
import styles from "./SiteHeader.module.css";

const REPO = "https://github.com/Klorenn/kedgeway";
const LANG_KEY = "kedgeway-lang";
const LINKS: readonly (readonly [string, string])[] = [
  ["Install", "/#install"],
  ["Docs", "/docs"],
  ["Findings", "/docs/findings"],
  ["FAQ", "/#faq"],
  ["Changelog", `${REPO}/blob/main/CHANGELOG.md`],
];

type Lang = "en" | "es";

/** Fixed, transparent navbar over the sky. After 24px of scroll it gains a scrim-tinted blur and a hairline. */
export default function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<Lang>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onScroll = (): void => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "es") setLang("es");
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = lang;
    localStorage.setItem(LANG_KEY, lang);
  }, [lang, ready]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className={styles.header} data-scrolled={scrolled || open}>
      <div className={`container ${styles.inner}`}>
        <Link className={styles.brand} href="/" prefetch={false} aria-label="kedgeway, home" onClick={() => setOpen(false)}>
          <LogoLockup size={20} />
        </Link>
        <nav className={styles.nav} aria-label="Primary">
          {LINKS.map(([label, href]) => (
            <NavLink key={href} href={href}>{label}</NavLink>
          ))}
          <button
            type="button"
            className={styles.lang}
            lang={lang === "es" ? "en" : "es"}
            aria-pressed={lang === "es"}
            onClick={() => setLang((current) => (current === "es" ? "en" : "es"))}
          >
            {lang === "es" ? "English" : "Español"}
          </button>
          <Button variant="secondary" href={REPO} className={styles.gh}>GitHub</Button>
        </nav>
        <div className={styles.menuBtn}>
          <MenuButton open={open} onClick={() => setOpen((o) => !o)} controls="mobile-menu" />
        </div>
      </div>
      <div id="mobile-menu" className={styles.menu} hidden={!open}>
        <nav className={`container ${styles.menuInner}`} aria-label="Primary mobile">
          {LINKS.map(([label, href]) => (
            <NavLink key={href} href={href} className={styles.menuLink} onClick={() => setOpen(false)}>{label}</NavLink>
          ))}
          <button
            type="button"
            className={`${styles.lang} ${styles.menuLink}`}
            lang={lang === "es" ? "en" : "es"}
            aria-pressed={lang === "es"}
            onClick={() => setLang((current) => (current === "es" ? "en" : "es"))}
          >
            {lang === "es" ? "English" : "Español"}
          </button>
          <Button variant="secondary" href={REPO}>GitHub</Button>
        </nav>
      </div>
    </header>
  );
}
