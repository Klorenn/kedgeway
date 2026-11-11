import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  parseCargoManifest,
  parsePackageJsonDeps,
  resolveRustDeps,
  type CargoManifest,
  type DetectedDep,
  type ManifestError,
  type RepoFacts,
} from "../core/repo-facts.js";

const SKIP_DIRS = new Set(["node_modules", "target", "dist", ".git", ".next", "vendor", "build", "coverage"]);
const MAX_DEPTH = 4;

async function walk(
  root: string,
  rel: string,
  depth: number,
  onFile: (relPath: string, absPath: string) => Promise<void>,
  onError: (relPath: string, e: unknown) => void,
): Promise<void> {
  let entries;
  try {
    entries = await readdir(join(root, rel), { withFileTypes: true });
  } catch (e) {
    onError(rel === "" ? "." : rel, e);
    return;
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const e of entries) {
    const relPath = rel === "" ? e.name : `${rel}/${e.name}`;
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name) || depth >= MAX_DEPTH) continue;
      await walk(root, relPath, depth + 1, onFile, onError);
    } else if (e.isFile()) {
      try {
        await onFile(relPath, join(root, relPath));
      } catch (e) {
        onError(relPath, e);
      }
    }
  }
}

export async function scanRepo(path: string): Promise<RepoFacts> {
  const root = resolve(path);
  const manifests: { file: string; manifest: CargoManifest }[] = [];
  const jsDeps: DetectedDep[] = [];
  const manifestErrors: ManifestError[] = [];
  const fail = (file: string, message: string): void => void manifestErrors.push({ file, message });

  await walk(
    root,
    "",
    0,
    async (rel, abs) => {
      const base = rel.split("/").pop();
      if (base === "Cargo.toml") {
        const manifest = parseCargoManifest(await readFile(abs, "utf8"));
        if (manifest.error) fail(rel, manifest.error);
        else manifests.push({ file: rel, manifest });
      } else if (base === "package.json") {
        const r = parsePackageJsonDeps(await readFile(abs, "utf8"), rel);
        if (r.error) fail(rel, r.error);
        else jsDeps.push(...r.deps);
      }
    },
    (rel, e) => fail(rel, e instanceof Error ? e.message : String(e)),
  );

  return { root, rustDeps: resolveRustDeps(manifests), jsDeps, manifestErrors };
}
