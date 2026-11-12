import { readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
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

export async function applyMigration(plan: MigrationPlan, opts: { write: boolean }): Promise<MigrationResult> {
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
    const dirty = await uncommittedFiles(
      plan.root,
      changes.map((c) => c.file),
    );
    if (dirty.length > 0) {
      throw new Error(
        `Refusing to write: uncommitted changes in ${dirty.join(", ")}. Commit or stash them first (or run without --write for a dry run).`,
      );
    }
    for (const c of changes) await writeFile(join(plan.root, c.file), c.after);
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
