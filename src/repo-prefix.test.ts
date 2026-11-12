import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { repoPrefix } from "./sdk.js";

let base: string;
beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), "kw-prefix-"));
});
afterEach(async () => {
  await rm(base, { recursive: true, force: true });
});

describe("repoPrefix", () => {
  it("is empty for the same directory and the relative posix path below it", async () => {
    await mkdir(join(base, "a/b"), { recursive: true });
    expect(repoPrefix(base, base)).toBe("");
    expect(repoPrefix(join(base, "a/b"), base)).toBe("a/b");
  });

  it("is null when the scan root is outside the working directory", async () => {
    await mkdir(join(base, "repo"));
    await mkdir(join(base, "other"));
    expect(repoPrefix(join(base, "other"), join(base, "repo"))).toBeNull();
    expect(repoPrefix(base, join(base, "repo"))).toBeNull(); // the parent
  });

  it("treats a directory merely named like '..foo' as inside, by path segment", async () => {
    await mkdir(join(base, "..hidden/x"), { recursive: true });
    expect(repoPrefix(join(base, "..hidden/x"), base)).toBe("..hidden/x");
  });
});
