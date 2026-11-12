"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { COMMON, startDither } from "@/lib/dither-gl";

// u_p.x = half width of the content column (uv units), u_p.y = how far the column is darkened,
// u_p.z = calm factor (docs pages are quieter), u_p.w = canvas width in CSS px (for px/s drift).
const FRAG = `${COMMON}
// fbm whose first two octaves are billowed, so the big forms get puffy ridges.
float fbmB(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    float n = vnoise(p);
    if (i < 2) n = 1.0 - abs(2.0 * n - 1.0);
    v += a * n;
    p = p * 2.02 + vec3(11.7, 3.1, 5.3);
    a *= 0.5;
  }
  return v / 0.9375;
}
void main() {
  vec2 fc = gl_FragCoord.xy;
  vec2 uv = fc / u_res;
  float asp = u_res.x / u_res.y;
  float t3 = u_time * 0.03;
  // about two noise cells across the viewport: one cloud mass spans roughly half the width
  vec2 p = vec2(uv.x, uv.y / asp) * 2.0;
  p += vec2(1.0, -0.3) * (10.0 / u_p.w) * 2.0 * u_time; // ~10px/s drift
  float q = fbm(vec3(p, t3));
  vec3 w = vec3(p + 0.6 * q, t3 + 3.0);
  float n = fbmB(w);
  // light from the top left: lit edges, darker undersides
  float lit = fbmB(vec3(w.xy + vec2(-0.07, 0.07), w.z));
  n += 0.6 * (n - lit);
  // put the sky where the text is: more cloud toward the edges and the bottom, less behind the column
  float dx = abs(uv.x - 0.5);
  n += 0.06 * (1.0 - uv.y) + 0.06 * smoothstep(0.2, 0.5, dx);
  n -= (1.0 - smoothstep(u_p.x, u_p.x + 0.12, dx)) * u_p.y;
  n -= (1.0 - u_p.z) * 0.18;
  // piecewise level: 0 sky (pure black) < 0.48, level 1..4 above, dithered on the level
  float L = clamp((n - 0.48) / 0.20, 0.0, 1.0);
  L += clamp((n - 0.68) / 0.16, 0.0, 1.0);
  L += 0.8 * clamp((n - 0.84) / 0.18, 0.0, 1.0);
  L += 0.3 * clamp((n - 0.98) / 0.1, 0.0, 1.0); // level 4 (ink) only as sparse highlights
  float lvl = floor(L + bayer4(fc));
  vec3 c = BG;
  if (lvl > 3.5) c = INK;
  else if (lvl > 2.5) c = INK2;
  else if (lvl > 1.5) c = INK3;
  else if (lvl > 0.5) c = RULE;
  gl_FragColor = vec4(c, 1.0);
}
`;

/** Full-viewport animated dithered cumulus behind everything. Quiet by design. */
export default function DitherClouds() {
  const ref = useRef<HTMLCanvasElement>(null);
  const pathname = usePathname();
  const calm = useRef(1);
  calm.current = pathname.startsWith("/docs") ? 0.4 : 1;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const handle = startDither(canvas, {
      frag: FRAG,
      fps: 24,
      scale: 0.5,
      staticTime: 40,
      params: () => {
        const vw = Math.max(320, window.innerWidth);
        const half = Math.min(0.5, 560 / vw); // hero text column (wider than the narrow text)
        // strongest at the top of the page (hero), darker once the content scrolls over it
        const s = Math.min(1, window.scrollY / Math.max(1, window.innerHeight * 0.8));
        const inside = 0.34 + 0.12 * s; // how far the column is pushed into sky
        return [half, inside, calm.current, Math.max(1, canvas.clientWidth)];
      },
    });
    (window as unknown as { __cloudsLuma?: () => number | null; __cloudsRegion?: (a: number, b: number, c: number, d: number) => number | null }).__cloudsLuma = handle.readAverageLuminance;
    (window as unknown as { __cloudsRegion?: typeof handle.readRegionLuminance }).__cloudsRegion = handle.readRegionLuminance;
    return () => handle.destroy();
  }, []);

  return <canvas ref={ref} aria-hidden="true" style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 0, pointerEvents: "none", imageRendering: "pixelated" }} />;
}
