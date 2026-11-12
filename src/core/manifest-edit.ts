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
  const inlineVersion = new RegExp(`((?<![\\w-])version\\s*=\\s*")${fromRe}(")`);
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

// ---- minimal span-preserving JSON scanner (input must already be valid JSON) ----

interface Member {
  key: string;
  keyStart: number;
  keyEnd: number;
  valStart: number;
  valEnd: number;
  /** Present when the value is an object. */
  members?: Member[];
}

class Scanner {
  constructor(private readonly t: string) {}

  private ws(i: number): number {
    while (i < this.t.length && " \t\r\n".includes(this.t[i] as string)) i += 1;
    return i;
  }

  private str(i: number): number {
    let j = i + 1;
    while (this.t[j] !== '"') j += this.t[j] === "\\" ? 2 : 1;
    return j + 1;
  }

  /** Scans a value starting at i (after whitespace); returns its end and, for objects, members. */
  private value(i: number): { end: number; members?: Member[] } {
    const c = this.t[i];
    if (c === '"') return { end: this.str(i) };
    if (c === "{") return this.object(i);
    if (c === "[") {
      let j = this.ws(i + 1);
      if (this.t[j] === "]") return { end: j + 1 };
      for (;;) {
        j = this.ws(this.value(j).end);
        if (this.t[j] === ",") j = this.ws(j + 1);
        else return { end: j + 1 };
      }
    }
    let j = i;
    while (j < this.t.length && !",}] \t\r\n".includes(this.t[j] as string)) j += 1;
    return { end: j };
  }

  object(i: number): { end: number; members: Member[] } {
    const members: Member[] = [];
    let j = this.ws(i + 1);
    if (this.t[j] === "}") return { end: j + 1, members };
    for (;;) {
      const keyStart = j;
      const keyEnd = this.str(j);
      j = this.ws(keyEnd);
      j = this.ws(j + 1); // ':'
      const v = this.value(j);
      members.push({
        key: JSON.parse(this.t.slice(keyStart, keyEnd)) as string,
        keyStart,
        keyEnd,
        valStart: j,
        valEnd: v.end,
        ...(v.members ? { members: v.members } : {}),
      });
      j = this.ws(v.end);
      if (this.t[j] === ",") j = this.ws(j + 1);
      else return { end: j + 1, members };
    }
  }

  root(): Member[] | null {
    const i = this.ws(this.t.startsWith("﻿") ? 1 : 0);
    return this.t[i] === "{" ? this.object(i).members : null;
  }
}

interface Edit {
  start: number;
  end: number;
  text: string;
}

const DEP_SECTIONS = ["dependencies", "devDependencies"] as const;
const OTHER_SECTIONS = ["peerDependencies", "optionalDependencies", "overrides", "resolutions"] as const;

function stringValue(text: string, m: Member): string | null {
  const raw = text.slice(m.valStart, m.valEnd);
  if (!raw.startsWith('"')) return null;
  return JSON.parse(raw) as string;
}

function editsForStep(text: string, root: Member[], step: MigrationStep): Edit[] {
  const edits: Edit[] = [];
  for (const section of root.filter((m) => (DEP_SECTIONS as readonly string[]).includes(m.key) && m.members)) {
    const members = section.members as Member[];
    for (const [idx, m] of members.entries()) {
      if (m.key !== step.dependency || stringValue(text, m) !== step.from) continue;
      if (step.kind === "bump-js-dep") {
        edits.push({ start: m.valStart, end: m.valEnd, text: JSON.stringify(step.to) });
      } else if (step.kind === "replace-legacy-package" && step.replacement) {
        const exists = members.some((o) => o.key === step.replacement);
        if (!exists) {
          edits.push({ start: m.keyStart, end: m.keyEnd, text: JSON.stringify(step.replacement) });
          edits.push({ start: m.valStart, end: m.valEnd, text: JSON.stringify(step.to) });
        } else if (idx < members.length - 1) {
          edits.push({ start: m.keyStart, end: (members[idx + 1] as Member).keyStart, text: "" });
        } else if (idx > 0) {
          edits.push({ start: (members[idx - 1] as Member).valEnd, end: m.valEnd, text: "" });
        } else {
          edits.push({ start: m.keyStart, end: m.valEnd, text: "" });
        }
      }
    }
  }
  return edits;
}

function declaredElsewhere(text: string, root: Member[], dependency: string): string | null {
  for (const section of root) {
    if (!(OTHER_SECTIONS as readonly string[]).includes(section.key)) continue;
    if (section.members?.some((m) => m.key === dependency)) return section.key;
  }
  return null;
}

/**
 * Applies bump-js-dep / replace-legacy-package steps by editing only the affected spans of the
 * original text. Everything else (indent, EOLs, BOM, number formatting, escapes, key order,
 * minification) is preserved byte for byte.
 */
export function editPackageJson(text: string, steps: MigrationStep[]): JsonEditResult {
  try {
    JSON.parse(text.replace(/^﻿/, ""));
  } catch (e) {
    const reason = `could not parse package.json: ${e instanceof Error ? e.message : String(e)}`;
    return { text, applied: [], skipped: steps.map((step) => ({ step, reason })) };
  }
  let current = text;
  const applied: MigrationStep[] = [];
  const skipped: JsonEditResult["skipped"] = [];

  for (const step of steps) {
    const root = new Scanner(current).root();
    if (!root) {
      skipped.push({ step, reason: "could not parse package.json: not an object" });
      continue;
    }
    const edits = editsForStep(current, root, step);
    if (edits.length === 0) {
      const other = declaredElsewhere(current, root, step.dependency);
      skipped.push({
        step,
        reason: other
          ? `${step.dependency} is declared outside dependencies/devDependencies (in ${other}); edit manually`
          : `${step.dependency} ${step.from} not found (file changed since the plan?)`,
      });
      continue;
    }
    for (const e of edits.sort((a, b) => b.start - a.start)) {
      current = current.slice(0, e.start) + e.text + current.slice(e.end);
    }
    applied.push(step);
  }
  return { text: current, applied, skipped };
}

/**
 * 1-based line of each member of the TOP-LEVEL `dependencies` / `devDependencies` objects, found with the
 * span-aware scanner (never a text search, so `overrides.dependencies` and the like cannot be mistaken
 * for them). The text must be valid JSON.
 */
export function packageJsonDepLines(text: string): Record<"dependencies" | "devDependencies", Map<string, number>> {
  const out = { dependencies: new Map<string, number>(), devDependencies: new Map<string, number>() };
  const root = new Scanner(text).root();
  if (!root) return out;
  const lineAt = (offset: number): number => {
    let n = 1;
    for (let i = 0; i < offset; i += 1) if (text[i] === "\n") n += 1;
    return n;
  };
  for (const section of root) {
    if (section.key !== "dependencies" && section.key !== "devDependencies") continue;
    const map = out[section.key];
    for (const m of section.members ?? []) if (!map.has(m.key)) map.set(m.key, lineAt(m.keyStart));
  }
  return out;
}
