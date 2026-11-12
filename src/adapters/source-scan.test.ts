import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanImportHits } from "./source-scan.js";

let dir: string;
afterEach(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});

describe("scanImportHits", () => {
  it("finds a source import and skips node_modules", async () => {
    dir = await mkdtemp(join(tmpdir(), "kw-scan-"));
    await mkdir(join(dir, "src"), { recursive: true });
    await mkdir(join(dir, "node_modules", "soroban-client"), { recursive: true });
    await writeFile(join(dir, "src/app.ts"), 'import { Server } from "soroban-client";\n');
    await writeFile(join(dir, "node_modules/soroban-client/index.js"), 'module.exports = "soroban-client";\n');
    const scan = await scanImportHits(dir, ["soroban-client"]);
    expect(scan.truncated).toBe(false);
    expect(scan.hits).toEqual([{ file: "src/app.ts", line: 1, name: "soroban-client" }]);
  });

  it("does not follow a symlink out of the root", async () => {
    dir = await mkdtemp(join(tmpdir(), "kw-scan-"));
    const outside = await mkdtemp(join(tmpdir(), "kw-out-"));
    await writeFile(join(outside, "leak.ts"), 'import x from "soroban-client";\n');
    await symlink(outside, join(dir, "linked"));
    const scan = await scanImportHits(dir, ["soroban-client"]);
    expect(scan.hits).toEqual([]);
    await rm(outside, { recursive: true, force: true });
  });
});
