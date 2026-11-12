import { parse as parseToml } from "smol-toml";
import type { LockfileKind } from "./lockfile.js";
import { packageJsonDepLines } from "./manifest-edit.js";
import type { ToolchainFacts } from "./toolchain.js";

export interface DetectedDep {
  name: string;
  raw: string;
  version: string | null;
  major: number | null;
  file: string;
  /** 1-based line of the dependency in `file` (best effort), used for annotations. */
  line?: number;
  /** Version pinned by the nearest lockfile, when one exists. Diagnosis prefers it over `version`. */
  resolved: string | null;
  resolvedFrom: LockfileKind | null;
  /** For `npm:` aliases: the member key and value as written in package.json (`name`/`raw` describe the target). */
  declaredKey?: string;
  declaredRaw?: string;
  /** Set when a lockfile exists but cannot attribute a single entry to this dependency ("ambiguous in ..."). */
  lockNote?: string;
  /** For workspace-inherited deps: the manifest that actually declares the version. */
  declaredIn?: string;
}

export interface ManifestError {
  file: string;
  message: string;
}

export interface RepoFacts {
  root: string;
  rustDeps: DetectedDep[];
  jsDeps: DetectedDep[];
  /** Manifests or directories that could not be read/parsed; their contents are unknown. */
  manifestErrors: ManifestError[];
  /** Stellar CLI pins, Rust targets and Rust toolchain pins; present only when the scan found any. */
  toolchain?: ToolchainFacts;
  /** Non-finding advice for the text report (for example a lockfile above the scan root). */
  hints?: string[];
}

export const RUST_PACKAGES = ["soroban-sdk"] as const;
export const JS_PACKAGES = [
  "@stellar/stellar-sdk",
  "stellar-sdk",
  "@stellar/stellar-base",
  "soroban-client",
] as const;

export function parseVersion(raw: string): { version: string | null; major: number | null } {
  // Upper-bound-only and compound ranges do not identify a single major.
  if (raw.includes("||") || /^\s*</.test(raw)) return { version: null, major: null };
  const stripped = raw.trim().replace(/^[\^~>=<\s]+/, "");
  const m = /^(\d+)(?:\.[\dx*]+)*(?:-[0-9A-Za-z.-]+)?/.exec(stripped);
  if (!m || m[1] === undefined) return { version: null, major: null };
  return { version: m[0], major: Number.parseInt(m[1], 10) };
}

function toDep(name: string, raw: string, file: string, line?: number): DetectedDep {
  return { name, raw, ...parseVersion(raw), file, ...(line === undefined ? {} : { line }), resolved: null, resolvedFrom: null };
}

// ---------- Cargo ----------

export interface RawRustDep {
  /** Real crate name (`package = "..."` if renamed, else the key). */
  name: string;
  /** Key under which the dependency is declared. */
  key: string;
  raw: string;
  workspace: boolean;
  line?: number;
}

export interface CargoManifest {
  deps: RawRustDep[];
  /** Keyed by declaration key; only soroban-sdk entries are kept. */
  workspaceDeps: Record<string, string>;
  /** Line of each `[workspace.dependencies]` key. */
  workspaceLines: Record<string, number>;
  error: string | null;
}

