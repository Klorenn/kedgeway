import type { MigrationStep } from "./migration.js";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const DEP_TABLE = /^\[\s*(?:workspace\.|target\.[^\]]+\.)?(?:dev-|build-)?dependencies\s*\]/;
const DEP_SUBTABLE = /^\[\s*(?:workspace\.|target\.[^\]]+\.)?(?:dev-|build-)?dependencies\.("[^"]+"|[A-Za-z0-9_-]+)\s*\]/;
const ENTRY = /^(\s*)("[^"]+"|[A-Za-z0-9_-]+)(\s*=\s*)(.*)$/;

function unquote(key: string): string {
  return key.startsWith('"') ? key.slice(1, -1) : key;
}

function splitLines(text: string): string[] {
  return text.match(/[^\n]*\n|[^\n]+/g) ?? [];
}

/**
 * Minimal, line-targeted edit of every `soroban-sdk` dependency declared as `from`.
 * Only the quoted version string changes; all other bytes (comments, spacing, EOLs) are kept.
 */
export function bumpCargoDep(text: string, from: string, to: string): { text: string; count: number } {
  const lines = splitLines(text);
  const fromRe = escapeRegExp(from);
  const inlineVersion = new RegExp(`(\\bversion\\s*=\\s*")${fromRe}(")`);
  let count = 0;

  // Pass 1: find sub-table sections ([dependencies.<key>]) and decide per section.
  type Mode = { kind: "none" } | { kind: "table" } | { kind: "sub"; start: number; key: string };
  let mode = { kind: "none" } as Mode;
  const subSections: { start: number; end: number; key: string }[] = [];
  for (const [idx, raw] of lines.entries()) {
    const line = raw.replace(/\r?\n$/, "");
    if (!line.trimStart().startsWith("[")) continue;
    if (mode.kind === "sub") subSections.push({ start: mode.start, end: idx, key: mode.key });
    const sub = DEP_SUBTABLE.exec(line.trim());
    if (sub) mode = { kind: "sub", start: idx, key: unquote(sub[1] ?? "") };
    else if (DEP_TABLE.test(line.trim())) mode = { kind: "table" };
    else mode = { kind: "none" };
  }
  if (mode.kind === "sub") subSections.push({ start: mode.start, end: lines.length, key: mode.key });

  const out = lines.slice();
  for (const sec of subSections) {
    const body = lines.slice(sec.start + 1, sec.end).join("");
    if (/^\s*workspace\s*=\s*true/m.test(body)) continue;
    const pkg = /^\s*package\s*=\s*"([^"]+)"/m.exec(body)?.[1];
    if ((pkg ?? sec.key) !== "soroban-sdk") continue;
    for (let i = sec.start + 1; i < sec.end; i += 1) {
      const l = out[i] as string;
      const re = new RegExp(`^(\\s*version\\s*=\\s*")${fromRe}(")`);
      if (re.test(l)) {
        out[i] = l.replace(re, `$1${to}$2`);
        count += 1;
      }
    }
  }

  // Pass 2: entries inside plain dependency tables.
  let inTable = false;
  for (const [idx, raw] of out.entries()) {
    const line = raw.replace(/\r?\n$/, "");
    if (line.trimStart().startsWith("[")) {
      inTable = DEP_TABLE.test(line.trim());
      continue;
    }
    if (!inTable) continue;
    const m = ENTRY.exec(line);
    if (!m) continue;
    const key = unquote(m[2] ?? "");
    const value = m[4] ?? "";
    if (value.startsWith("{")) {
      if (/\bworkspace\s*=\s*true/.test(value)) continue;
      const pkg = /\bpackage\s*=\s*"([^"]+)"/.exec(value)?.[1];
      if ((pkg ?? key) !== "soroban-sdk" || !inlineVersion.test(value)) continue;
      out[idx] = raw.replace(inlineVersion, `$1${to}$2`);
      count += 1;
    } else if (key === "soroban-sdk") {
      const str = new RegExp(`^"${fromRe}"`);
      if (str.test(value)) {
        const prefix = `${m[1] ?? ""}${m[2] ?? ""}${m[3] ?? ""}`;
        out[idx] = `${prefix}"${to}"${raw.slice(prefix.length + from.length + 2)}`;
        count += 1;
      }
    }
  }

  return { text: out.join(""), count };
}

export interface JsonEditResult {
  text: string;
  applied: MigrationStep[];
  skipped: { step: MigrationStep; reason: string }[];
}

const DEP_SECTIONS = ["dependencies", "devDependencies"] as const;

/** Applies bump-js-dep / replace-legacy-package steps, preserving key order, indent and EOL style. */
export function editPackageJson(text: string, steps: MigrationStep[]): JsonEditResult {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch (e) {
    const reason = `could not parse package.json: ${e instanceof Error ? e.message : String(e)}`;
    return { text, applied: [], skipped: steps.map((step) => ({ step, reason })) };
  }
  if (typeof doc !== "object" || doc === null || Array.isArray(doc)) {
    return { text, applied: [], skipped: steps.map((step) => ({ step, reason: "could not parse package.json: not an object" })) };
  }
  const root = doc as Record<string, unknown>;
  const applied: MigrationStep[] = [];
  const skipped: JsonEditResult["skipped"] = [];

  for (const step of steps) {
    let hit = false;
    for (const section of DEP_SECTIONS) {
      const table = root[section];
      if (typeof table !== "object" || table === null || Array.isArray(table)) continue;
      const deps = table as Record<string, unknown>;
      if (deps[step.dependency] !== step.from) continue;
      hit = true;
      if (step.kind === "bump-js-dep") {
        deps[step.dependency] = step.to;
      } else if (step.kind === "replace-legacy-package" && step.replacement) {
        const replacement = step.replacement;
        const exists = replacement in deps;
        const entries = Object.entries(deps).flatMap(([k, v]): [string, unknown][] =>
          k === step.dependency ? (exists ? [] : [[replacement, step.to]]) : [[k, v]],
        );
        root[section] = Object.fromEntries(entries);
      }
    }
    if (hit) applied.push(step);
    else skipped.push({ step, reason: `${step.dependency} ${step.from} not found (file changed since the plan?)` });
  }

  if (applied.length === 0) return { text, applied, skipped };

  const indent = /^([ \t]+)"/m.exec(text)?.[1] ?? "  ";
  let next = JSON.stringify(root, null, indent);
  if (text.endsWith("\n")) next += "\n";
  if (text.includes("\r\n")) next = next.replace(/\r?\n/g, "\r\n");
  return { text: next, applied, skipped };
}
