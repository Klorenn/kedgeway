"use client";

import { useEffect, useRef } from "react";
import { BAYER4, fbm2, smoothstep } from "@/lib/noise";
import styles from "./EngravingStrip.module.css";

type Variant = "left" | "right" | "top";

interface EngravingStripProps {
  variant: Variant;
  seed?: number;
}

const CELL = 2; // css px per dither cell
const INK = [0xf2, 0xef, 0xe9] as const;

/** 1-bit ordered dither (4x4 Bayer): soft cloud forms thresholded to ink on transparent. Static, drawn on mount. */
export default function EngravingStrip({ variant, seed = 3 }: EngravingStripProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const render = (): void => {
      const rect = canvas.getBoundingClientRect();
      const cols = Math.max(1, Math.round(rect.width / CELL));
      const rows = Math.max(1, Math.round(rect.height / CELL));
      if (rect.width === 0 || rect.height === 0) return;
      canvas.width = cols;
      canvas.height = rows;
      const img = ctx.createImageData(cols, rows);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const u = x / cols;
          const v = y / rows;
          // Cloud / sea-spray field: stretched noise, shaped to soft masses.
          const n = fbm2(u * 3.2 * (cols / rows < 1 ? 1 : 0.35) + 0.3, v * 5.5, seed);
          let d = smoothstep(0.38, 0.82, n);
          // Dithered falloff: the field itself fades, so the edge breaks into dots instead of a gradient.
          const inner = variant === "left" ? 1 - smoothstep(0.35, 1, u) : variant === "right" ? 1 - smoothstep(0.35, 1, 1 - u) : 1;
          const bottom = 1 - smoothstep(variant === "top" ? 0.3 : 0.5, 1, v);
          // Keep the area under the fixed navbar clear so nav links stay legible.
          const top = variant === "top" ? 1 : smoothstep(0.1, 0.24, v);
          d *= inner * bottom * top * (variant === "top" ? 0.65 : 1);
          const on = d > (BAYER4[y % 4]?.[x % 4] ?? 0.5);
          const i = (y * cols + x) * 4;
          img.data[i] = INK[0];
          img.data[i + 1] = INK[1];
          img.data[i + 2] = INK[2];
          img.data[i + 3] = on ? 255 : 0;
        }
      }
      ctx.putImageData(img, 0, 0);
    };

    render();
    const ro = new ResizeObserver(render);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [variant, seed]);

  return (
    <div className={`${styles.strip} ${styles[variant]}`} aria-hidden="true">
      <canvas ref={ref} className={styles.canvas} />
    </div>
  );
}
