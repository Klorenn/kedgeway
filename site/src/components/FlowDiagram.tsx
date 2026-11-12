"use client";

import { useEffect, useRef } from "react";
import PixelIcon from "./icons/pixel";
import styles from "./FlowDiagram.module.css";

/** Scan, ask Raven, diagnose, as a 1-bit icon diagram. A single pixel packet travels the links once. */
export default function FlowDiagram() {
  const ref = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.dataset.run = "true";
          io.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const link = (
    <li className={styles.link} aria-hidden="true">
      <span className={styles.dash} />
      <span className={styles.arrow}>
        <PixelIcon name="arrow-right" size={16} />
      </span>
    </li>
  );

  return (
    <ol ref={ref} className={styles.diagram} style={{ listStyle: "none", margin: 0, padding: 0 }} aria-label="Scan manifests, ask Raven, print a report">
      <li className={styles.node}>
        <div className={styles.icons}>
          <PixelIcon name="file" size={48} />
          <PixelIcon name="file" size={48} />
        </div>
        <p className={styles.label}>scan</p>
        <p className={styles.sub}>Cargo.toml / package.json</p>
      </li>
      {link}
      <li className={styles.node}>
        <PixelIcon name="raven" size={48} />
        <p className={styles.label}>ask raven</p>
        <p className={styles.sub}>Software Versions + Scout</p>
      </li>
      {link}
      <li className={styles.node}>
        <PixelIcon name="terminal" size={48} />
        <p className={styles.label}>diagnose</p>
        <p className={styles.sub}>report · source + time</p>
      </li>
      <span className={styles.packet} aria-hidden="true" />
    </ol>
  );
}
