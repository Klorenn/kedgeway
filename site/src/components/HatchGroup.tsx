import { hatchGeometry, type HatchOptions } from "@/lib/hatch";

interface HatchGroupProps extends HatchOptions {
  frame: number;
  color?: string;
}

/** SVG strokes for one hatch frame, in grid-cell units. Render inside an <svg> with a matching viewBox. */
export default function HatchGroup({ frame, color = "var(--ink)", weight = 1, trails = true, rows, fine = false }: HatchGroupProps) {
  const g = hatchGeometry(frame, { weight, trails, rows, fine });
  return (
    <g fill="none" stroke={color} strokeLinecap="round">
      {g.trails.length > 0 ? (
        <g opacity="0.35">
          {g.trails.map((t) => (
            <path key={`t${t.width}`} d={t.d} strokeWidth={t.width} />
          ))}
        </g>
      ) : null}
      {g.main.map((m) => (
        <path key={`m${m.width}`} d={m.d} strokeWidth={m.width} />
      ))}
    </g>
  );
}
