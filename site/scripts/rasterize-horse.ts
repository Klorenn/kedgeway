/**
 * Rasterizes Eadweard Muybridge's "The Horse in Motion" (1878, public domain) into
 * rider-free horizontal hatch runs (160x90 grid) and writes src/data/horse-hatch.ts.
 *
 * Source: https://commons.wikimedia.org/wiki/File:The_Horse_in_Motion_high_res.jpg
 * Direct: https://upload.wikimedia.org/wikipedia/commons/d/d2/The_Horse_in_Motion_high_res.jpg
 * License: Public domain (Library of Congress Prints and Photographs Division).
 *
 * Usage: npx tsx scripts/rasterize-horse.ts <sheet.jpg> [contact-sheet.png] [--compact]
 * HORSE_COMPACT (32x18 reduction of the static frame, for the favicon) is always written;
 * --compact additionally prints it to stdout for review.
 * Not run at build time; the generated data file is committed.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

const DEFAULT_COLS = 64;
const DEFAULT_ROWS = 36;
const COLS = DEFAULT_COLS;
const ROWS = DEFAULT_ROWS;
const COMPACT_COLS = 32;
const COMPACT_ROWS = 18;
const ON_RATIO = 0.45;
const THRESHOLD = 95; // horse is near-black on a mid-grey ground
const CLEAN_SIGMA = 4; // blur+rethreshold removes grid lines thinner than ~6px
const STATIC_INDEX = 7; // frame 8: fully extended flight

/** Sheet is 5694x3510: three rows by four columns. Frame 12 is a standing horse and is skipped. */
const BOX_X = [131, 1492, 2858, 4219];
const BOX_Y = [142, 1031, 1919];
const CROP = { dx: 43, dy: 85, w: 1228, h: 690 };
const MIN_VERTICAL_RUN = 16; // drops horizontal ground lines (thin vertically); legs and body are far thicker
const MAX_HOOF_RUN = 110; // in the bottom band only legs exist; wide runs there are ground smudges
const GROUND_BAND = 0.93;
const MIN_COMPONENT = 600; // drops specks left by the grid and smudges

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

function boxes(): Box[] {
  const out: Box[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      if (r === 2 && c === 3) continue;
      out.push({ left: (BOX_X[c] as number) + CROP.dx, top: (BOX_Y[r] as number) + CROP.dy, width: CROP.w, height: CROP.h });
    }
  }
  return out;
}

async function silhouette(sheet: string, box: Box): Promise<{ data: Buffer; w: number; h: number }> {
  const thresholded = await sharp(sheet)
    .extract(box)
    .greyscale()
    .blur(1)
    .threshold(THRESHOLD)
    .negate()
    .png()
    .toBuffer();
  const { data, info } = await sharp(thresholded)
    .blur(CLEAN_SIGMA)
    .threshold(128)
    .toColourspace("b-w")
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 1) throw new Error(`expected 1 channel, got ${info.channels}`);
  return { data: cleanMask(data, info.width, info.height), w: info.width, h: info.height };
}

/** Removes ground lines and specks from a 1-channel mask (255 = silhouette). */
function cleanMask(data: Buffer, w: number, h: number): Buffer {
  const out = Buffer.from(data);
  for (let x = 0; x < w; x++) {
    let y = 0;
    while (y < h) {
      if ((out[y * w + x] as number) > 127) {
        let e = y;
        while (e < h && (out[e * w + x] as number) > 127) e++;
        if (e - y < MIN_VERTICAL_RUN) for (let k = y; k < e; k++) out[k * w + x] = 0;
        y = e;
      } else y++;
    }
  }
  for (let y = Math.floor(h * GROUND_BAND); y < h; y++) {
    let x = 0;
    while (x < w) {
      if ((out[y * w + x] as number) > 127) {
        let e = x;
        while (e < w && (out[y * w + e] as number) > 127) e++;
        if (e - x > MAX_HOOF_RUN) for (let k = x; k < e; k++) out[y * w + k] = 0;
        x = e;
      } else x++;
    }
  }
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if ((out[i] as number) <= 127 || seen[i]) continue;
    const comp: number[] = [];
    stack.push(i);
    seen[i] = 1;
    while (stack.length > 0) {
      const p = stack.pop() as number;
      comp.push(p);
      const px = p % w;
      const py = (p - px) / w;
      for (const [nx, ny] of [[px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]] as const) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (!seen[q] && (out[q] as number) > 127) {
          seen[q] = 1;
          stack.push(q);
        }
      }
    }
    let minX = w;
    let maxX = 0;
    let minY = h;
    let maxY = 0;
    for (const p of comp) {
      const px = p % w;
      const py = (p - px) / w;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
    // Ground smudges: small, flat, and detached from any leg.
    const flat = maxY - minY < 0.045 * h && (maxX - minX > 2.5 * (maxY - minY) || comp.length < 2500);
    if (comp.length < MIN_COMPONENT || flat) for (const p of comp) out[p] = 0;
  }
  return out;
}

