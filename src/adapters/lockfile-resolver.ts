import { access } from "node:fs/promises";
import { MAX_LOCKFILE_BYTES, readRegularFile } from "./safe-read.js";
import { dirname, join } from "node:path";
import { indexLockfile, type LockIndex, type LockfileKind } from "../core/lockfile.js";
import { JS_PACKAGES, RUST_PACKAGES, type DetectedDep, type RepoFacts } from "../core/repo-facts.js";

const JS_LOCKS: readonly LockfileKind[] = ["package-lock.json", "pnpm-lock.yaml", "yarn.lock"];

function dirOf(file: string): string {
  const i = file.lastIndexOf("/");
  return i === -1 ? "" : file.slice(0, i);
}

/** Directories from the manifest's own up to the scan root ("" is the root). */
function ancestors(file: string): string[] {
  const out: string[] = [];
  let d = dirOf(file);
  for (;;) {
    out.push(d);
    if (d === "") return out;
    d = dirOf(d);
  }
}

/** Manifest directory relative to the lockfile's directory ("." when the same). */
function importerOf(depFile: string, lockDir: string): string {
  const d = dirOf(depFile);
  if (d === lockDir) return ".";
  return lockDir === "" ? d : d.slice(lockDir.length + 1);
}

/**
 * Fills `resolved` / `resolvedFrom` on every dep with the version its DIRECT requirement resolves to in
 * the nearest lockfile (walking up from the manifest's directory to `root`) that has a verdict for it.
 * A lockfile that cannot attribute a single entry yields `lockNote` instead ("ambiguous in ...") and the
 * dep stays unresolved. Unreadable or corrupt lockfiles are skipped. Never reads above `root`.
 */
export async function resolveLockfiles(root: string, facts: RepoFacts): Promise<RepoFacts> {
  const cache = new Map<string, Promise<LockIndex | null>>();
  const load = (dir: string, kind: LockfileKind, names: readonly string[]): Promise<LockIndex | null> => {
    const key = `${dir}/${kind}`;
    let hit = cache.get(key);
    if (!hit) {
      hit = readRegularFile(join(root, dir, kind), MAX_LOCKFILE_BYTES).then((text) => (text === null ? null : indexLockfile(kind, text, names)));
      cache.set(key, hit);
    }
    return hit;
  };

  const resolve = async (dep: DetectedDep, kinds: readonly LockfileKind[], names: readonly string[]): Promise<DetectedDep> => {
    for (const dir of ancestors(dep.file)) {
      for (const kind of kinds) {
        const result = (await load(dir, kind, names))?.resolve({ name: dep.name, raw: dep.raw, importer: importerOf(dep.file, dir) });
        if (result === null || result === undefined) continue;
        if ("version" in result) return { ...dep, resolved: result.version, resolvedFrom: kind };
        return { ...dep, lockNote: result.note };
      }
    }
    return dep;
  };

  return {
    ...facts,
    rustDeps: await Promise.all(facts.rustDeps.map((d) => resolve(d, ["Cargo.lock"], RUST_PACKAGES))),
    jsDeps: await Promise.all(facts.jsDeps.map((d) => resolve(d, JS_LOCKS, JS_PACKAGES))),
  };
}

/**
 * Hints for the text report: ecosystems with unresolved deps whose lockfile exists in a directory ABOVE the
 * scan root (kedgeway never reads above it, so the user may want to scan from there instead).
 */
export async function lockfileHints(root: string, facts: RepoFacts): Promise<string[]> {
  const wanted: LockfileKind[] = [];
  if (facts.rustDeps.some((d) => d.resolved === null && d.lockNote === undefined)) wanted.push("Cargo.lock");
  if (facts.jsDeps.some((d) => d.resolved === null && d.lockNote === undefined)) wanted.push(...JS_LOCKS);
  if (wanted.length === 0) return [];
  const hints: string[] = [];
  let dir = root;
  for (let i = 0; i < 12; i += 1) {
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
    for (const kind of wanted) {
      const found = await access(join(dir, kind)).then(
        () => true,
        () => false,
      );
      if (found && !hints.some((h) => h.startsWith(kind))) {
        hints.push(`${kind} found in ${dir}, above the scan root; some dependencies are unresolved. Scan from ${dir} to use it.`);
      }
    }
  }
  return hints;
}
