import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { findImportHits, type SourceHit } from "../core/source-hits.js";

const SKIP_DIRS = new Set(["node_modules", "target", "dist", ".git", ".next", "vendor", "build", "coverage"]);
const MAX_DEPTH = 4;
const MAX_HITS = 20;
const MAX_BYTES = 1_000_000;
const SOURCE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"]);

export interface ImportScan {
  hits: SourceHit[];
  /** True when more than {@link MAX_HITS} matches exist and the rest were dropped. */
  truncated: boolean;
}

function extOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot);
}

/** Walks `root` with the same depth and skip rules as the manifest scan, and finds imports of `names`. */
export async function scanImportHits(root: string, names: readonly string[]): Promise<ImportScan> {
  if (names.length === 0) return { hits: [], truncated: false };
  const abs = resolve(root);
  const info = await stat(abs);
  if (!info.isDirectory()) throw new Error(`${abs} is not a directory`);
  const files: { file: string; text: string }[] = [];

  async function walk(rel: string, depth: number): Promise<void> {
    let entries;
    try {
      entries = await readdir(join(abs, rel), { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const relPath = rel === "" ? entry.name : `${rel}/${entry.name}`;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || depth >= MAX_DEPTH) continue;
        await walk(relPath, depth + 1);
        continue;
      }
      if (!entry.isFile() || !SOURCE_EXT.has(extOf(entry.name))) continue;
      const full = join(abs, relPath);
      try {
        const st = await stat(full);
        if (!st.isFile() || st.size > MAX_BYTES) continue;
        files.push({ file: relPath, text: await readFile(full, "utf8") });
      } catch {
        continue;
      }
    }
  }

  await walk("", 0);
  const all = findImportHits(files, names);
  return { hits: all.slice(0, MAX_HITS), truncated: all.length > MAX_HITS };
}
