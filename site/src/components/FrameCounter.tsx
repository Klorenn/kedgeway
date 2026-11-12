"use client";

import { useEffect, useRef } from "react";
import styles from "./FrameCounter.module.css";

const FRAMES = 11;

/** `pl. 626 — fr. 03/11`: the frame number follows scroll progress. */
export default function FrameCounter() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = (): void => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      const frame = 1 + Math.round(p * (FRAMES - 1));
      el.textContent = `pl. 626 — fr. ${String(frame).padStart(2, "0")}/${FRAMES}`;
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div ref={ref} className={styles.counter} aria-hidden="true">
      pl. 626 — fr. 01/11
    </div>
  );
}
