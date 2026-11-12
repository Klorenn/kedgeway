"use client";

import { useEffect, useRef, useState } from "react";
import { ECOSYSTEM, fmt } from "@/data/ecosystem";
import styles from "./EcosystemGrid.module.css";

const { counts, total, date } = ECOSYSTEM;
const DEPRECATED_PCT = 22;
const COLS = 40;
const CELLS = 400; // one cell is 1/400 of the repos scanned
const DEPRECATED_CELLS = Math.round((counts.deprecated / total) * CELLS); // 88 (22%)
const CURRENT_CELLS = Math.round((counts.current / total) * CELLS); // 13 (3.4%)
const WAVE_MS = 1200;

const LABEL =
  `${fmt(total)} repos scanned by Scout on ${date}: ${fmt(counts.deprecated)} (${DEPRECATED_PCT}%) on a deprecated soroban-sdk, ` +
  `${fmt(counts.current)} on the current major, the rest supported or unknown. One cell is about ${fmt(Math.round(total / CELLS))} repos.`;

type Kind = "deprecated" | "current" | "other";
const KINDS: Kind[] = Array.from({ length: CELLS }, (_, i) => (i < DEPRECATED_CELLS ? "deprecated" : i < DEPRECATED_CELLS + CURRENT_CELLS ? "current" : "other"));

/** A sorted unit chart: 40 columns of square cells; deprecated first, then current, then the rest. */
export default function EcosystemGrid() {
  const chartRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLElement>(null);
  const pctRef = useRef<HTMLElement>(null);
  const [lit, setLit] = useState(false);

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setLit(true);
      return;
    }
    let raf = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        setLit(true); // the deprecated block lights up, left to right (CSS transition delays)
        const t0 = performance.now();
        const tick = (now: number): void => {
          const p = Math.min(1, (now - t0) / WAVE_MS);
          const e = 1 - Math.pow(1 - p, 3);
          if (countRef.current) countRef.current.textContent = fmt(Math.round(counts.deprecated * e));
          if (pctRef.current) pctRef.current.textContent = String(Math.round(DEPRECATED_PCT * e));
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        if (countRef.current) countRef.current.textContent = "0";
        if (pctRef.current) pctRef.current.textContent = "0";
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div ref={chartRef} className={styles.chart} role="img" aria-label={LABEL} data-lit={lit}>
        {KINDS.map((k, i) => (
          <span key={i} className={styles[k]} style={k === "deprecated" ? ({ "--c": i % COLS } as React.CSSProperties) : undefined} />
        ))}
      </div>
      <div className={styles.legend}>
        <ul>
          <li>
            <i style={{ background: "var(--ink)" }} />
            <span>
              deprecated <b ref={countRef}>{fmt(counts.deprecated)}</b> (<b ref={pctRef}>{DEPRECATED_PCT}</b>%)
            </span>
          </li>
          <li>
            <i style={{ background: "var(--ink-2)" }} />
            <span>current {fmt(counts.current)} (3.4%)</span>
          </li>
          <li>
            <i style={{ background: "var(--rule)" }} />
            <span>
              supported {fmt(counts.supported)}, unknown {fmt(counts.unknown)}
            </span>
          </li>
        </ul>
        <p>
          one cell ≈ {fmt(Math.round(total / CELLS))} repos · {fmt(total)} scanned · source: Stellar Raven / Scout · {date}
        </p>
      </div>
    </>
  );
}