const KEY_LINE = /^\s*(?:"([^"]+)"|'([^']+)'|([A-Za-z0-9_-]+))\s*=/;
const HEADER = /^\s*\[\[?\s*(.+?)\s*\]\]?\s*(?:#.*)?$/;
type DepKind = "dependencies" | "dev-dependencies" | "build-dependencies";

/** Lines (1-based, in text order) of each dependency key per table kind, from a plain scan of the manifest text. */
function scanCargoLines(content: string): { deps: Map<string, number[]>; workspace: Map<string, number> } {
  const deps = new Map<string, number[]>(); // `${kind}|${key}` -> lines
  const workspace = new Map<string, number>();
  let table: { kind: DepKind } | "ws" | null = null;
  const addDep = (kind: DepKind, key: string, line: number): void => {
    const k = `${kind}|${key}`;
    deps.set(k, [...(deps.get(k) ?? []), line]);
  };
  const addWs = (key: string, line: number): void => {
    if (!workspace.has(key)) workspace.set(key, line);
  };
  const kindOf = (name: string): DepKind => (name.startsWith("dev-") ? "dev-dependencies" : name.startsWith("build-") ? "build-dependencies" : "dependencies");
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const text = lines[i] ?? "";
    const h = HEADER.exec(text);
    if (h?.[1] !== undefined) {
      const name = h[1];
      table = null;
      const wsKey = /(?:^|\.)workspace\.dependencies\.(.+)$/.exec(name);
      const depTable = /(?:^|\.)((?:dev-|build-)?dependencies)$/.exec(name);
      const depKey = /(?:^|\.)((?:dev-|build-)?dependencies)\.([^.]+)$/.exec(name);
      if (/(?:^|\.)workspace\.dependencies$/.test(name)) table = "ws";
      else if (wsKey?.[1] !== undefined) addWs(wsKey[1].replace(/^["']|["']$/g, ""), i + 1);
      else if (depTable?.[1] !== undefined) table = { kind: kindOf(depTable[1]) };
      else if (depKey?.[1] !== undefined && depKey[2] !== undefined) addDep(kindOf(depKey[1]), depKey[2].replace(/^["']|["']$/g, ""), i + 1);
      continue;
    }
    if (table === null) continue;
    const k = KEY_LINE.exec(text);
    const key = k?.[1] ?? k?.[2] ?? k?.[3];
    if (key === undefined) continue;
    if (table === "ws") addWs(key, i + 1);
    else addDep(table.kind, key, i + 1);
  }
  return { deps, workspace };
}

const DEP_TABLES = ["dependencies", "dev-dependencies", "build-dependencies"] as const;

/** Tiny posix dirname for forward-slash relative paths ("." for top level). */
function dirname(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "." : path.slice(0, i) || "/";
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function readCargoEntry(key: string, value: unknown): { name: string; raw: string; workspace: boolean } {
  if (typeof value === "string") return { name: key, raw: value, workspace: false };
  if (isRecord(value)) {
    const name = typeof value["package"] === "string" ? value["package"] : key;
    if (value["workspace"] === true) return { name, raw: "", workspace: true };
    if (typeof value["version"] === "string") return { name, raw: value["version"], workspace: false };
    return { name, raw: "", workspace: false };
  }
  return { name: key, raw: "", workspace: false };
}

function isRustPackage(name: string): boolean {
  return (RUST_PACKAGES as readonly string[]).includes(name);
}

export function parseCargoManifest(content: string): CargoManifest {
  let doc: unknown;
  try {
    doc = parseToml(content);
  } catch (e) {
    return { deps: [], workspaceDeps: {}, workspaceLines: {}, error: e instanceof Error ? e.message : String(e) };
  }
  const result: CargoManifest = { deps: [], workspaceDeps: {}, workspaceLines: {}, error: null };
  const lineOf = scanCargoLines(content);
  if (!isRecord(doc)) return result;

  const tables: { kind: DepKind; table: unknown }[] = DEP_TABLES.map((t) => ({ kind: t, table: doc[t] }));
  const target = doc["target"];
  if (isRecord(target)) {
    for (const cfg of Object.values(target)) {
      if (isRecord(cfg)) for (const t of DEP_TABLES) tables.push({ kind: t, table: cfg[t] });
    }
  }
  const used = new Map<string, number>();
  const takeLine = (kind: DepKind, key: string): number | undefined => {
    const k = `${kind}|${key}`;
    const n = used.get(k) ?? 0;
    used.set(k, n + 1);
    return lineOf.deps.get(k)?.[n];
  };

  for (const { kind, table } of tables) {
    if (!isRecord(table)) continue;
    for (const [key, value] of Object.entries(table)) {
      const entry = readCargoEntry(key, value);
      // workspace refs are kept for any key: the workspace may rename the crate.
      if (isRustPackage(entry.name) || entry.workspace) {
        const line = takeLine(kind, key);
        result.deps.push({ ...entry, key, ...(line === undefined ? {} : { line }) });
      }
    }
  }

  const ws = doc["workspace"];
  if (isRecord(ws) && isRecord(ws["dependencies"])) {
    for (const [key, value] of Object.entries(ws["dependencies"])) {
      const entry = readCargoEntry(key, value);
      if (isRustPackage(entry.name)) {
        result.workspaceDeps[key] = entry.raw;
        const line = lineOf.workspace.get(key);
        if (line !== undefined) result.workspaceLines[key] = line;
      }
    }
  }
  return result;
}

function dedupe(deps: DetectedDep[]): DetectedDep[] {
  const seen = new Set<string>();
  return deps.filter((d) => {
    const k = `${d.file}\u0000${d.name}\u0000${d.raw}\u0000${d.declaredKey ?? ""}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function resolveRustDeps(
  manifests: { file: string; manifest: CargoManifest }[],
): DetectedDep[] {
  const withWs = manifests.filter((m) => Object.keys(m.manifest.workspaceDeps).length > 0);
  const referenced = new Set<string>(); // `${wsFile}::${key}`
  const out: DetectedDep[] = [];

  for (const { file, manifest } of manifests) {
    for (const dep of manifest.deps) {
      if (!dep.workspace) {
        out.push(toDep(dep.name, dep.raw, file, dep.line));
        continue;
      }
      const dir = dirname(file);
      const owner = withWs
        .filter((w) => {
          const wdir = dirname(w.file);
          return wdir === "." || dir === wdir || dir.startsWith(`${wdir}/`);
        })
        .filter((w) => dep.key in w.manifest.workspaceDeps)
        .sort((a, b) => dirname(b.file).length - dirname(a.file).length)[0];
      if (owner) {
        referenced.add(`${owner.file}::${dep.key}`);
        const resolved = toDep("soroban-sdk", owner.manifest.workspaceDeps[dep.key] ?? "", file, dep.line);
        out.push(owner.file === file ? resolved : { ...resolved, declaredIn: owner.file });
      } else if (isRustPackage(dep.name)) {
        out.push(toDep(dep.name, "", file, dep.line));
      }
    }
  }

  for (const { file, manifest } of withWs) {
    for (const [key, raw] of Object.entries(manifest.workspaceDeps)) {
      if (!referenced.has(`${file}::${key}`)) out.push(toDep("soroban-sdk", raw, file, manifest.workspaceLines[key]));
    }
  }
  return dedupe(out);
}

// ---------- package.json ----------

export function parsePackageJsonDeps(
  content: string,
  file: string,
): { deps: DetectedDep[]; error: string | null } {
  let doc: unknown;
  try {
    doc = JSON.parse(content.replace(/^\uFEFF/, ""));
  } catch (e) {
    return { deps: [], error: e instanceof Error ? e.message : String(e) };
  }
  if (!isRecord(doc)) return { deps: [], error: "package.json is not a JSON object" };
  const out: DetectedDep[] = [];
  const lines = packageJsonDepLines(content);
  for (const section of ["dependencies", "devDependencies"] as const) {
    const table = doc[section];
    if (!isRecord(table)) continue;
    for (const [key, value] of Object.entries(table)) {
      if (typeof value !== "string") continue;
      // `"alias": "npm:@stellar/stellar-sdk@17.4.0"` is that package, whatever the key says.
      const alias = /^npm:((?:@[^/]+\/)?[^@]+)(?:@(.+))?$/.exec(value);
      const name = alias?.[1] ?? key;
      const raw = alias ? (alias[2] ?? "*") : value;
      if (!(JS_PACKAGES as readonly string[]).includes(name)) continue;
      const dep = toDep(name, raw, file, lines[section].get(key));
      out.push(alias ? { ...dep, declaredKey: key, declaredRaw: value } : dep);
    }
  }
  return { deps: dedupe(out), error: null };
}
