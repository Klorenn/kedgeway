"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./FooterWordmark.module.css";

const STRIPES = 28;

/** The big wordmark. On first view it is revealed by horizontal ink strokes sweeping left to right (~700ms), once. */
export default function FooterWordmark() {
  const ref = useRef<HTMLParagraphElement>(null);
  const coverRef = useRef<HTMLSpanElement>(null);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return; // already on screen: no animation
    setArmed(true);
  }, []);

  useEffect(() => {
    const el = ref.current;
    const cover = coverRef.current;
    if (!armed || !el || !cover) return;
    let timer = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          cover.dataset.run = "true";
          timer = window.setTimeout(() => setArmed(false), 800);
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
    };
  }, [armed]);

  return (
    <p ref={ref} className={styles.word}>
      kedgeway
      {armed ? (
        <span ref={coverRef} className={styles.cover} aria-hidden="true">
          {Array.from({ length: STRIPES }, (_, i) => (
            <span key={i} className={styles.stripe} style={{ ["--d" as string]: `${Math.round(((i * 7919) % STRIPES) * (250 / STRIPES))}ms` }} />
          ))}
        </span>
      ) : null}
    </p>
  );
}
