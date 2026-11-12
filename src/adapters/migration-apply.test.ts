import { execFile } from "node:child_process";
import { chmod, mkdtemp, mkdir, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyMigration } from "./migration-apply.js";
import { uncommittedFiles } from "./git-guard.js";
import type { MigrationPlan, MigrationStep } from "../core/migration.js";

const run = promisify(execFile);

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "kw-apply-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const put = async (rel: string, content: string): Promise<void> => {
  await mkdir(join(dir, rel, ".."), { recursive: true });
  await writeFile(join(dir, rel), content);
};
const get = (rel: string): Promise<string> => readFile(join(dir, rel), "utf8");

const rustStep: MigrationStep = {
  file: "Cargo.toml",
  kind: "bump-rust-dep",
  dependency: "soroban-sdk",
  from: "21.0.0",
  to: "28.0.0",
  reason: "r",
  findingCode: "SDK_DEPRECATED",
};
const jsStep: MigrationStep = {
  file: "web/package.json",
  kind: "bump-js-dep",
  dependency: "@stellar/stellar-sdk",
  from: "^12.0.0",
  to: "^17.2.1",
  reason: "r",
  findingCode: "JS_SDK_DEPRECATED",
};
const manualStep: MigrationStep = {
  file: "web/package.json",
  kind: "manual",
  dependency: "x",
  from: "",
  to: "",
  reason: "check imports",
  findingCode: "JS_LEGACY_PACKAGE",
};
const plan = (steps: MigrationStep[]): MigrationPlan => ({ root: dir, steps, followUp: ["cargo update -p soroban-sdk", "npm install"] });

const cargo = `# my contract\n[package]\nname = "c"\n\n[dependencies]\nsoroban-sdk = "21.0.0"   # pinned\nserde = "1"\n`;
const pkgJson = `{\n    "name": "web",\n    "dependencies": {\n        "@stellar/stellar-sdk": "^12.0.0"\n    }\n}\n`;

describe("applyMigration (dry run)", () => {
  it("computes diffs but writes nothing", async () => {
    await put("Cargo.toml", cargo);
    await put("web/package.json", pkgJson);
    const r = await applyMigration(plan([rustStep, jsStep, manualStep]), { write: false });
    expect(r.written).toBe(false);
    expect(await get("Cargo.toml")).toBe(cargo);
    expect(await get("web/package.json")).toBe(pkgJson);
    expect(r.changes.map((c) => c.file).sort()).toEqual(["Cargo.toml", "web/package.json"]);
    expect(r.diff).toContain("--- a/Cargo.toml");
    expect(r.diff).toContain('-soroban-sdk = "21.0.0"   # pinned');
    expect(r.diff).toContain('+soroban-sdk = "28.0.0"   # pinned');
    expect(r.diff).toContain('+        "@stellar/stellar-sdk": "^17.2.1"');
    expect(r.manual).toEqual([manualStep]);
    expect(r.followUp).toEqual(["cargo update -p soroban-sdk", "npm install"]);
  });
});

describe("applyMigration (write)", () => {
  it("edits only the targeted bytes", async () => {
    await put("Cargo.toml", cargo);
    await put("web/package.json", pkgJson);
    const r = await applyMigration(plan([rustStep, jsStep]), { write: true });
    expect(r.written).toBe(true);
    expect(await get("Cargo.toml")).toBe(cargo.replace('"21.0.0"', '"28.0.0"'));
    expect(await get("web/package.json")).toBe(pkgJson.replace("^12.0.0", "^17.2.1"));
    expect(r.applied).toHaveLength(2);
  });

  it("reports steps whose target line cannot be found, without failing", async () => {
    await put("Cargo.toml", `[dependencies]\nsoroban-sdk = "20.0.0"\n`);
    const r = await applyMigration(plan([rustStep]), { write: true });
    expect(r.changes).toEqual([]);
    expect(r.skipped).toEqual([expect.objectContaining({ step: rustStep })]);
    expect(await get("Cargo.toml")).toBe(`[dependencies]\nsoroban-sdk = "20.0.0"\n`);
  });

  it("reports unreadable files as skipped", async () => {
    const r = await applyMigration(plan([rustStep]), { write: true });
    expect(r.skipped[0]?.reason).toMatch(/ENOENT|read/i);
  });

  it("does nothing for an empty plan", async () => {
    const r = await applyMigration({ root: dir, steps: [], followUp: [] }, { write: true });
    expect(r).toMatchObject({ changes: [], applied: [], skipped: [], manual: [], written: false, diff: "" });
  });
});

