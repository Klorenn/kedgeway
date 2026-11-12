"use client";

import { useEffect, useRef } from "react";
import HatchGroup from "./HatchGroup";
import { HATCH_FRAME_COUNT, STATIC_FRAME } from "@/lib/hatch";
import styles from "./FooterFilm.module.css";

const FRAME_MS = 125; // 8 fps
const FRAMES = Array.from({ length: HATCH_FRAME_COUNT }, (_, i) => i);

/**
 * The 11 Muybridge frames as a borderless film strip that plays like a zoetrope (one active frame, 8 fps).
 * Pauses off-screen; static under reduced motion.
 */
export default function FooterFilm() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const cells = useRef<(HTMLElement | null)[]>([]);
  
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const show = (active: number): void => {
      cells.current.forEach((c, i) => {
        if (c) c.dataset.active = String(i === active);
      });
    };
    show(STATIC_FRAME);
    if (reduce) return;

    let frame = 0;
    let last = 0;
    let raf = 0;
    let running = false;
    let onScreen = false;
    const tick = (now: number): void => {
      if (!running) return;
      raf = requestAnimationFrame(tick);
      if (now - last < FRAME_MS) return;
      last = now;
      frame = (frame + 1) % HATCH_FRAME_COUNT;
      show(frame);
    };
    const sync = (): void => {
      const go = onScreen && !document.hidden;
      wrap.dataset.live = String(go);
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
      sync();
    });
    io.observe(wrap);
    document.addEventListener("visibilitychange", sync);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  return (
    <div ref={wrapRef} className={styles.wrap} data-live="false">
      <ol className={styles.strip} aria-label="The eleven frames of the gallop" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {FRAMES.map((i) => (
          <li key={i} ref={(el) => { cells.current[i] = el; }} className={styles.cell} data-active={String(i === STATIC_FRAME)}>
            <svg viewBox="-6 15 160 76" aria-hidden="true" focusable="false">
              <HatchGroup frame={i} color="currentColor" weight={1.8} trails={false} />
            </svg>
            <span className={styles.no}>{String(i + 1).padStart(2, "0")}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
