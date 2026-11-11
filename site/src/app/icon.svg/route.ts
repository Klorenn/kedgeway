import { HORSE_HATCH } from "@/data/horse-hatch";
import { STATIC_FRAME } from "@/lib/hatch";

/** Favicon: 12 horizontal strokes sampled from the extended frame, ink on near-black. */
export function GET(): Response {
  const rows = HORSE_HATCH.frames[STATIC_FRAME] ?? [];
  const filled = rows.map((r, i) => (r.length > 0 ? i : -1)).filter((i) => i >= 0);
  const top = filled[0] ?? 0;
  const bottom = filled[filled.length - 1] ?? 0;
  const x0 = 11;
  const scale = 30 / 140; // 140 cells of horse across 30 units
  const lines: string[] = [];
  for (let k = 0; k < 12; k++) {
    const row = Math.round(top + ((bottom - top) * (k + 0.5)) / 12);
    const y = 7 + ((row - top) * scale);
    for (const [a, b] of rows[row] ?? []) {
      lines.push(`<line x1="${(1 + (a - x0) * scale).toFixed(2)}" y1="${y.toFixed(2)}" x2="${(1 + (b - x0) * scale).toFixed(2)}" y2="${y.toFixed(2)}"/>`);
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#0b0b0c"/><g stroke="#f2efe9" stroke-width="1.1" stroke-linecap="round">${lines.join("")}</g></svg>`;
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" } });
}
