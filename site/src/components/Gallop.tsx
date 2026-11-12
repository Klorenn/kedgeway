"use client";

import { memo, useEffect, useRef } from "react";
import { useFrameSprite } from "@/lib/frame-sprite";

const FRAME_VIEWBOX = "0 0 180 101";
const FRAME_COUNT = 11;
import styles from "./Gallop.module.css";

/** 80 ms per frame (~12.5 fps) with a 50 ms linear cross-dissolve into each new frame. */
export const FRAME_MS = 80;
export const DISSOLVE_MS = 50;

interface GallopProps {
  /** Rendered width in px (max); the box keeps the 180:101 ratio so nothing shifts. Omit to fill the parent. */
  size?: number;
  /** 1..11. Hero starts on 08, the footer on 05. Reduced motion stays here. */
  startFrame?: number;
  /** Called with the current frame (1..11) whenever it changes, and once on mount. */
  onFrame?: (frame: number) => void;
  /** false renders the start frame only (404 page). */
  animate?: boolean;
  className?: string;
}

/**
 * Muybridge gallop: 11 frame slots in one inline SVG (viewBox 0 0 180 101) that <use> the shared kw-frame symbols, driven by a single rAF clock. No CSS
 * animation per frame. Runs only while >= 30% in view and the tab is visible; static under reduced motion.
 */
function Gallop({ size, startFrame = 8, onFrame, animate = true, className }: GallopProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const ready = useFrameSprite();
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;
  const start = Math.min(11, Math.max(1, Math.round(startFrame))) - 1;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const groups = Array.from(svg.querySelectorAll<SVGGElement>("g[data-frame]"));
    const set = (i: number, opacity: number): void => {
      const g = groups[i];
      if (!g) return;
      const v = opacity <= 0 ? "0" : opacity >= 1 ? "1" : opacity.toFixed(3);
      if (g.style.opacity !== v) g.style.opacity = v;
    };
    const show = (cur: number, prev: number, mix: number): void => {
      groups.forEach((_, i) => {
        if (i === cur) set(i, mix);
        else if (i === prev && mix < 1) set(i, 1);
        else set(i, 0);
      });
    };
    let cur = start;
    show(cur, -1, 1);
    onFrameRef.current?.(cur + 1);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !animate) return;

    let raf = 0;
    let running = false;
    let visible = false;
    let last = 0;
    let acc = 0; // ms into the current frame
    const tick = (now: number): void => {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      acc += Math.min(now - last, 200); // a long stall does not skip frames in bulk
      last = now;
      let changed = false;
      while (acc >= FRAME_MS) {
        acc -= FRAME_MS;
        cur = (cur + 1) % groups.length;
        changed = true;
      }
      const prev = (cur + groups.length - 1) % groups.length;
      show(cur, prev, Math.min(1, acc / DISSOLVE_MS));
      if (changed) onFrameRef.current?.(cur + 1);
    };
    const sync = (): void => {
      const go = visible && !document.hidden;
      if (go && !running) {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(tick);
      } else if (!go && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    };
    const io = new IntersectionObserver(
      (entries) => {
        visible = entries.some((e) => e.isIntersecting);
        sync();
      },
      { threshold: 0.3 },
    );
    io.observe(svg);
    document.addEventListener("visibilitychange", sync);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [start, animate]);

  return (
    <svg
      ref={svgRef}
      className={`${styles.gallop}${className ? ` ${className}` : ""}`}
      style={size ? { width: size } : undefined}
      viewBox={FRAME_VIEWBOX}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {Array.from({ length: FRAME_COUNT }, (_, i) => {
        const id = String(i + 1).padStart(2, "0");
        return (
          <g key={id} data-frame={id} style={{ opacity: i === start ? 1 : 0 }}>
            {ready ? <use href={`#kw-frame-${id}`} width="180" height="101" /> : null}
          </g>
        );
      })}
    </svg>
  );
}

export default memo(Gallop);
