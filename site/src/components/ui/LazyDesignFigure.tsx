"use client";

import { useEffect, useRef, useState } from "react";
import { FIGURE_DIMS } from "@/generated/figure-dims.generated";
import type { FigureSet } from "@/generated/figure-types";
import styles from "./DesignFigure.module.css";

type FigureName = Exclude<keyof typeof FIGURE_DIMS, "textureGround">;

// Each figure is its own chunk: the stipple fields are 100 KB+ and never belong in the HTML.
const LOADERS: Record<FigureName, () => Promise<{ default: FigureSet }>> = {
  fig2: () => import("@/generated/fig2.generated"),
  fig3: () => import("@/generated/fig3.generated"),
  fig4: () => import("@/generated/fig4.generated"),
  fig5: () => import("@/generated/fig5.generated"),
  fig6: () => import("@/generated/fig6.generated"),
  fig7: () => import("@/generated/fig7.generated"),
  fig8: () => import("@/generated/fig8.generated"),
};

/** Exported figures reserve blank space at the bottom for the caption: 49px (one line) desktop, 73px (two lines) mobile. */
const CAPTION_SPACE = { desktop: 49, mobile: 73 } as const;

interface Props {
  name: FigureName;
  fig: string;
  caption: string;
  /** What the figure shows, for assistive tech. The SVG itself is decorative. */
  description: string;
  className?: string;
}

/**
 * Captioned figure (fig. 2 to 8). The caption and a box with the figure's exact aspect ratio are in the HTML; the SVG
 * is inlined only when the figure is within 800px of the viewport, so the page document stays small and nothing shifts.
 */
export default function LazyDesignFigure({ name, fig, caption, description, className }: Props) {
  const ref = useRef<HTMLElement>(null);
  const [set, setSet] = useState<FigureSet | null>(null);
  const dims = FIGURE_DIMS[name];

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let alive = true;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        LOADERS[name]().then((m) => alive && setSet(m.default));
      },
      { rootMargin: "800px 0px" },
    );
    io.observe(el);
    return () => {
      alive = false;
      io.disconnect();
    };
  }, [name]);

  const box = (size: "desktop" | "mobile", cls: string) => {
    const [w, h] = dims[size];
    const crop = CAPTION_SPACE[size];
    const common = { className: cls, style: { maxWidth: w, aspectRatio: `${w} / ${h - crop}` }, fill: "none", "aria-hidden": true, focusable: "false" } as const;
    if (!set) return <div className={cls} style={common.style} aria-hidden="true" />;
    const f = set[size];
    return <svg {...common} viewBox={`0 0 ${f.w} ${f.h - crop}`} dangerouslySetInnerHTML={{ __html: f.inner }} />;
  };

  return (
    <figure ref={ref} className={`${styles.fig}${className ? ` ${className}` : ""}`}>
      {box("desktop", styles.desktop as string)}
      {box("mobile", styles.mobile as string)}
      <figcaption className={`t-mono-label ${styles.caption}`}>
        <span>{fig}</span>
        <span>{caption}</span>
      </figcaption>
      <span className="sr-only">{description}</span>
    </figure>
  );
}
