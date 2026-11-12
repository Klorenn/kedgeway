"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocale } from "@/i18n/LocaleProvider";
import { fill } from "@/content/schema/ui";
import styles from "./AsciiBlock.module.css";

/** Splits text on a one-group regex; matches become ink-emphasised spans (the rest stays ink-2). */
function emphasise(text: string, re: RegExp): ReactNode[] {
  return text.split(re).map((part, i) => (i % 2 === 1 ? <b key={i} className={styles.em}>{part}</b> : part));
}

interface AsciiBlockProps {
  desktop: string;
  mobile: string;
  /** Blank lines removed from the top of each string by sync-design (restored as margin-top). */
  desktopLead?: number;
  mobileLead?: number;
  /** Width in px the desktop variant needs (cols x 8.4, plus padding): 57 cols = 479, 70 cols = 588, 76 cols + panel = 687, 142 cols = 1193. */
  desktopMin: 479 | 588 | 687 | 1193;
  /** Source of a regular expression with one capture group (a string, so it can cross the server/client boundary): the tokens rendered in ink. */
  emphasis: string;
  /** Surface panel: 8px radius, rule border, 24px (16 mobile) padding. */
  panel?: boolean;
  /** ASCII/Art metrics (14px line height) instead of ASCII/Table (20px). */
  art?: boolean;
  /** Name used for the scroll region ("<label>, scroll horizontally") when the block is wider than its container. */
  label?: string;
  /** Pure illustration: never scrolls; any overflow is clipped. */
  decorative?: boolean;
  /** Visually hidden equivalent (a semantic table or text) for assistive tech. */
  children?: ReactNode;
  className?: string;
}

/**
 * Plain-ASCII block on a fixed 0.6em grid. The variant is chosen by the width the block actually gets (container
 * query), so it never overflows between breakpoints. Below the mobile variant's natural width (about 340px) the text
 * cannot shrink (14px minimum), so the block becomes a keyboard-focusable horizontal scroll region, and only then:
 * when it fits there is no scroller and no extra tab stop. The text is aria-hidden; `children` carries the data.
 */
export default function AsciiBlock({ desktop, mobile, desktopLead = 0, mobileLead = 0, desktopMin, emphasis, panel, art, label, decorative, children, className }: AsciiBlockProps) {
  const { ui } = useLocale();
  const ref = useRef<HTMLDivElement>(null);
  const [scrolls, setScrolls] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || decorative) return;
    const measure = (): void => setScrolls(el.scrollWidth > el.clientWidth + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [decorative, desktop, mobile]);

  const re = useMemo(() => new RegExp(emphasis), [emphasis]);
  const lh = art ? 14 : 20;
  const metrics = art ? "t-ascii-art" : "t-ascii-table";
  const scroller = scrolls && !decorative;
  return (
    <div
      ref={ref}
      className={`${styles.wrap} ${styles[`min${desktopMin}`]}${panel ? ` ${styles.panel}` : ""}${className ? ` ${className}` : ""}`}
      data-scroll={scroller ? "true" : undefined}
      {...(scroller ? { tabIndex: 0, role: "region", "aria-label": fill(ui.asciiScroll, { label: label ?? ui.asciiDefault }) } : {})}
    >
      <pre className={`${styles.d} ${metrics}`} aria-hidden="true" style={desktopLead ? { marginTop: desktopLead * lh } : undefined}>{emphasise(desktop, re)}</pre>
      <pre className={`${styles.m} ${metrics}`} aria-hidden="true" style={mobileLead ? { marginTop: mobileLead * lh } : undefined}>{emphasise(mobile, re)}</pre>
      {children ? <div className="sr-only">{children}</div> : null}
    </div>
  );
}
