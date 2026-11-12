const UNIT_MS: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

/** Parses `30s`, `15m`, `24h` or `2d` into milliseconds; null when the text is not a duration. */
export function parseDuration(text: string): number | null {
  const m = /^(\d+)([smhd])$/.exec(text);
  if (!m || m[1] === undefined || m[2] === undefined) return null;
  return Number.parseInt(m[1], 10) * (UNIT_MS[m[2]] ?? 0);
}
