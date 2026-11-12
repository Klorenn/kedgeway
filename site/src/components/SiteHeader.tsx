"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { otherLocale } from "@/i18n/config";
import { href } from "@/i18n/href";
import { useLocale, useLocalePath } from "@/i18n/LocaleProvider";
import { UI } from "@/content/ui";
import { LogoLockup } from "./ui/Logo";
import NavLink from "./ui/NavLink";
import Button from "./ui/Button";
import MenuButton from "./ui/MenuButton";
import styles from "./SiteHeader.module.css";

const REPO = "https://github.com/Klorenn/kedgeway";

/** Fixed, transparent navbar over the sky. After 24px of scroll it gains a scrim-tinted blur and a hairline. */
export default function SiteHeader() {
  const { locale, ui } = useLocale();
  const path = useLocalePath();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const t = ui.header;
  const target = otherLocale(locale);
  const links: readonly (readonly [string, string])[] = [
    [t.install, href(locale, "/#install")],
    [t.docs, href(locale, "/docs")],
    [t.findings, href(locale, "/docs/findings")],
    [t.faq, href(locale, "/#faq")],
    [t.changelog, `${REPO}/blob/main/CHANGELOG.md`],
  ];
  // The same page in the other language, labelled in that language.
  const switchHref = href(target, path);
  const switchLabel = UI[target].header.languageName;

  useEffect(() => {
    const onScroll = (): void => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
        <Link className={styles.brand} href={href(locale, "/")} prefetch={false} aria-label={t.home} onClick={() => setOpen(false)}>
          <LogoLockup size={20} />
        </Link>
        <nav className={styles.nav} aria-label={t.nav}>
          {links.map(([label, to]) => (
            <NavLink key={to} href={to}>{label}</NavLink>
          ))}
          <Link className={styles.lang} href={switchHref} lang={target} hrefLang={target}>{switchLabel}</Link>
          <Button variant="secondary" href={REPO} className={styles.gh}>{t.github}</Button>
        </nav>
        <div className={styles.menuBtn}>
          <MenuButton open={open} onClick={() => setOpen((o) => !o)} controls="mobile-menu" openLabel={t.openMenu} closeLabel={t.closeMenu} />
        </div>
      </div>
      <div id="mobile-menu" className={styles.menu} hidden={!open}>
        <nav className={`container ${styles.menuInner}`} aria-label={t.navMobile}>
          {links.map(([label, to]) => (
            <NavLink key={to} href={to} className={styles.menuLink} onClick={() => setOpen(false)}>{label}</NavLink>
          ))}
          <Link className={`${styles.lang} ${styles.menuLink}`} href={switchHref} lang={target} hrefLang={target} onClick={() => setOpen(false)}>{switchLabel}</Link>
          <Button variant="secondary" href={REPO}>{t.github}</Button>
        </nav>
      </div>
    </header>
  );
}
