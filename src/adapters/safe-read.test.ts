import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readRegularFile } from "./safe-read.js";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "kw-safe-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("readRegularFile", () => {
  it("reads a regular file", async () => {
    await writeFile(join(dir, "a"), "hi");
    expect(await readRegularFile(join(dir, "a"), 100)).toBe("hi");
  });
  it("refuses symlinks (file, device and directory targets) without opening them", async () => {
    await writeFile(join(dir, "real"), "secret");
    await symlink(join(dir, "real"), join(dir, "l1"));
    await symlink("/dev/stdin", join(dir, "l2"));
    await symlink("/dev/zero", join(dir, "l3"));
    await mkdir(join(dir, "d"));
    await symlink(join(dir, "d"), join(dir, "l4"));
    for (const n of ["l1", "l2", "l3", "l4"]) expect(await readRegularFile(join(dir, n), 100)).toBeNull();
  });
  it("refuses non-regular files and oversized files", async () => {
    await mkdir(join(dir, "d"));
    expect(await readRegularFile(join(dir, "d"), 100)).toBeNull();
    await writeFile(join(dir, "big"), "x".repeat(101));
    expect(await readRegularFile(join(dir, "big"), 100)).toBeNull();
    expect(await readRegularFile(join(dir, "missing"), 100)).toBeNull();
  });
});
