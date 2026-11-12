import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeWorkflow } from "./workflow-writer.js";

let dir: string;
beforeEach(async () => void (dir = await mkdtemp(join(tmpdir(), "kw-init-"))));
afterEach(async () => rm(dir, { recursive: true, force: true }));

const rel = ".github/workflows/kedgeway.yml";

describe("writeWorkflow", () => {
  it("creates the directories and writes the file", async () => {
    const r = await writeWorkflow(dir, rel, "a: 1\n", { force: false });
    expect(r).toEqual({ status: "written", path: join(dir, rel) });
    expect(await readFile(join(dir, rel), "utf8")).toBe("a: 1\n");
  });

  it("refuses to overwrite an existing file and leaves it untouched", async () => {
    await mkdir(join(dir, ".github/workflows"), { recursive: true });
    await writeFile(join(dir, rel), "old\n");
    const r = await writeWorkflow(dir, rel, "new\n", { force: false });
    expect(r).toEqual({ status: "exists", path: join(dir, rel) });
    expect(await readFile(join(dir, rel), "utf8")).toBe("old\n");
  });

  it("overwrites with force and leaves no temp files", async () => {
    await mkdir(join(dir, ".github/workflows"), { recursive: true });
    await writeFile(join(dir, rel), "old\n");
    const r = await writeWorkflow(dir, rel, "new\n", { force: true });
    expect(r.status).toBe("written");
    expect(await readFile(join(dir, rel), "utf8")).toBe("new\n");
    expect(await readdir(join(dir, ".github/workflows"))).toEqual(["kedgeway.yml"]);
  });

  it("errors when the target directory does not exist", async () => {
    await expect(writeWorkflow(join(dir, "nope"), rel, "x", { force: false })).rejects.toThrow(/not a directory|ENOENT/);
  });
});
