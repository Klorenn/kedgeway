"use client";

import { useEffect, useMemo, useRef } from "react";
import HatchGroup from "./HatchGroup";
import { goldenConstruction, rectForEye } from "@/lib/golden";
import { EYE, HATCH_FRAME_COUNT, HORSE_BOTTOM, STATIC_FRAME } from "@/lib/hatch";
import styles from "./HeroHorse.module.css";

const VIEW = { x: -8, y: -2, w: 180, h: 101 };
const FRAME_MS = 100; // 10 fps
const DRAW_MS = 1600;

/** The gallop (10 fps), with a golden rectangle and spiral drawn on once behind it. */
export default function HeroHorse() {
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const framesRef = useRef<(SVGGElement | null)[]>([]);

  const construction = useMemo(() => goldenConstruction(rectForEye(EYE, HORSE_BOTTOM, 12.8)), []);
  const frames = useMemo(() => Array.from({ length: HATCH_FRAME_COUNT }, (_, i) => i), []);

  useEffect(() => {
    const root = rootRef.current;
    const svg = svgRef.current;
    if (!root || !svg) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const show = (i: number): void => {
      framesRef.current.forEach((g, k) => {
        if (g) g.style.display = k === i ? "" : "none";
      });
    };
    show(STATIC_FRAME);

    // Keep construction lines at 1px on screen whatever the rendered width.
    const setStroke = (): void => {
      const w = svg.getBoundingClientRect().width;
      if (w > 0) root.style.setProperty("--sw", String(VIEW.w / w));
    };
    setStroke();
    const ro = new ResizeObserver(setStroke);
    ro.observe(svg);

    if (reduce) {
      root.dataset.state = "done";
      return () => ro.disconnect();
    }

    let frame = STATIC_FRAME;
    let last = 0;
    let raf = 0;
    let running = false;
    let onScreen = false;
    let drawn = false;
    let timer = 0;

    const tick = (now: number): void => {
      if (!running) return;
      if (now - last >= FRAME_MS) {
        last = now;
        frame = (frame + 1) % HATCH_FRAME_COUNT;
        show(frame);
      }
      raf = requestAnimationFrame(tick);
    };
    const sync = (): void => {
      const go = onScreen && !document.hidden;
      if (go && !running) {
        running = true;
        raf = requestAnimationFrame(tick);
      } else if (!go && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    };

    const io = new IntersectionObserver((entries) => {
      onScreen = entries.some((e) => e.isIntersecting);
      if (onScreen && !drawn) {
        drawn = true;
        root.dataset.state = "drawing";
        timer = window.setTimeout(() => {
          root.dataset.state = "done";
        }, DRAW_MS);
      }
      sync();
    }, { threshold: 0.3 });
    io.observe(root);
    document.addEventListener("visibilitychange", sync);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  const { rect, spiral } = construction;
  return (
    <div ref={rootRef} className={styles.root} data-state="idle" data-hero-horse="">
      <svg
        ref={svgRef}
        className={styles.svg}
        viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
        role="img"
        aria-label="A horse galloping, drawn in horizontal strokes"
      >
        <rect className={`${styles.line} ${styles.rect}`} x={rect.x} y={rect.y} width={rect.w} height={rect.h} />
        <path className={`${styles.line} ${styles.spiral}`} d={spiral} pathLength={1} />
        {frames.map((i) => (
          <g key={i} ref={(el) => { framesRef.current[i] = el; }} style={i === STATIC_FRAME ? undefined : { display: "none" }}>
            <HatchGroup frame={i} color="var(--ink)" />
          </g>
        ))}
      </svg>
    </div>
  );
}