function toRows(data: Buffer, w: number, h: number, COLS: number = DEFAULT_COLS, ROWS: number = DEFAULT_ROWS): string[] {
  const rows: string[] = [];
  for (let cy = 0; cy < ROWS; cy++) {
    const y0 = Math.floor((cy * h) / ROWS);
    const y1 = Math.floor(((cy + 1) * h) / ROWS);
    let line = "";
    for (let cx = 0; cx < COLS; cx++) {
      const x0 = Math.floor((cx * w) / COLS);
      const x1 = Math.floor(((cx + 1) * w) / COLS);
      let on = 0;
      let n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          n++;
          if ((data[y * w + x] as number) > 127) on++;
        }
      }
      line += n > 0 && on / n >= ON_RATIO ? "#" : ".";
    }
    rows.push(line);
  }
  return rows;
}

const HATCH_COLS = 160;
const HATCH_ROWS = 90;
const MIN_RUN_CELLS = 0.8;
/** Rider window around the cap (fractions of crop width) that is cut above the back line. Tune per frame. */
const RIDER_LEFT = 0.21;
const RIDER_RIGHT = 0.115;
const DEFAULT_LIFT = 7; // px below the interpolated back line, so no seat or boot stub survives
const RIDER_OVERRIDES: Record<number, { left?: number; right?: number; lift?: number }> = {};

function columnTop(data: Buffer, w: number, h: number, x: number): number | null {
  for (let y = 0; y < h; y++) if ((data[y * w + x] as number) > 127) return y;
  return null;
}

function median(values: number[]): number {
  const v = [...values].sort((a, b) => a - b);
  return v[Math.floor(v.length / 2)] ?? 0;
}

/** Cuts the jockey: everything above the interpolated back line inside a window around the cap. */
function maskRider(data: Buffer, w: number, h: number, frameIndex: number): { masked: Buffer; removed: Buffer } {
  const o = RIDER_OVERRIDES[frameIndex] ?? {};
  let ty = 0;
  while (ty < h && !Array.from({ length: w }, (_, x) => data[ty * w + x] as number).some((v) => v > 127)) ty++;
  let sx = 0;
  let n = 0;
  for (let y = ty; y < Math.min(h, ty + 10); y++) {
    for (let x = 0; x < w; x++) {
      if ((data[y * w + x] as number) > 127) {
        sx += x;
        n++;
      }
    }
  }
  const cx = n > 0 ? sx / n : w / 2;
  const left = cx - (o.left ?? RIDER_LEFT) * w;
  const right = cx + (o.right ?? RIDER_RIGHT) * w;
  const tops = (a: number, b: number): number[] => {
    const out: number[] = [];
    for (let x = Math.max(0, Math.floor(a)); x < Math.min(w, Math.floor(b)); x++) {
      const t = columnTop(data, w, h, x);
      if (t !== null) out.push(t);
    }
    return out;
  };
  const yL = median(tops(left - 0.13 * w, left));
  const yR = median(tops(right, right + 0.07 * w));
  const masked = Buffer.from(data);
  const removed = Buffer.alloc(w * h);
  for (let x = Math.max(0, Math.floor(left)); x < Math.min(w, Math.floor(right)); x++) {
    const t = (x - left) / (right - left);
    const line = yL + (yR - yL) * t + (o.lift ?? DEFAULT_LIFT);
    for (let y = 0; y < line && y < h; y++) {
      if ((masked[y * w + x] as number) > 127) {
        masked[y * w + x] = 0;
        removed[y * w + x] = 255;
      }
    }
  }
  return { masked, removed };
}

