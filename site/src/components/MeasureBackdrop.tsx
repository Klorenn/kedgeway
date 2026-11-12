"use client";

import { useEffect, useRef } from "react";
import styles from "./MeasureBackdrop.module.css";

const FRAME_MS = 1000 / 30;
const SPACING = 48;
const SPEED = 18; // px/s, scrolling left
const RUN_LIMIT_S = 8; // the wall stops after 8 seconds of running
const RULE = [0x1f, 0x1f, 0x22] as const; // --rule
const INK3 = [0x4a, 0x4a, 0x4f] as const; // --ink-3 (lines only, never text)

const rgba = (c: readonly [number, number, number], a: number): string => `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;

interface MeasureBackdropProps {
  /** Selector of the horse: the baseline sits under its hooves and the mask is strongest around it. */
  anchor: string;
}

/**
 * Muybridge's measuring wall: numbered vertical lines and a baseline, scrolling left so the horse seems to run
 * past it, with a half-speed fainter layer for parallax. Static under reduced motion.
 */
export default function MeasureBackdrop({ anchor }: MeasureBackdropProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!root || !canvas || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let baseline = 0;
    let horseTop = 0;
    let horseCx = 0;
    let raf = 0;
    let last = 0;
    let runTime = 0; // seconds spent running, capped at RUN_LIMIT_S
    let running = false;
    let onScreen = false;

    const measure = (): void => {
      const rect = root.getBoundingClientRect();
      const horse = document.querySelector(anchor)?.getBoundingClientRect();
      if (horse) {
        baseline = Math.round(horse.bottom - rect.top - horse.width * 0.0528 + 2);
        horseTop = horse.top - rect.top;
        horseCx = horse.left - rect.left + horse.width / 2;
      } else {
        baseline = Math.round(h * 0.9);
        horseTop = h * 0.6;
        horseCx = w / 2;
      }
    };

    /** Alpha mask: faint behind the text, strongest around the horse. */
    const maskY = (y: number): number => {
      if (y > baseline) return 0;
      const fadeTop = Math.max(h * 0.3, 1);
      if (y < fadeTop) return 0.04;
      const toHorse = Math.min(1, Math.max(0, (y - fadeTop) / Math.max(1, horseTop - fadeTop)));
      return 0.08 + 0.92 * toHorse * toHorse;
    };
    const maskX = (x: number): number => {
      const d = Math.min(1, Math.abs(x - horseCx) / (w * 0.55));
      return 1 - 0.65 * d;
    };

    const layer = (spacing: number, speed: number, t: number, color: readonly [number, number, number], strength: number, numbers: boolean): void => {
      const offset = (t * speed) % (spacing * 100);
      const first = Math.floor(offset / spacing);
      for (let i = first - 1; ; i++) {
        const x = Math.round(i * spacing - offset) + 0.5;
        if (x > w + spacing) break;
        if (x < -spacing) continue;
        const major = numbers && i % 5 === 0;
        const col = major ? INK3 : color;
        const gx = maskX(x) * strength * (major ? 1.1 : 1);
        const g = ctx.createLinearGradient(0, 0, 0, baseline);
        const stops = [0, 0.3, Math.min(0.98, Math.max(0.31, horseTop / Math.max(1, baseline))), 1];
        const ys = [0, h * 0.3, horseTop, baseline];
        g.addColorStop(stops[0] as number, rgba(col, maskY(ys[0] as number) * gx));
        g.addColorStop(Math.min(1, (ys[1] as number) / Math.max(1, baseline)), rgba(col, maskY((ys[1] as number) + 1) * gx));
        g.addColorStop(stops[2] as number, rgba(col, maskY(ys[2] as number) * gx));
        g.addColorStop(1, rgba(col, gx));
        ctx.fillStyle = g;
        ctx.fillRect(Math.floor(x), 0, 1, baseline);
      }
    };

    const draw = (t: number): void => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      layer(SPACING * 2, SPEED / 2, t, RULE, 0.35, false); // fainter, slower back layer
      layer(SPACING, SPEED, t, RULE, 0.7, true);
    };

    const layout = (): void => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = root.clientWidth;
      h = root.clientHeight;
      if (w === 0 || h === 0) return;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      measure();
      draw(reduce ? 0 : runTime);
    };

    const tick = (now: number): void => {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      if (now - last < FRAME_MS) return;
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      runTime = Math.min(RUN_LIMIT_S, runTime + dt);
      draw(runTime);
      if (runTime >= RUN_LIMIT_S) {
        // Stop for good: the wall has made its point.
        running = false;
        cancelAnimationFrame(raf);
        io?.disconnect();
        document.removeEventListener("visibilitychange", sync);
      }
    };
    const sync = (): void => {
      const go = !reduce && onScreen && !document.hidden;
      if (go && !running) {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(tick);
      } else if (!go && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    };

    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(root);
    let io: IntersectionObserver | undefined;
    if (!reduce) {
      io = new IntersectionObserver((entries) => {
        onScreen = entries.some((e) => e.isIntersecting);
        sync();
      });
      io.observe(root);
      document.addEventListener("visibilitychange", sync);
    }
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io?.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [anchor]);

  return (
    <div ref={rootRef} className={styles.root} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
