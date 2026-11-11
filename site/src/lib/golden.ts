export const PHI = (1 + Math.sqrt(5)) / 2;
/** Where a golden spiral ends, as a fraction of the rectangle (after flipping to start at the top-left). */
const FOCUS_X = 0.7236067977;
const FOCUS_Y = 0.2763932023;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Construction {
  rect: Rect;
  /** Dividing lines between the successive squares: [x1, y1, x2, y2]. */
  dividers: [number, number, number, number][];
  /** SVG path of the spiral; starts at the top-left corner and ends at the focus. */
  spiral: string;
  focus: [number, number];
}

/**
 * Golden rectangle (landscape) with its square subdivision and Fibonacci spiral.
 * The spiral starts at the top-left corner and winds clockwise to a focus at
 * (72.4%, 27.6%) of the rectangle, so the focus can be placed on the horse's eye.
 */
export function goldenConstruction(rect: Rect, depth = 9): Construction {
  const scale = rect.h; // unit rectangle is PHI x 1
  const toWorld = (x: number, y: number): [number, number] => [rect.x + x * scale, rect.y + (1 - y) * scale];

  // Square sides and dividers in the canonical frame (start bottom-left, clockwise).
  const dirs = ["left", "top", "right", "bottom"] as const;
  let cur: Rect = { x: 0, y: 0, w: PHI, h: 1 };
  const sides: number[] = [];
  const dividers: [number, number, number, number][] = [];
  for (let i = 0; i < depth + 2; i++) {
    const s = Math.min(cur.w, cur.h);
    sides.push(s);
    const d = dirs[i % 4];
    if (i < depth) {
      if (d === "left") dividers.push([cur.x + s, cur.y, cur.x + s, cur.y + cur.h]);
      else if (d === "top") dividers.push([cur.x, cur.y + s, cur.x + cur.w, cur.y + s]);
      else if (d === "right") dividers.push([cur.x + cur.w - s, cur.y, cur.x + cur.w - s, cur.y + cur.h]);
      else dividers.push([cur.x, cur.y + cur.h - s, cur.x + cur.w, cur.y + cur.h - s]);
    }
    if (d === "left") cur = { x: cur.x + s, y: cur.y, w: cur.w - s, h: cur.h };
    else if (d === "top") cur = { x: cur.x, y: cur.y + s, w: cur.w, h: cur.h - s };
    else if (d === "right") cur = { x: cur.x, y: cur.y, w: cur.w - s, h: cur.h };
    else cur = { x: cur.x, y: cur.y, w: cur.w, h: cur.h - s };
  }

  let c: [number, number] = [sides[0] as number, 1];
  let theta = Math.PI;
  const start = toWorld(0, 1);
  let d = `M${start[0].toFixed(2)} ${start[1].toFixed(2)}`;
  for (let i = 0; i < depth; i++) {
    const s = sides[i] as number;
    const end = theta + Math.PI / 2;
    const e: [number, number] = [c[0] + s * Math.cos(end), c[1] + s * Math.sin(end)];
    const ew = toWorld(e[0], e[1]);
    // The canonical arc is clockwise on a y-down screen; the vertical flip makes it counter-clockwise.
    d += `A${(s * scale).toFixed(2)} ${(s * scale).toFixed(2)} 0 0 0 ${ew[0].toFixed(2)} ${ew[1].toFixed(2)}`;
    const next = sides[i + 1] as number;
    c = [e[0] - next * Math.cos(end), e[1] - next * Math.sin(end)];
    theta = end;
  }

  const worldDividers = dividers.map(([x1, y1, x2, y2]): [number, number, number, number] => {
    const a = toWorld(x1, y1);
    const b = toWorld(x2, y2);
    return [a[0], a[1], b[0], b[1]];
  });
  return {
    rect,
    dividers: worldDividers,
    spiral: d,
    focus: [rect.x + FOCUS_X * rect.w, rect.y + FOCUS_Y * rect.h],
  };
}

/** Golden rectangle placed so the spiral focus lands on `eye` and the bottom edge meets `bottom`. */
export function rectForEye(eye: readonly [number, number], bottom: number, leftLimit: number): Rect {
  const hFromBottom = (bottom - eye[1]) / (1 - FOCUS_Y);
  const hFromLeft = (eye[0] - leftLimit) / FOCUS_X / PHI;
  const h = Math.max(hFromBottom, hFromLeft);
  const w = h * PHI;
  return { x: eye[0] - FOCUS_X * w, y: eye[1] - FOCUS_Y * h, w, h };
}