type Run = [number, number];

/** Silhouette runs per cell row on a 160x90 grid, in cell units (1 decimal). */
function hatchRows(data: Buffer, w: number, h: number): Run[][] {
  const rows: Run[][] = [];
  for (let cy = 0; cy < HATCH_ROWS; cy++) {
    const y0 = Math.floor((cy * h) / HATCH_ROWS);
    const y1 = Math.max(y0 + 1, Math.floor(((cy + 1) * h) / HATCH_ROWS));
    const runs: Run[] = [];
    let start = -1;
    for (let x = 0; x <= w; x++) {
      let on = 0;
      if (x < w) for (let y = y0; y < y1; y++) if ((data[y * w + x] as number) > 127) on++;
      const filled = x < w && on / (y1 - y0) >= 0.5;
      if (filled && start < 0) start = x;
      if (!filled && start >= 0) {
        const a = (start / w) * HATCH_COLS;
        const b = (x / w) * HATCH_COLS;
        if (b - a >= MIN_RUN_CELLS) runs.push([Math.round(a * 10) / 10, Math.round(b * 10) / 10]);
        start = -1;
      }
    }
    rows.push(runs);
  }
  return rows;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const showCompact = process.argv.includes("--compact");
  const sheet = args[0];
  const contact = args[1];
  if (!sheet) throw new Error("usage: tsx scripts/rasterize-horse.ts <sheet.jpg> [contact-sheet.png]");
  const frames: string[][] = [];
  const previews: Buffer[] = [];
  let compact: string[] = [];
  const hatch: Run[][][] = [];
  const riderPreviews: Buffer[] = [];
  for (const box of boxes()) {
    const { data, w, h } = await silhouette(sheet, box);
    const { masked, removed } = maskRider(data, w, h, frames.length);
    hatch.push(hatchRows(masked, w, h));
    if (contact) {
      const rgb = Buffer.alloc(w * h * 3);
      for (let i = 0; i < w * h; i++) {
        const horse = (masked[i] as number) > 127;
        const cut = (removed[i] as number) > 127;
        rgb[i * 3] = cut ? 255 : horse ? 255 : 0;
        rgb[i * 3 + 1] = cut ? 40 : horse ? 255 : 0;
        rgb[i * 3 + 2] = cut ? 40 : horse ? 255 : 0;
      }
      riderPreviews.push(await sharp(rgb, { raw: { width: w, height: h, channels: 3 } }).resize(400).png().toBuffer());
    }
    frames.push(toRows(data, w, h));
    if (frames.length - 1 === STATIC_INDEX) compact = toRows(data, w, h, COMPACT_COLS, COMPACT_ROWS);
    if (contact) previews.push(await sharp(data, { raw: { width: w, height: h, channels: 1 } }).resize(400).png().toBuffer());
  }
  if (contact) {
    const cw = 400;
    const ch = Math.round((400 * CROP.h) / CROP.w);
    const cols = 4;
    const composite = previews.map((input, i) => ({ input, left: (i % cols) * (cw + 8), top: Math.floor(i / cols) * (ch + 8) }));
    await sharp({ create: { width: cols * (cw + 8), height: 3 * (ch + 8), channels: 3, background: "#444" } })
      .composite(composite)
      .png()
      .toFile(resolve(contact));
  }

  if (contact) {
    const cw = 400;
    const ch = Math.round((400 * CROP.h) / CROP.w);
    const composite = riderPreviews.map((input, i) => ({ input, left: (i % 4) * (cw + 8), top: Math.floor(i / 4) * (ch + 8) }));
    await sharp({ create: { width: 4 * (cw + 8), height: 3 * (ch + 8), channels: 3, background: "#444" } })
      .composite(composite)
      .png()
      .toFile(resolve(contact.replace(/\.png$/, "-rider.png")));
  }
  const hatchBody = hatch
    .map((f, i) => `  [ // frame ${i + 1}\n${f.map((r) => `    ${JSON.stringify(r)},`).join("\n")}\n  ],`)
    .join("\n");
  writeFileSync(
    resolve("src/data/horse-hatch.ts"),
    `// GENERATED by scripts/rasterize-horse.ts. Do not edit by hand.
// Source: Eadweard Muybridge, "The Horse in Motion" (1878), "Sallie Gardner" frames 1-11, rider masked out.
//   https://commons.wikimedia.org/wiki/File:The_Horse_in_Motion_high_res.jpg
// License: Public domain (Library of Congress Prints and Photographs Division, via Wikimedia Commons).
// Each frame is a list of ${HATCH_ROWS} rows; each row is a list of [xStart, xEnd] silhouette runs in cell units
// on a ${HATCH_COLS}x${HATCH_ROWS} grid.
export type HatchRun = [number, number];
export const HORSE_HATCH: { rows: number; cols: number; frames: HatchRun[][][] } = {
  rows: ${HATCH_ROWS},
  cols: ${HATCH_COLS},
  frames: [
${hatchBody}
  ],
};

/** Index of the fully extended flight frame. */
export const HATCH_STATIC = ${STATIC_INDEX};
`,
  );
  if (showCompact) console.log(compact.join("\n"));
  const body = frames
    .map((f, i) => `  [ // frame ${i + 1}${i === STATIC_INDEX ? " (static)" : ""}\n${f.map((r) => `    "${r}",`).join("\n")}\n  ],`)
    .join("\n");

  const out = `// GENERATED by scripts/rasterize-horse.ts. Do not edit by hand.
// Source: Eadweard Muybridge, "The Horse in Motion" (1878), "Sallie Gardner" frames 1-11.
//   https://commons.wikimedia.org/wiki/File:The_Horse_in_Motion_high_res.jpg
//   https://upload.wikimedia.org/wikipedia/commons/d/d2/The_Horse_in_Motion_high_res.jpg
// License: Public domain (Library of Congress Prints and Photographs Division, via Wikimedia Commons).
// Frame 12 of the sheet (a standing horse) is not part of the gallop and is omitted.
// ${COLS}x${ROWS} cells; a cell is on when at least ${Math.round(ON_RATIO * 100)}% of its source pixels are silhouette.
export const HORSE_FRAMES: string[][] = [
${body}
];

/** Fully extended flight frame: header mark, favicon and "Why kedge?". */
export const HORSE_STATIC: readonly string[] = HORSE_FRAMES[${STATIC_INDEX}] as string[];

/** 32x18 reduction of the static frame, for the favicon (16-32px). */
export const HORSE_COMPACT: readonly string[] = [
${compact.map((r) => `  "${r}",`).join("\n")}
];

export const COLS = HORSE_STATIC[0]?.length ?? 0;
export const ROWS = HORSE_STATIC.length;

for (const [i, f] of HORSE_FRAMES.entries()) {
  if (f.length !== ROWS || f.some((row) => row.length !== COLS)) {
    throw new Error(\`horse frame \${i} is not \${COLS}x\${ROWS}\`);
  }
}

export interface Cell {
  x: number;
  y: number;
}

export function cells(sprite: readonly string[] = HORSE_STATIC): Cell[] {
  const out: Cell[] = [];
  sprite.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === "#") out.push({ x, y });
    });
  });
  return out;
}
`;
  // The 64x36 dot frames are no longer written: the mark is the hatch data in src/data/horse-hatch.ts.
  void out;
  console.log(`wrote ${frames.length} frames, ${COLS}x${ROWS}`);
}

void main();
