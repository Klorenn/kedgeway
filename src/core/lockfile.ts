import { parse as parseToml } from "smol-toml";
import semver from "semver";

export type LockfileKind = "Cargo.lock" | "package-lock.json" | "pnpm-lock.yaml" | "yarn.lock";

/** What to look up: the DIRECT dependency as the manifest declares it. */
export interface LockQuery {
  name: string;
  /** The manifest's raw requirement ("" when unknown). */
  raw: string;
  /** Manifest directory relative to the lockfile's directory ("." when the same). */
  importer: string;
}

/** A pinned version, an "ambiguous" note (no single entry can be attributed), or null (nothing about it). */
export type LockResult = { version: string } | { note: string } | null;

export interface LockIndex {
  resolve(q: LockQuery): LockResult;
}

// ---------- versions ----------

function idCompare(a: string, b: string): number {
  const an = /^\d+$/.test(a);
  const bn = /^\d+$/.test(b);
  if (an && bn) return Math.sign(Number.parseInt(a, 10) - Number.parseInt(b, 10));
  if (an) return -1; // numeric identifiers rank below alphanumeric ones
  if (bn) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Semver ordering: numeric core, a prerelease ranks below its release, prerelease ids compared one by one. */
export function compareVersions(a: string, b: string): number {
  const [ac = "", ...ar] = a.split("-");
  const [bc = "", ...br] = b.split("-");
  const an = ac.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const bn = bc.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(an.length, bn.length); i += 1) {
    const d = (an[i] ?? 0) - (bn[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  const ap = ar.length > 0 ? ar.join("-") : null;
  const bp = br.length > 0 ? br.join("-") : null;
  if (ap === bp) return 0;
  if (ap === null) return 1;
  if (bp === null) return -1;
  const ai = ap.split(".");
  const bi = bp.split(".");
  for (let i = 0; i < Math.max(ai.length, bi.length); i += 1) {
    const x = ai[i];
    const y = bi[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const c = idCompare(x, y);
    if (c !== 0) return c;
  }
  return 0;
}

type Triple = [number, number, number];
const cmp3 = (a: Triple, b: Triple): number => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

interface Partial3 {
  major: number | null;
  minor: number | null;
  patch: number | null;
}

function parsePartial(s: string): Partial3 | null {
  const m = /^[vV]?(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.exec(s);
  if (!m) return null;
  const n = (t: string | undefined): number | null => (t === undefined || /^[xX*]$/.test(t) ? null : Number.parseInt(t, 10));
  const major = n(m[1]);
  const minor = major === null ? null : n(m[2]);
  const patch = minor === null ? null : n(m[3]);
  return { major, minor, patch };
}

/** [lo, hi) bounds of a comparator; hi null means unbounded. */
function bounds(op: string, p: Partial3, bare: "caret" | "exact"): { lo: Triple | null; hi: Triple | null; exact?: boolean } {
  const { major, minor, patch } = p;
  if (major === null) return { lo: null, hi: null };
  const lo: Triple = [major, minor ?? 0, patch ?? 0];
  const effective = op === "" ? (bare === "caret" ? "^" : "=") : op;
  switch (effective) {
    case "^": {
      const hi: Triple =
        major !== 0 || minor === null ? [major + 1, 0, 0] : minor !== 0 || patch === null ? [0, minor + 1, 0] : [0, 0, patch + 1];
      return { lo, hi };
    }
    case "~":
      return { lo, hi: minor === null ? [major + 1, 0, 0] : [major, minor + 1, 0] };
    default: // "="
      if (minor === null) return { lo, hi: [major + 1, 0, 0] };
      if (patch === null) return { lo, hi: [major, minor + 1, 0] };
      return { lo, hi: null, exact: true };
  }
}

function matchesComparator(v: Triple, op: string, p: Partial3, bare: "caret" | "exact"): boolean {
  if (p.major === null) return true;
  const lo: Triple = [p.major, p.minor ?? 0, p.patch ?? 0];
  if (op === ">=") return cmp3(v, lo) >= 0;
  if (op === "<") return cmp3(v, lo) < 0;
  const full = p.minor !== null && p.patch !== null;
  const next: Triple = p.minor === null ? [p.major + 1, 0, 0] : p.patch === null ? [p.major, p.minor + 1, 0] : lo;
  if (op === ">") return full ? cmp3(v, lo) > 0 : cmp3(v, next) >= 0;
  if (op === "<=") return full ? cmp3(v, lo) <= 0 : cmp3(v, next) < 0;
  const b = bounds(op, p, bare);
  if (b.exact) return cmp3(v, lo) === 0;
  return (b.lo === null || cmp3(v, b.lo) >= 0) && (b.hi === null || cmp3(v, b.hi) < 0);
}

/**
 * Does `version` satisfy the requirement `range`?
 * - `bare: "exact"` is npm: delegated to `semver.satisfies` (hyphen ranges, `||`, x-ranges). Prerelease candidates
 *   follow npm rules (a prerelease only satisfies a range that names a prerelease of the same major.minor.patch;
 *   no `includePrerelease`).
 * - `bare: "caret"` is Cargo: custom (a plain `1.2.3` is `^1.2.3`; `^ ~ = >= > <= <`, `*`, wildcards, comma
 *   separated comparators). Prerelease tags on the candidate are ignored.
 */
export function satisfies(version: string, range: string, bare: "caret" | "exact"): boolean {
  if (bare === "exact") return semver.satisfies(version, range);
  const vm = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!vm) return false;
  const v: Triple = [Number(vm[1]), Number(vm[2]), Number(vm[3])];
  return range.split("||").some((alt) => {
    const text = alt.trim();
    if (text === "" || text === "*") return true;
    const tokens = [...text.matchAll(/(\^|~|>=|<=|>|<|=)?\s*([vV]?[0-9xX*][^\s,]*)/g)];
    if (tokens.length === 0) return false;
    return tokens.every((t) => {
      const p = parsePartial(t[2] ?? "");
      return p !== null && matchesComparator(v, t[1] ?? "", p, bare);
    });
  });
}

// ---------- helpers ----------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function unique(list: string[]): string[] {
  return [...new Set(list)].sort(compareVersions);
}

/** One matching version, or an "ambiguous" note when none or several qualify. */
function pickOne(kind: LockfileKind, q: LockQuery, versions: string[], bare: "caret" | "exact"): LockResult {
  const all = unique(versions);
  if (all.length === 0) return null;
  if (q.raw === "") {
    return all.length === 1 && all[0] !== undefined
      ? { version: all[0] }
      : { note: `ambiguous in ${kind}: ${q.name} has several entries (${all.join(", ")}) and the manifest gives no requirement` };
  }
  const ok = all.filter((v) => satisfies(v, q.raw, bare));
  if (ok.length === 1 && ok[0] !== undefined) return { version: ok[0] };
  return {
    note:
      ok.length === 0
        ? `ambiguous in ${kind}: no ${q.name} entry satisfies ${q.raw} (found ${all.join(", ")})`
        : `ambiguous in ${kind}: ${ok.join(", ")} all satisfy ${q.raw} for ${q.name}`,
  };
}

function cleanPnpmVersion(v: string): string | null {
  const m = /^(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)(?=$|[(_\s])/.exec(v.trim().replace(/^['"]|['"]$/g, ""));
  return m?.[1] ?? null;
}

// ---------- Cargo.lock ----------

function indexCargoLock(content: string, names: readonly string[]): LockIndex {
  const entries: { name: string; version: string }[] = [];
  try {
    const doc: unknown = parseToml(content);
    if (isRecord(doc) && Array.isArray(doc["package"])) {
      for (const p of doc["package"] as unknown[]) {
        if (isRecord(p) && typeof p["name"] === "string" && typeof p["version"] === "string" && names.includes(p["name"])) {
          entries.push({ name: p["name"], version: p["version"] });
        }
      }
    }
  } catch {
    // corrupt lockfile: no entries
  }
  return {
    resolve: (q) =>
      pickOne("Cargo.lock", q, entries.filter((e) => e.name === q.name).map((e) => e.version), "caret"),
  };
}

// ---------- package-lock.json ----------

function indexPackageLock(content: string, names: readonly string[]): LockIndex {
  const out = new Map<string, string>();
  try {
    const doc: unknown = JSON.parse(content);
    if (isRecord(doc)) {
      const packages = isRecord(doc["packages"]) ? doc["packages"] : {};
      const legacy = isRecord(doc["dependencies"]) ? doc["dependencies"] : {};
      for (const name of names) {
        const v2 = packages[`node_modules/${name}`];
        const v1 = legacy[name];
        const entry = isRecord(v2) ? v2 : isRecord(v1) ? v1 : undefined;
        if (entry && typeof entry["version"] === "string") out.set(name, entry["version"]);
      }
    }
  } catch {
    // corrupt lockfile: nothing resolved
  }
  return {
    resolve: (q) => {
      const version = out.get(q.name);
      return version === undefined ? null : { version };
    },
  };
}

// ---------- pnpm-lock.yaml ----------

interface YNode {
  value: string | null;
  children: Map<string, YNode>;
}

const PNPM_SECTIONS = new Set(["importers", "dependencies", "devDependencies", "optionalDependencies", "packages", "snapshots"]);
const LINE_KEY = /^( *)(?:'([^']*)'|"([^"]*)"|([^\s:'"#-][^:]*?|-[^\s:][^:]*?)):(?:\s+(.*?))?\s*$/;

/** Minimal indentation-based reader for the mapping parts of pnpm-lock.yaml we need. */
function readPnpm(content: string): YNode {
  const root: YNode = { value: null, children: new Map() };
  const stack: { indent: number; node: YNode }[] = [{ indent: -1, node: root }];
  let section = "";
  for (const line of content.split(/\r?\n/)) {
    const m = LINE_KEY.exec(line);
    if (!m) continue;
    const indent = (m[1] ?? "").length;
    const key = m[2] ?? m[3] ?? m[4] ?? "";
    if (indent === 0) section = key;
    if (!PNPM_SECTIONS.has(section)) continue;
    if ((section === "packages" || section === "snapshots") && indent > 2) continue;
    while (stack.length > 1 && (stack[stack.length - 1]?.indent ?? -1) >= indent) stack.pop();
    const parent = stack[stack.length - 1]?.node ?? root;
    const node: YNode = { value: m[5] === undefined ? null : m[5].replace(/\s+#.*$/, ""), children: new Map() };
    parent.children.set(key, node);
    stack.push({ indent, node });
  }
  return root;
}

function indexPnpmLock(content: string, names: readonly string[]): LockIndex {
  const tree = readPnpm(content);
  const sections = ["dependencies", "devDependencies", "optionalDependencies"];
  const direct = (holder: YNode | undefined, name: string): string | null => {
    for (const s of sections) {
      const entry = holder?.children.get(s)?.children.get(name);
      if (!entry) continue;
      const v = cleanPnpmVersion(entry.children.get("version")?.value ?? entry.value ?? "");
      if (v !== null) return v;
    }
    return null;
  };
  const packageVersions = (name: string): string[] => {
    const re = new RegExp(`^/?${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[@/](\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?)(?:$|[(_])`);
    const found: string[] = [];
    for (const section of ["packages", "snapshots"]) {
      for (const key of tree.children.get(section)?.children.keys() ?? []) {
        const m = re.exec(key);
        if (m?.[1] !== undefined) found.push(m[1]);
      }
    }
    return found;
  };
  return {
    resolve: (q) => {
      if (!names.includes(q.name)) return null;
      const importers = tree.children.get("importers");
      const holder = importers ? importers.children.get(q.importer) : q.importer === "." ? tree : undefined;
      const v = direct(holder, q.name);
      if (v !== null) return { version: v };
      return pickOne("pnpm-lock.yaml", q, packageVersions(q.name), "exact");
    },
  };
}

// ---------- yarn.lock ----------

function specName(spec: string): string {
  const at = spec.indexOf("@", 1);
  return at === -1 ? spec : spec.slice(0, at);
}

/** Minimal, line-based: yarn classic (`version "x"`) and berry (`version: x`, `resolution:`). */
function indexYarnLock(content: string, names: readonly string[]): LockIndex {
  const blocks: { specs: Set<string>; version: string }[] = [];
  let specs: string[] = [];
  let version: string | null = null;
  const flush = (): void => {
    if (specs.length > 0 && version !== null) blocks.push({ specs: new Set(specs), version });
    specs = [];
    version = null;
  };
  for (const line of content.split(/\r?\n/)) {
    if (line === "" || line.startsWith("#")) continue;
    if (/^\S/.test(line)) {
      flush();
      specs = line.endsWith(":")
        ? line
            .slice(0, -1)
            .split(",")
            .map((s) => s.trim().replace(/^["']|["']$/g, ""))
            .filter((s) => names.includes(specName(s)))
        : [];
      continue;
    }
    if (specs.length === 0) continue;
    const v = /^ {2}version:?\s+"?([^"\s]+)"?\s*$/.exec(line);
    if (v?.[1] !== undefined) version = v[1];
    const r = /^ {2}resolution:\s+"?[^"\s]*@npm:([^"\s]+)"?\s*$/.exec(line);
    if (r?.[1] !== undefined && version === null) version = r[1];
  }
  flush();
  return {
    resolve: (q) => {
      const wanted = [`${q.name}@${q.raw}`, `${q.name}@npm:${q.raw}`];
      const hit = blocks.find((b) => wanted.some((w) => b.specs.has(w)));
      return hit ? { version: hit.version } : null;
    },
  };
}

export function indexLockfile(kind: LockfileKind, content: string, names: readonly string[]): LockIndex {
  switch (kind) {
    case "Cargo.lock":
      return indexCargoLock(content, names);
    case "package-lock.json":
      return indexPackageLock(content, names);
    case "pnpm-lock.yaml":
      return indexPnpmLock(content, names);
    case "yarn.lock":
      return indexYarnLock(content, names);
  }
}
