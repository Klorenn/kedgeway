import { readdir, stat } from "node:fs/promises";
import { MAX_MANIFEST_BYTES, readRegularFile } from "./safe-read.js";
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
import { emptyToolchain, isEmptyToolchain, mergeToolchain, scanToolchainText, toolchainFileKind, type ToolchainFacts } from "../core/toolchain.js";
import { lockfileHints, resolveLockfiles } from "./lockfile-resolver.js";

const SKIP_DIRS = new Set(["node_modules", "target", "dist", ".git", ".next", "vendor", "build", "coverage"]);
const MAX_DEPTH = 4;
/** Toolchain files larger than this are not read (they are not hand-written pins). */
const MAX_TOOLCHAIN_FILE_BYTES = 1_000_000;

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
  const info = await stat(root); // rejects with ENOENT (including the path) if missing
  if (!info.isDirectory()) throw new Error(`${root} is not a directory`);
  const manifests: { file: string; manifest: CargoManifest }[] = [];
  const jsDeps: DetectedDep[] = [];
  const manifestErrors: ManifestError[] = [];
  const toolchainParts: ToolchainFacts[] = [];
  const fail = (file: string, message: string): void => void manifestErrors.push({ file, message });

  await walk(
    root,
    "",
    0,
    async (rel, abs) => {
      const base = rel.split("/").pop();
      const kind = toolchainFileKind(rel);
      if (base === "Cargo.toml") {
        const manifestText = await readRegularFile(abs, MAX_MANIFEST_BYTES);
        if (manifestText === null) return fail(rel, "not a regular file or larger than 5 MB; skipped");
        const manifest = parseCargoManifest(manifestText);
        if (manifest.error) fail(rel, manifest.error);
        else manifests.push({ file: rel, manifest });
      } else if (base === "package.json") {
        const text = await readRegularFile(abs, MAX_MANIFEST_BYTES);
        if (text === null) return fail(rel, "not a regular file or larger than 5 MB; skipped");
        const r = parsePackageJsonDeps(text, rel);
        if (r.error) fail(rel, r.error);
        else {
          jsDeps.push(...r.deps);
          toolchainParts.push(scanToolchainText(rel, text));
        }
      } else if (kind !== null) {
        const text = await readRegularFile(abs, MAX_TOOLCHAIN_FILE_BYTES); // null: symlink, special or too large (not a hand-written pin)
        if (text !== null) toolchainParts.push(scanToolchainText(rel, text));
      }
    },
    (rel, e) => fail(rel, e instanceof Error ? e.message : String(e)),
  );

  const facts = await resolveLockfiles(root, { root, rustDeps: resolveRustDeps(manifests), jsDeps, manifestErrors });
  const hints = await lockfileHints(root, facts);
  const toolchain = mergeToolchain(emptyToolchain(), ...toolchainParts);
  return { ...facts, ...(isEmptyToolchain(toolchain) ? {} : { toolchain }), ...(hints.length > 0 ? { hints } : {}) };
}
