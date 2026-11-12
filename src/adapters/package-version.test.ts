import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readPackageVersion } from "./package-version.js";

describe("readPackageVersion", () => {
  it("returns the version in package.json", async () => {
    const pkg = JSON.parse(await readFile(join(import.meta.dirname, "../../package.json"), "utf8")) as { version: string };
    expect(await readPackageVersion()).toBe(pkg.version);
  });
});
