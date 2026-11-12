import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

export interface GitGuardOptions {
  /** git executable (override for tests). */
  git?: string;
  timeoutMs?: number;
}

function cleanEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const k of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"]) delete env[k];
  return env;
}

/**
 * Returns the subset of `files` (relative to `cwd`) with uncommitted changes, or untracked,
 * in the surrounding git repo. Returns [] ONLY when git is not installed or `cwd` is not inside
 * a repository; every other failure (dubious ownership, timeout, bad config) is rethrown so
 * callers refuse to write.
 */
export async function uncommittedFiles(cwd: string, files: string[], opts: GitGuardOptions = {}): Promise<string[]> {
  if (files.length === 0) return [];
  let stdout: string;
  try {
    ({ stdout } = await run(
      opts.git ?? "git",
      ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--", ...files],
      { cwd, env: cleanEnv(), timeout: opts.timeoutMs ?? 10_000 },
    ));
  } catch (e) {
    const err = e as { code?: string | number; stderr?: string; message: string };
    if (err.code === "ENOENT") return [];
    if (err.code === 128 && /not a git repository/i.test(err.stderr ?? "")) return [];
    const detail = (err.stderr ?? "").trim() || err.message;
    throw new Error(`could not verify git state (refusing to write): ${detail}`);
  }
  const records = stdout.split("\0");
  const out: string[] = [];
  for (let i = 0; i < records.length; i += 1) {
    const rec = records[i] as string;
    if (rec.length < 4) continue;
    const xy = rec.slice(0, 2);
    out.push(rec.slice(3));
    if (xy.includes("R") || xy.includes("C")) {
      const orig = records[i + 1];
      if (orig) out.push(orig);
      i += 1;
    }
  }
  return out;
}
