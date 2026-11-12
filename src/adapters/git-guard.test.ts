import { execFile } from "node:child_process";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { uncommittedFiles } from "./git-guard.js";

const run = promisify(execFile);
let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "kw-git-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function stubGit(script: string): Promise<string> {
  const f = join(dir, "fake-git.sh");
  await writeFile(f, `#!/bin/sh\n${script}\n`);
  await chmod(f, 0o755);
  return f;
}

async function repo(): Promise<void> {
  await run("git", ["init", "-q"], { cwd: dir });
  await run("git", ["config", "user.email", "t@example.com"], { cwd: dir });
  await run("git", ["config", "user.name", "t"], { cwd: dir });
}

describe("uncommittedFiles: failure modes", () => {
  it("treats a missing git binary (ENOENT) as no repo", async () => {
    expect(await uncommittedFiles(dir, ["a"], { git: join(dir, "does-not-exist") })).toEqual([]);
  });

  it('treats exit 128 "not a git repository" as no repo', async () => {
    const git = await stubGit('echo "fatal: not a git repository (or any of the parent directories): .git" >&2; exit 128');
    expect(await uncommittedFiles(dir, ["a"], { git })).toEqual([]);
  });

  it("rethrows any other git failure so --write refuses", async () => {
    const git = await stubGit('echo "fatal: detected dubious ownership in repository" >&2; exit 128');
    await expect(uncommittedFiles(dir, ["a"], { git })).rejects.toThrow(/dubious ownership/);
    const other = await stubGit("echo boom >&2; exit 1");
    await expect(uncommittedFiles(dir, ["a"], { git: other })).rejects.toThrow(/boom/);
  });

  it("rethrows on timeout", async () => {
    const git = await stubGit("sleep 5");
    await expect(uncommittedFiles(dir, ["a"], { git, timeoutMs: 100 })).rejects.toThrow();
  });

  it("ignores GIT_DIR / GIT_WORK_TREE from the environment", async () => {
    const git = await stubGit('[ -z "$GIT_DIR" ] && [ -z "$GIT_WORK_TREE" ] && exit 0; echo leaked >&2; exit 1');
    process.env["GIT_DIR"] = "/nonexistent";
    try {
      await expect(uncommittedFiles(dir, ["a"], { git })).resolves.toEqual([]);
    } finally {
      delete process.env["GIT_DIR"];
    }
  });
});

describe("uncommittedFiles: -z parsing", () => {
  it("handles paths with spaces and untracked files in untracked directories", async () => {
    await repo();
    await writeFile(join(dir, "a b.toml"), "1");
    await run("git", ["add", "-A"], { cwd: dir });
    await run("git", ["commit", "-q", "-m", "i"], { cwd: dir });
    await writeFile(join(dir, "a b.toml"), "2");
    expect(await uncommittedFiles(dir, ["a b.toml"])).toEqual(["a b.toml"]);
  });

  it("reports both sides of a staged rename", async () => {
    await repo();
    await writeFile(join(dir, "x.toml"), "1");
    await run("git", ["add", "-A"], { cwd: dir });
    await run("git", ["commit", "-q", "-m", "i"], { cwd: dir });
    await run("git", ["mv", "x.toml", "y.toml"], { cwd: dir });
    expect((await uncommittedFiles(dir, ["x.toml", "y.toml"])).sort()).toEqual(["x.toml", "y.toml"]);
  });

  it("returns [] for clean files", async () => {
    await repo();
    await writeFile(join(dir, "c.toml"), "1");
    await run("git", ["add", "-A"], { cwd: dir });
    await run("git", ["commit", "-q", "-m", "i"], { cwd: dir });
    expect(await uncommittedFiles(dir, ["c.toml"])).toEqual([]);
  });
});
