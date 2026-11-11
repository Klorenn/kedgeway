import HatchGroup from "./HatchGroup";
import { STATIC_FRAME } from "@/lib/hatch";

interface HorseMarkProps {
  /** Rendered width in px. Small sizes get heavier strokes so the hatch does not vanish. */
  size?: number;
  color?: string;
}

// Tight box around the static frame (cells): x 12.8-149.2, y 20-89.5.
const BOX = { x: 11, y: 18.5, w: 140, h: 72 };

/** Static hatch horse (extended gallop frame, rider masked out). */
export default function HorseMark({ size = 40, color = "var(--ink)" }: HorseMarkProps) {
  const small = size < 120;
  return (
    <svg
      width={size}
      height={(size * BOX.h) / BOX.w}
      viewBox={`${BOX.x} ${BOX.y} ${BOX.w} ${BOX.h}`}
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", flex: "none" }}
    >
      <HatchGroup frame={STATIC_FRAME} color={color} weight={small ? 3.2 : 1} trails={!small} />
    </svg>
  );
}
