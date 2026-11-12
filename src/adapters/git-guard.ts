import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * Returns the subset of `files` (relative to `cwd`) with uncommitted changes or untracked
 * in the surrounding git repo. Returns [] when git is missing or `cwd` is not inside a repo.
 */
export async function uncommittedFiles(cwd: string, files: string[]): Promise<string[]> {
  if (files.length === 0) return [];
  try {
    const { stdout } = await run("git", ["status", "--porcelain", "--", ...files], { cwd });
    return stdout
      .split("\n")
      .filter((l) => l.length > 3)
      .map((l) => l.slice(3).replace(/^"|"$/g, ""));
  } catch {
    return [];
  }
}
