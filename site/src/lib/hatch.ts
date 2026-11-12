import { HATCH_STATIC, HORSE_HATCH, type HatchRun } from "@/data/horse-hatch";

export const HATCH_COLS = HORSE_HATCH.cols;
export const HATCH_ROWS = HORSE_HATCH.rows;
export const HATCH_FRAME_COUNT = HORSE_HATCH.frames.length;
export const STATIC_FRAME = HATCH_STATIC;

/** Where the eye sits on the static frame, in grid cells. Used to land the spiral on it. */
export const EYE: readonly [number, number] = [127, 26.5];
/** Lowest row of the horse (hooves touch the bottom of the crop). */
export const HORSE_BOTTOM = 89.5;

export interface StrokeGroup {
  width: number;
  d: string;
}
export interface HatchGeometry {
  main: StrokeGroup[];
  trails: StrokeGroup[];
}
export interface HatchOptions {
  /** Multiplies stroke weight. Use more than 1 when the mark is rendered small. */
  weight?: number;
  /** Trailing streaks to the left of each row. */
  trails?: boolean;
  /** Draw these rows instead of one of the gallop frames (for example the standing horse). */
  rows?: HatchRun[][];
}

function rng(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const n2 = (n: number): string => n.toFixed(2);

/** One frame as horizontal dry-brush strokes. Deterministic: same frame, same strokes. */
export function hatchGeometry(frame: number, { weight = 1, trails = true, rows: rowsOverride }: HatchOptions = {}): HatchGeometry {
  const rows: HatchRun[][] = rowsOverride ?? HORSE_HATCH.frames[frame] ?? [];
  const filled = rows.map((r, i) => (r.length > 0 ? i : -1)).filter((i) => i >= 0);
  const first = filled[0] ?? 0;
  const last = filled[filled.length - 1] ?? 0;
  const trailFrom = first + (last - first) * 0.3;
  const trailTo = first + (last - first) * 0.75;

  const main = new Map<number, string[]>();
  const trail = new Map<number, string[]>();
  const push = (m: Map<number, string[]>, w: number, seg: string): void => {
    const list = m.get(w);
    if (list) list.push(seg);
    else m.set(w, [seg]);
  };

  rows.forEach((runs, row) => {
    if (runs.length === 0) return;
    const r = rng(frame * 1009 + row * 31 + 7);
    const w = Math.round((0.8 + r() * 0.6) * weight * 10) / 10;
    const y = row + 0.5 + (r() - 0.5) * 0.4;
    for (const [a, b] of runs) {
      const len = b - a;
      if (len > 24 && r() < 0.5) {
        const cut = a + len * (0.35 + 0.3 * r());
        push(main, w, `M${n2(a)} ${n2(y)}H${n2(cut - 0.6)}`);
        push(main, w, `M${n2(cut + 0.6)} ${n2(y + (r() - 0.5) * 0.3)}H${n2(b)}`);
      } else {
        push(main, w, `M${n2(a)} ${n2(y)}H${n2(b)}`);
      }
    }
    if (trails) {
      const startX = Math.min(...runs.map((run) => run[0]));
      const inBand = row >= trailFrom && row <= trailTo;
      const count = inBand ? 1 + (r() < 0.55 ? 1 : 0) : 0;
      for (let k = 0; k < count; k++) {
        const len = 6 + r() * 8;
        const gap = 0.8 + r() * 2.2;
        const ty = y + (r() - 0.5) * 1.2;
        const tw = Math.round((0.25 + r() * 0.2) * Math.max(1, weight * 0.5) * 20) / 20;
        const x2 = startX - gap;
        push(trail, tw, `M${n2(x2 - len)} ${n2(ty)}H${n2(x2)}`);
      }
    }
  });

  const flat = (m: Map<number, string[]>): StrokeGroup[] => [...m.entries()].map(([width, segs]) => ({ width, d: segs.join("") }));
  return { main: flat(main), trails: flat(trail) };
}
