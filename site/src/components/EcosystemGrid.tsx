"use client";

import { useEffect, useRef } from "react";
import { BAYER4 } from "@/lib/noise";
import { ECOSYSTEM, ECO_STATES, fmt, type EcoState } from "@/data/ecosystem";
import styles from "./EcosystemGrid.module.css";

type RGB = readonly [number, number, number];

const { counts, total, date } = ECOSYSTEM;
const DEPRECATED_PCT = 22;

const PITCH = 5;
// Halftone: the dot size encodes the state, like a printed screen.
const SIZE: Record<EcoState, number> = { deprecated: 3, current: 2, supported: 1, unknown: 1.5 };
const FADE = 0.25;
const WAVE = 1.2; // deprecated wave duration (s); nothing else animates
const TOTAL_S = WAVE + FADE;

const RGBS: Record<EcoState, RGB> = {
  supported: [0x1f, 0x1f, 0x22], // --rule
  current: [0x9a, 0x97, 0x8f], // --ink-2
  deprecated: [0xf2, 0xef, 0xe9], // --ink
  unknown: [0x4a, 0x4a, 0x4f], // --ink-3
};
const DIM = RGBS.supported;

// Seeded PRNG (mulberry32): the layout is identical on every load.
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildKinds(): { kinds: EcoState[]; jitter: Float32Array } {
  const rand = rng(total);
  const kinds: EcoState[] = [];
  for (const s of ECO_STATES) for (let i = 0; i < counts[s]; i++) kinds.push(s);
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const a = kinds[i] as EcoState;
    kinds[i] = kinds[j] as EcoState;
    kinds[j] = a;
  }
  const jitter = Float32Array.from(kinds, () => rand());
  return { kinds, jitter };
}

function mix(a: RGB, b: RGB, k: number): string {
  const c = (n: 0 | 1 | 2): number => Math.round(a[n] + (b[n] - a[n]) * k);
  return `rgb(${c(0)},${c(1)},${c(2)})`;
}

const LABEL =
  `${fmt(total)} repos scanned by Scout on ${date}: ${fmt(counts.deprecated)} (${DEPRECATED_PCT}%) on a deprecated soroban-sdk, ` +
  `${fmt(counts.current)} on the current major, ${fmt(counts.unknown)} unknown, ${fmt(counts.supported)} otherwise supported.`;

export default function EcosystemGrid() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const countRef = useRef<HTMLElement>(null);
  const pctRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!root || !canvas || !ctx) return;

    const { kinds, jitter } = buildKinds();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let cols = 1;
    let bg: HTMLCanvasElement | null = null;
    let cssW = 0;
    let cssH = 0;
    let elapsed = reduce ? TOTAL_S : 0;
    let raf = 0;
    let started = false;

    const delayOf = (i: number): number => {
      const j = jitter[i] ?? 0;
      return ((i % cols) / cols) * (WAVE - 0.4) + j * 0.4;
    };

    const draw = (): void => {
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (bg) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(bg, 0, 0, cssW, cssH);
      }
      for (let i = 0; i < total; i++) {
        const kind = kinds[i] as EcoState;
        // Only deprecated dots animate: they grow and darken in the wave.
        let lit = 1;
        if (kind === "deprecated") lit = Math.min(1, Math.max(0, (elapsed - delayOf(i)) / FADE));
        const size = kind === "deprecated" ? SIZE.supported + (SIZE.deprecated - SIZE.supported) * lit : SIZE[kind];
        ctx.fillStyle = mix(DIM, RGBS[kind], kind === "deprecated" ? lit : 1);
        const x = (i % cols) * PITCH + (PITCH - size) / 2;
        const y = Math.floor(i / cols) * PITCH + (PITCH - size) / 2;
        ctx.fillRect(x, y, size, size);
      }
    };

    const layout = (): void => {
      const w = Math.floor(root.clientWidth);
      if (w <= 0) return;
      cols = Math.max(1, Math.floor(w / PITCH));
      const rows = Math.ceil(total / cols);
      const h = rows * PITCH;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      cssW = w;
      cssH = h;
      // Printed-screen backdrop: a 10% ink Bayer dither, rendered once per layout.
      bg = document.createElement("canvas");
      bg.width = w;
      bg.height = h;
      const bctx = bg.getContext("2d");
      if (bctx) {
        const img = bctx.createImageData(w, h);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            img.data[i] = 0xf2;
            img.data[i + 1] = 0xef;
            img.data[i + 2] = 0xe9;
            img.data[i + 3] = 0.1 > (BAYER4[y % 4]?.[x % 4] ?? 0.5) ? 255 : 0;
          }
        }
        bctx.putImageData(img, 0, 0);
      }
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      draw();
    };

    const setCounters = (p: number): void => {
      if (countRef.current) countRef.current.textContent = fmt(Math.round(counts.deprecated * p));
      if (pctRef.current) pctRef.current.textContent = String(Math.round(DEPRECATED_PCT * p));
    };

    const play = (): void => {
      if (started) return;
      started = true;
      const t0 = performance.now();
      const tick = (now: number): void => {
        elapsed = (now - t0) / 1000;
        const p = Math.min(1, elapsed / WAVE);
        setCounters(1 - Math.pow(1 - p, 3));
        draw();
        if (elapsed < TOTAL_S) {
          raf = requestAnimationFrame(tick);
        } else {
          elapsed = TOTAL_S;
          setCounters(1);
          draw();
        }
      };
      setCounters(0);
      raf = requestAnimationFrame(tick);
    };

    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(root);

    let io: IntersectionObserver | undefined;
    if (!reduce) {
      io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            io?.disconnect();
            play();
          }
        },
        { threshold: 0.35 },
      );
      io.observe(root);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io?.disconnect();
    };
  }, []);

  return (
    <>
      <div ref={rootRef} className={styles.root}>
        <canvas ref={canvasRef} className={styles.canvas} role="img" aria-label={LABEL} />
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
            <span>current {fmt(counts.current)}</span>
          </li>
          <li>
            <i style={{ background: "var(--rule)" }} />
            <span>supported {fmt(counts.supported)}</span>
          </li>
          <li>
            <i style={{ background: "var(--ink-3)" }} />
            <span>unknown {fmt(counts.unknown)}</span>
          </li>
        </ul>
        <p>
          {fmt(total)} repos scanned · source: Stellar Raven / Scout · {date}
        </p>
      </div>
    </>
  );
}
