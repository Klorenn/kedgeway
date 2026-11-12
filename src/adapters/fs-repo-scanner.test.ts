import { mkdtemp, mkdir, writeFile, rm, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { scanRepo } from "./fs-repo-scanner.js";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "sd-scan-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function put(rel: string, content: string): Promise<void> {
  const full = join(dir, rel);
  await mkdir(join(full, ".."), { recursive: true });
  await writeFile(full, content);
}

describe("scanRepo", () => {
  it("returns empty facts for an empty directory", async () => {
    const facts = await scanRepo(dir);
    expect(facts).toEqual({ root: dir, rustDeps: [], jsDeps: [], manifestErrors: [] });
  });

  it("throws when the path does not exist or is not a directory", async () => {
    await expect(scanRepo(join(dir, "nope"))).rejects.toThrow(/nope/);
    await put("file.txt", "x");
    await expect(scanRepo(join(dir, "file.txt"))).rejects.toThrow(/not a directory/i);
  });

  it("detects string, table and dev-dependency forms with relative paths", async () => {
    await put("a/Cargo.toml", `[dependencies]\nsoroban-sdk = "21.0.0"\n`);
    await put(
      "b/Cargo.toml",
      `[dev-dependencies]\nsoroban-sdk = { version = "20.3.1", features = ["testutils"] }\n`,
    );
    const facts = await scanRepo(dir);
    const byFile = Object.fromEntries(facts.rustDeps.map((d) => [d.file, d.version]));
    expect(byFile).toEqual({ "a/Cargo.toml": "21.0.0", "b/Cargo.toml": "20.3.1" });
  });

  it("resolves workspace = true against the root Cargo.toml", async () => {
    await put(
      "Cargo.toml",
      `[workspace]\nmembers = ["contracts/*"]\n[workspace.dependencies]\nsoroban-sdk = "22.0.0"\n`,
    );
    await put("contracts/token/Cargo.toml", `[dependencies]\nsoroban-sdk = { workspace = true }\n`);
    const facts = await scanRepo(dir);
    expect(facts.rustDeps).toEqual([
      { name: "soroban-sdk", raw: "22.0.0", version: "22.0.0", major: 22, file: "contracts/token/Cargo.toml", declaredIn: "Cargo.toml" },
    ]);
  });

  it("detects JS packages and keeps raw ranges", async () => {
    await put(
      "web/package.json",
      JSON.stringify({ dependencies: { "@stellar/stellar-sdk": "^13.0.0", "soroban-client": "1.0.0" } }),
    );
    const facts = await scanRepo(dir);
    expect(facts.jsDeps.map((d) => [d.name, d.raw, d.version, d.file])).toEqual(
      expect.arrayContaining([
        ["@stellar/stellar-sdk", "^13.0.0", "13.0.0", "web/package.json"],
        ["soroban-client", "1.0.0", "1.0.0", "web/package.json"],
      ]),
    );
  });

  it("skips node_modules, target, dist and .git", async () => {
    for (const skip of ["node_modules/x", "target/x", "dist/x", ".git/x", ".next/x", "vendor/x", "build/x", "coverage/x"]) {
      await put(`${skip}/Cargo.toml`, `[dependencies]\nsoroban-sdk = "1.0.0"\n`);
      await put(`${skip}/package.json`, JSON.stringify({ dependencies: { "stellar-sdk": "1.0.0" } }));
    }
    const facts = await scanRepo(dir);
    expect(facts.rustDeps).toEqual([]);
    expect(facts.jsDeps).toEqual([]);
  });

  it("respects max depth of 4", async () => {
    await put("a/b/c/d/Cargo.toml", `[dependencies]\nsoroban-sdk = "21.0.0"\n`); // depth 4 dirs -> ok
    await put("a/b/c/d/e/Cargo.toml", `[dependencies]\nsoroban-sdk = "20.0.0"\n`); // depth 5 -> skipped
    const facts = await scanRepo(dir);
    expect(facts.rustDeps.map((d) => d.file)).toEqual(["a/b/c/d/Cargo.toml"]);
  });

  it("reports unparseable manifests instead of silently ignoring them", async () => {
    await put("bad/Cargo.toml", "not = [valid");
    await put("web/package.json", "{nope");
    const facts = await scanRepo(dir);
    expect(facts.manifestErrors.map((e) => e.file).sort()).toEqual(["bad/Cargo.toml", "web/package.json"]);
    expect(facts.manifestErrors.every((e) => e.message.length > 0)).toBe(true);
  });

  it("continues past an unreadable directory and records it", async () => {
    await put("ok/Cargo.toml", `[dependencies]\nsoroban-sdk = "21.0.0"\n`);
    await put("locked/Cargo.toml", `[dependencies]\nsoroban-sdk = "20.0.0"\n`);
    await chmod(join(dir, "locked"), 0o000);
    try {
      const facts = await scanRepo(dir);
      expect(facts.rustDeps.map((d) => d.file)).toEqual(["ok/Cargo.toml"]);
      expect(facts.manifestErrors.map((e) => e.file)).toEqual(["locked"]);
    } finally {
      await chmod(join(dir, "locked"), 0o755);
    }
  });
});
