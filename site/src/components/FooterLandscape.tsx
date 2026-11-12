"use client";

import { useEffect, useRef, useState } from "react";
import { backdropSrc } from "@/lib/backdrop";
import { COMMON, startDither } from "@/lib/dither-gl";
import styles from "./FooterLandscape.module.css";

// Four ridgelines, far to near. u_p.x = canvas height in CSS px (so drift can be expressed in px/s).
const FRAG = `${COMMON}
float ridge(float x, float seed) {
  float n = fbm(vec3(x, seed, 1.7));
  return 1.0 - abs(n * 2.0 - 1.0);
}
void main() {
  vec2 fc = gl_FragCoord.xy;
  vec2 uv = fc / u_res; // y runs up from the bottom of the band
  float asp = u_res.x / u_res.y;
  float x = uv.x * asp;
  float b = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float speedPx = 2.0 + fi * 1.4; // 2, 3.4, 4.8, 6.2 px/s: farther moves slower
    float freq = 1.1 + fi * 0.45;
    float base = 0.60 - fi * 0.13;
    float amp = 0.19 - fi * 0.015;
    float par = (i == 0) ? u_p.y : 0.0; // the farthest ridge drifts vertically with page scroll (0.1x)
    float h = base + par + amp * (ridge(x * freq + u_time * speedPx / u_p.x * freq, 3.0 + fi * 9.0) - 0.5) * 2.0;
    if (uv.y <= h) {
      float shade = 0.18 + fi * 0.2; // farther is darker
      b = shade * (0.7 + 0.3 * (uv.y / max(h, 0.001)));
    }
  }
  // fade in from the page background at the band's top edge
  b *= 1.0 - smoothstep(0.55, 1.0, uv.y);
  gl_FragColor = vec4(dither(b, fc), 1.0);
}
`;

/** Dithered ridges, 4 layers in parallax (2 / 3.4 / 4.8 / 6.2 px/s, 20 fps); the far one also follows scroll at 0.1x.
 *  Fills its band (see FooterBand). Static (t = 30 s) under reduced motion; PNG frame 1 without WebGL. */
export default function FooterLandscape() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState<string | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const handle = startDither(canvas, {
      frag: FRAG,
      fps: 20,
      scale: 0.5,
      staticTime: 30,
      params: () => {
        const r = canvas.getBoundingClientRect();
        const ch = Math.max(1, canvas.clientHeight);
        // parallax: 0.1 x how far the band sits from the bottom of the viewport, clamped to a subtle range
        const shift = Math.max(-0.12, Math.min(0.12, (-(window.innerHeight - r.bottom) * 0.1) / ch));
        return [ch, shift, 0, 0];
      },
    });
    if (!handle.ok) setFallback(backdropSrc("landscape"));
    return () => handle.destroy();
  }, []);

  return (
    <div className={styles.fill}>
      <canvas ref={ref} aria-hidden="true" className={styles.canvas} />
      {fallback ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.canvas} src={fallback} alt="" width={1440} height={342} decoding="async" style={{ objectFit: "cover", objectPosition: "bottom" }} />
      ) : null}
    </div>
  );
}
