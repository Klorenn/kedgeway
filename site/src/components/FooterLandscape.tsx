"use client";

import { useEffect, useRef } from "react";
import { COMMON, startDither } from "@/lib/dither-gl";

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
    float h = base + amp * (ridge(x * freq + u_time * speedPx / u_p.x * freq, 3.0 + fi * 9.0) - 0.5) * 2.0;
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

/** Full-bleed dithered mountain band at the very bottom of the page. Static under reduced motion. */
export default function FooterLandscape() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const handle = startDither(canvas, {
      frag: FRAG,
      fps: 20,
      scale: 0.5,
      staticTime: 30,
      params: () => [Math.max(1, canvas.clientHeight), 0, 0, 0],
    });
    return () => handle.destroy();
  }, []);

  return <canvas ref={ref} aria-hidden="true" style={{ display: "block", width: "100%", height: "38vh", imageRendering: "pixelated", background: "#0b0b0c" }} />;
}
