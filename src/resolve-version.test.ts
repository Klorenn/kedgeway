import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const script = resolve(root, "scripts/resolve-version.sh");

function resolveVersion(ref: string, input = ""): Promise<{ code: number; out: string }> {
  return new Promise((res) => {
    execFile("bash", [script, ref, input], (err, stdout) => {
      res({ code: err ? ((err as { code?: number }).code ?? 1) : 0, out: stdout.trim() });
    });
  });
}

describe("scripts/resolve-version.sh", () => {
  const cases: Array<[string, string, string, string]> = [
    ["v0.1.0 -> 0.1.0", "v0.1.0", "", "0.1.0"],
    ["0.1.0 -> 0.1.0", "0.1.0", "", "0.1.0"],
    ["v1.2.3-beta.1 keeps the prerelease", "v1.2.3-beta.1", "", "1.2.3-beta.1"],
    ["main -> source", "main", "", "source"],
    ["empty ref (local ./) -> source", "", "", "source"],
    ["v1.2 is not strict semver -> source", "v1.2", "", "source"],
    ["leading zero is not semver -> source", "v01.2.3", "", "source"],
    ["empty prerelease identifier -> source", "v1.2.3-a..b", "", "source"],
    ["a SHA -> source", "3f2a9c1d8e7b6a5f4e3d2c1b0a9f8e7d6c5b4a39", "", "source"],
    ["shell metacharacters in the ref -> source", "$(rm -rf /)", "", "source"],
    ["newline junk after a version -> source", "v1.2.3\n; echo hi", "", "source"],
    ["input `source` forces source", "v0.1.0", "source", "source"],
    ["input overrides the ref", "main", "v2.0.0", "2.0.0"],
    ["input overrides a different tag", "v0.1.0", "0.3.1", "0.3.1"],
  ];
  for (const [name, ref, input, expected] of cases) {
    it(name, async () => {
      const r = await resolveVersion(ref, input);
      expect(r.code).toBe(0);
      expect(r.out).toBe(expected);
    });
  }

  it("fails loudly on an invalid explicit input (no silent fallback)", async () => {
    const r = await resolveVersion("v0.1.0", "$(rm -rf /)");
    expect(r.code).not.toBe(0);
    expect(r.out).toBe("");
  });
  it("fails on a non-semver `1.2` input", async () => {
    expect((await resolveVersion("", "1.2")).code).not.toBe(0);
  });
});

describe("action.yml install paths", () => {
  it("installs from npm for a tag, builds from source otherwise, and converges on one KW_CLI", async () => {
    const y = await readFile(resolve(root, "action.yml"), "utf8");
    expect(y).toContain("version:");
    expect(y).toContain("github.action_ref");
    expect(y).toContain("scripts/resolve-version.sh");
    expect(y).toContain("npm install -g");
    expect(y).toContain("npm ci && npm run build");
    expect(y).toContain("KW_CLI: ${{ steps.install.outputs.cli }}");
  });
});
