type Op = { kind: " " | "-" | "+"; text: string };

function lines(text: string): string[] {
  if (text === "") return [];
  const parts = text.split("\n");
  if (parts[parts.length - 1] === "") parts.pop();
  return parts;
}

function diffOps(a: string[], b: string[]): Op[] {
  const n = a.length;
  const m = b.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      const row = lcs[i] as number[];
      row[j] = a[i] === b[j] ? (lcs[i + 1]?.[j + 1] ?? 0) + 1 : Math.max(lcs[i + 1]?.[j] ?? 0, row[j + 1] ?? 0);
    }
  }
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ kind: " ", text: a[i] as string });
      i += 1;
      j += 1;
    } else if ((lcs[i + 1]?.[j] ?? 0) >= (lcs[i]?.[j + 1] ?? 0)) {
      ops.push({ kind: "-", text: a[i] as string });
      i += 1;
    } else {
      ops.push({ kind: "+", text: b[j] as string });
      j += 1;
    }
  }
  while (i < n) ops.push({ kind: "-", text: a[i++] as string });
  while (j < m) ops.push({ kind: "+", text: b[j++] as string });
  return ops;
}

/** Minimal unified diff (3 lines of context). Returns "" when there is no change. */
export function unifiedDiff(path: string, before: string, after: string, context = 3): string {
  if (before === after) return "";
  const ops = diffOps(lines(before), lines(after));
  const changed = ops.map((o, idx) => (o.kind === " " ? -1 : idx)).filter((idx) => idx >= 0);
  if (changed.length === 0) return "";

  // Group change indexes into hunks separated by more than 2*context unchanged lines.
  const groups: [number, number][] = [];
  for (const idx of changed) {
    const last = groups[groups.length - 1];
    if (last && idx - last[1] <= 2 * context + 1) last[1] = idx;
    else groups.push([idx, idx]);
  }

  const out: string[] = [`--- a/${path}`, `+++ b/${path}`];
  for (const [first, last] of groups) {
    const start = Math.max(0, first - context);
    const end = Math.min(ops.length - 1, last + context);
    let oldStart = 1;
    let newStart = 1;
    for (let k = 0; k < start; k += 1) {
      if (ops[k]?.kind !== "+") oldStart += 1;
      if (ops[k]?.kind !== "-") newStart += 1;
    }
    let oldLen = 0;
    let newLen = 0;
    const body: string[] = [];
    for (let k = start; k <= end; k += 1) {
      const op = ops[k] as Op;
      if (op.kind !== "+") oldLen += 1;
      if (op.kind !== "-") newLen += 1;
      body.push(`${op.kind}${op.text}`);
    }
    out.push(`@@ -${oldStart},${oldLen} +${newStart},${newLen} @@`, ...body);
  }
  return `${out.join("\n")}\n`;
}