describe("git safety", () => {
  async function initRepo(): Promise<void> {
    await run("git", ["init", "-q"], { cwd: dir });
    await run("git", ["config", "user.email", "t@example.com"], { cwd: dir });
    await run("git", ["config", "user.name", "t"], { cwd: dir });
    await run("git", ["add", "-A"], { cwd: dir });
    await run("git", ["commit", "-q", "-m", "init"], { cwd: dir });
  }

  it("uncommittedFiles is empty outside a git repo", async () => {
    await put("Cargo.toml", cargo);
    expect(await uncommittedFiles(dir, ["Cargo.toml"])).toEqual([]);
  });

  it("refuses --write when a touched file has uncommitted changes, leaving it intact", async () => {
    await put("Cargo.toml", cargo);
    await initRepo();
    const dirty = `${cargo}# local edit\n`;
    await writeFile(join(dir, "Cargo.toml"), dirty);
    await expect(applyMigration(plan([rustStep]), { write: true })).rejects.toThrow(/uncommitted.*Cargo\.toml/is);
    expect(await get("Cargo.toml")).toBe(dirty);
  });

  it("allows dry-run on a dirty file", async () => {
    await put("Cargo.toml", cargo);
    await initRepo();
    await writeFile(join(dir, "Cargo.toml"), `${cargo}# local edit\n`);
    const r = await applyMigration(plan([rustStep]), { write: false });
    expect(r.changes).toHaveLength(1);
  });

  it("allows --write on a clean committed file and ignores unrelated dirty files", async () => {
    await put("Cargo.toml", cargo);
    await put("README.md", "x");
    await initRepo();
    await writeFile(join(dir, "README.md"), "dirty");
    const r = await applyMigration(plan([rustStep]), { write: true });
    expect(r.written).toBe(true);
    expect(await get("Cargo.toml")).toContain("28.0.0");
  });
});

describe("safe writes", () => {
  it("aborts the whole batch, writing nothing, if a file changed after planning", async () => {
    await put("a/Cargo.toml", cargo);
    await put("b/Cargo.toml", cargo);
    const stepA = { ...rustStep, file: "a/Cargo.toml" };
    const stepB = { ...rustStep, file: "b/Cargo.toml" };
    const guard = async (): Promise<string[]> => {
      await writeFile(join(dir, "b/Cargo.toml"), `${cargo}# edited concurrently\n`);
      return [];
    };
    await expect(applyMigration(plan([stepA, stepB]), { write: true, guard })).rejects.toThrow(
      /b\/Cargo\.toml changed since.*nothing was written/is,
    );
    expect(await get("a/Cargo.toml")).toBe(cargo);
    expect(await get("b/Cargo.toml")).toBe(`${cargo}# edited concurrently\n`);
  });

  it("preserves the file mode and leaves no temp files", async () => {
    await put("Cargo.toml", cargo);
    await chmod(join(dir, "Cargo.toml"), 0o640);
    await applyMigration(plan([rustStep]), { write: true });
    expect((await stat(join(dir, "Cargo.toml"))).mode & 0o777).toBe(0o640);
    expect(await readdir(dir)).toEqual(["Cargo.toml"]);
  });

  it("reports already-written files when a later write fails", async () => {
    await put("a/Cargo.toml", cargo);
    await put("b/Cargo.toml", cargo);
    await chmod(join(dir, "b"), 0o555); // temp file creation will fail
    try {
      await expect(
        applyMigration(plan([{ ...rustStep, file: "a/Cargo.toml" }, { ...rustStep, file: "b/Cargo.toml" }]), { write: true }),
      ).rejects.toThrow(/b\/Cargo\.toml.*already written.*a\/Cargo\.toml/is);
    } finally {
      await chmod(join(dir, "b"), 0o755);
    }
    expect(await get("a/Cargo.toml")).toContain("28.0.0");
    expect(await get("b/Cargo.toml")).toBe(cargo);
  });

  it("never edits through a symlinked manifest", async () => {
    await put("real/Cargo.toml", cargo);
    await symlink(join(dir, "real/Cargo.toml"), join(dir, "Cargo.toml"));
    const r = await applyMigration(plan([rustStep]), { write: true });
    expect(r.changes).toEqual([]);
    expect(r.skipped[0]?.reason).toMatch(/symlink/i);
    expect(await get("real/Cargo.toml")).toBe(cargo);
  });
});
