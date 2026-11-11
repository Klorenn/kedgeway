// Scout, 2026-11-11. Counts must sum to the number of repos scanned.
export const ECOSYSTEM = {
  date: "2026-11-11",
  total: 5863,
  counts: { supported: 4330, current: 197, deprecated: 1285, unknown: 51 },
} as const;

export type EcoState = keyof typeof ECOSYSTEM.counts;
export const ECO_STATES: readonly EcoState[] = ["supported", "current", "deprecated", "unknown"];

const sum = ECO_STATES.reduce((n, s) => n + ECOSYSTEM.counts[s], 0);
if (sum !== ECOSYSTEM.total) {
  throw new Error(`ecosystem counts sum to ${sum}, expected ${ECOSYSTEM.total}`);
}

export const fmt = (n: number): string => n.toLocaleString("en-US");
