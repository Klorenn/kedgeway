import { randomBytes } from "node:crypto";
import { MAX_MANIFEST_BYTES } from "./safe-read.js";
import { chmod, lstat, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { unifiedDiff } from "../core/diff.js";
import { bumpCargoDep, editPackageJson } from "../core/manifest-edit.js";
import type { MigrationPlan, MigrationStep } from "../core/migration.js";
import { uncommittedFiles } from "./git-guard.js";

export interface FileChange {
  file: string;
  before: string;
  after: string;
  diff: string;
}

export interface MigrationResult {
  changes: FileChange[];
  applied: MigrationStep[];
  skipped: { step: MigrationStep; reason: string }[];
  /** Steps that need a human; kedgeway never edits for these. */
  manual: MigrationStep[];
  written: boolean;
  followUp: string[];
  /** Concatenated unified diffs of all changes. */
  diff: string;
}

export interface ApplyOptions {
  write: boolean;
  /** Returns files with uncommitted changes (override for tests). */
  guard?: (cwd: string, files: string[]) => Promise<string[]>;
}

async function writeAtomic(path: string, content: string): Promise<void> {
  const mode = (await stat(path)).mode & 0o777;
  const tmp = join(dirname(path), `.${basename(path)}.kedgeway-${randomBytes(6).toString("hex")}.tmp`);
  try {
    await writeFile(tmp, content, { mode });
    await chmod(tmp, mode);
    await rename(tmp, path);
  } catch (e) {
    await rm(tmp, { force: true });
    throw e;
  }
}

export async function applyMigration(plan: MigrationPlan, opts: ApplyOptions): Promise<MigrationResult> {
  const manual = plan.steps.filter((s) => s.kind === "manual");
  const editable = plan.steps.filter((s) => s.kind !== "manual");
  const byFile = new Map<string, MigrationStep[]>();
  for (const s of editable) byFile.set(s.file, [...(byFile.get(s.file) ?? []), s]);

  const changes: FileChange[] = [];
  const applied: MigrationStep[] = [];
  const skipped: MigrationResult["skipped"] = [];

  for (const [file, steps] of byFile) {
    let before: string;
    try {
      const st = await lstat(join(plan.root, file));
      if (st.isSymbolicLink()) {
        for (const step of steps) skipped.push({ step, reason: `${file} is a symlink; kedgeway never edits through symlinks` });
        continue;
      }
      if (!st.isFile() || st.size > MAX_MANIFEST_BYTES) {
        for (const step of steps) skipped.push({ step, reason: `${file} is not a regular file of at most 5 MB` });
        continue;
      }
      before = await readFile(join(plan.root, file), "utf8");
    } catch (e) {
      const reason = `could not read ${file}: ${e instanceof Error ? e.message : String(e)}`;
      for (const step of steps) skipped.push({ step, reason });
      continue;
    }
    let after = before;
    if (basename(file) === "Cargo.toml") {
      for (const step of steps) {
        const r = bumpCargoDep(after, step.from, step.to);
        if (r.count > 0) {
          after = r.text;
          applied.push(step);
        } else {
          skipped.push({ step, reason: `${step.dependency} "${step.from}" not found on an editable line; update it manually` });
        }
      }
    } else if (basename(file) === "package.json") {
      const r = editPackageJson(before, steps);
      after = r.text;
      applied.push(...r.applied);
      skipped.push(...r.skipped);
    } else {
      for (const step of steps) skipped.push({ step, reason: `unsupported manifest ${file}` });
    }
    if (after !== before) changes.push({ file, before, after, diff: unifiedDiff(file, before, after) });
  }

  if (opts.write && changes.length > 0) {
    const files = changes.map((c) => c.file);
    const dirty = await (opts.guard ?? uncommittedFiles)(plan.root, files);
    if (dirty.length > 0) {
      throw new Error(
        `Refusing to write: uncommitted changes in ${dirty.join(", ")}. Commit or stash them first (or run without --write for a dry run).`,
      );
    }
    // Re-read right before writing: abort the whole batch if anything moved under us.
    const moved: string[] = [];
    for (const c of changes) {
      const now = await readFile(join(plan.root, c.file), "utf8").catch(() => null);
      if (now !== c.before) moved.push(c.file);
    }
    if (moved.length > 0) {
      throw new Error(`${moved.join(", ")} changed since it was planned; nothing was written. Re-run kedgeway migrate.`);
    }
    const written: string[] = [];
    for (const c of changes) {
      try {
        await writeAtomic(join(plan.root, c.file), c.after);
        written.push(c.file);
      } catch (e) {
        throw new Error(
          `Failed writing ${c.file}: ${e instanceof Error ? e.message : String(e)}. Already written: ${written.length > 0 ? written.join(", ") : "(none)"}.`,
        );
      }
    }
  }

  return {
    changes,
    applied,
    skipped,
    manual,
    written: opts.write && changes.length > 0,
    followUp: plan.followUp,
    diff: changes.map((c) => c.diff).join("\n"),
  };
}
