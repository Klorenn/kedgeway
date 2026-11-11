import { posix } from "node:path";
import { parse as parseToml } from "smol-toml";

export interface DetectedDep {
  name: string;
  raw: string;
  version: string | null;
  major: number | null;
  file: string;
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

function toDep(name: string, raw: string, file: string): DetectedDep {
  return { name, raw, ...parseVersion(raw), file };
}

// ---------- Cargo ----------

export interface RawRustDep {
  /** Real crate name (`package = "..."` if renamed, else the key). */
  name: string;
  /** Key under which the dependency is declared. */
  key: string;
  raw: string;
  workspace: boolean;
}

export interface CargoManifest {
  deps: RawRustDep[];
  /** Keyed by declaration key; only soroban-sdk entries are kept. */
  workspaceDeps: Record<string, string>;
  error: string | null;
}

const DEP_TABLES = ["dependencies", "dev-dependencies", "build-dependencies"] as const;

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
    return { deps: [], workspaceDeps: {}, error: e instanceof Error ? e.message : String(e) };
  }
  const result: CargoManifest = { deps: [], workspaceDeps: {}, error: null };
  if (!isRecord(doc)) return result;

  const tables: unknown[] = DEP_TABLES.map((t) => doc[t]);
  const target = doc["target"];
  if (isRecord(target)) {
    for (const cfg of Object.values(target)) {
      if (isRecord(cfg)) for (const t of DEP_TABLES) tables.push(cfg[t]);
    }
  }

  for (const table of tables) {
    if (!isRecord(table)) continue;
    for (const [key, value] of Object.entries(table)) {
      const entry = readCargoEntry(key, value);
      // workspace refs are kept for any key: the workspace may rename the crate.
      if (isRustPackage(entry.name) || entry.workspace) result.deps.push({ ...entry, key });
    }
  }

  const ws = doc["workspace"];
  if (isRecord(ws) && isRecord(ws["dependencies"])) {
    for (const [key, value] of Object.entries(ws["dependencies"])) {
      const entry = readCargoEntry(key, value);
      if (isRustPackage(entry.name)) result.workspaceDeps[key] = entry.raw;
    }
  }
  return result;
}

function dedupe(deps: DetectedDep[]): DetectedDep[] {
  const seen = new Set<string>();
  return deps.filter((d) => {
    const k = `${d.file}\u0000${d.name}\u0000${d.raw}`;
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
        out.push(toDep(dep.name, dep.raw, file));
        continue;
      }
      const dir = posix.dirname(file);
      const owner = withWs
        .filter((w) => {
          const wdir = posix.dirname(w.file);
          return wdir === "." || dir === wdir || dir.startsWith(`${wdir}/`);
        })
        .filter((w) => dep.key in w.manifest.workspaceDeps)
        .sort((a, b) => posix.dirname(b.file).length - posix.dirname(a.file).length)[0];
      if (owner) {
        referenced.add(`${owner.file}::${dep.key}`);
        out.push(toDep("soroban-sdk", owner.manifest.workspaceDeps[dep.key] ?? "", file));
      } else if (isRustPackage(dep.name)) {
        out.push(toDep(dep.name, "", file));
      }
    }
  }

  for (const { file, manifest } of withWs) {
    for (const [key, raw] of Object.entries(manifest.workspaceDeps)) {
      if (!referenced.has(`${file}::${key}`)) out.push(toDep("soroban-sdk", raw, file));
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
    doc = JSON.parse(content);
  } catch (e) {
    return { deps: [], error: e instanceof Error ? e.message : String(e) };
  }
  if (!isRecord(doc)) return { deps: [], error: "package.json is not a JSON object" };
  const out: DetectedDep[] = [];
  for (const section of ["dependencies", "devDependencies"] as const) {
    const table = doc[section];
    if (!isRecord(table)) continue;
    for (const name of JS_PACKAGES) {
      const raw = table[name];
      if (typeof raw === "string") out.push(toDep(name, raw, file));
    }
  }
  return { deps: dedupe(out), error: null };
}
