import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DetectedDep, RepoFacts } from "../core/repo-facts.js";
import { lockfileHints, resolveLockfiles } from "./lockfile-resolver.js";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "kw-lock-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function put(rel: string, content: string): Promise<void> {
  const full = join(dir, rel);
  await mkdir(join(full, ".."), { recursive: true });
  await writeFile(full, content);
}

const dep = (name: string, raw: string, file: string): DetectedDep => ({
  name,
  raw,
  version: raw.replace(/^[\^~]/, ""),
  major: Number.parseInt(raw.replace(/^[\^~]/, ""), 10),
  file,
  resolved: null,
  resolvedFrom: null,
});
const facts = (rustDeps: DetectedDep[], jsDeps: DetectedDep[] = []): RepoFacts => ({ root: dir, rustDeps, jsDeps, manifestErrors: [] });

const cargoLock = (v: string): string => `[[package]]\nname = "soroban-sdk"\nversion = "${v}"\n`;

describe("resolveLockfiles", () => {
  it("resolves a Rust dep from the workspace Cargo.lock above the member", async () => {
    await put("Cargo.lock", cargoLock("21.7.6"));
    const r = await resolveLockfiles(dir, facts([dep("soroban-sdk", "^21", "contracts/a/Cargo.toml")]));
    expect(r.rustDeps[0]).toMatchObject({ resolved: "21.7.6", resolvedFrom: "Cargo.lock" });
  });

  it("prefers the nearest lockfile", async () => {
    await put("Cargo.lock", cargoLock("21.0.0"));
    await put("a/Cargo.lock", cargoLock("22.0.0"));
    const r = await resolveLockfiles(dir, facts([dep("soroban-sdk", "22", "a/Cargo.toml")]));
    expect(r.rustDeps[0]?.resolved).toBe("22.0.0");
  });

  it("walks past a lockfile that does not contain the package", async () => {
    await put("Cargo.lock", cargoLock("21.0.0"));
    await put("a/Cargo.lock", `[[package]]\nname = "serde"\nversion = "1.0.0"\n`);
    const r = await resolveLockfiles(dir, facts([dep("soroban-sdk", "21", "a/Cargo.toml")]));
    expect(r.rustDeps[0]?.resolved).toBe("21.0.0");
  });

  it("resolves JS deps from package-lock, pnpm-lock and yarn.lock", async () => {
    await put("p1/package-lock.json", JSON.stringify({ packages: { "node_modules/@stellar/stellar-sdk": { version: "12.3.0" } } }));
    await put("p2/pnpm-lock.yaml", "packages:\n\n  '@stellar/stellar-sdk@13.0.0':\n    resolution: {}\n");
    await put("p3/yarn.lock", '"@stellar/stellar-sdk@^14.0.0":\n  version "14.1.0"\n');
    const sdk = "@stellar/stellar-sdk";
    const r = await resolveLockfiles(
      dir,
      facts([], [dep(sdk, "^12", "p1/package.json"), dep(sdk, "^13", "p2/package.json"), dep(sdk, "^14.0.0", "p3/package.json")]),
    );
    expect(r.jsDeps.map((d) => [d.resolved, d.resolvedFrom])).toEqual([
      ["12.3.0", "package-lock.json"],
      ["13.0.0", "pnpm-lock.yaml"],
      ["14.1.0", "yarn.lock"],
    ]);
  });

  it("leaves deps unresolved when no lockfile exists, and never reads above the root", async () => {
    const r = await resolveLockfiles(dir, facts([dep("soroban-sdk", "21", "Cargo.toml")]));
    expect(r.rustDeps[0]).toMatchObject({ resolved: null, resolvedFrom: null });
  });

  it("ignores an unreadable/corrupt lockfile", async () => {
    await put("Cargo.lock", "not = [toml");
    const r = await resolveLockfiles(dir, facts([dep("soroban-sdk", "21", "Cargo.toml")]));
    expect(r.rustDeps[0]?.resolved).toBeNull();
  });

  it("resolves the direct dependency, not the highest entry, and notes ambiguity", async () => {
    await put("Cargo.lock", cargoLock("21.7.6") + cargoLock("22.0.1"));
    const r = await resolveLockfiles(
      dir,
      facts([dep("soroban-sdk", "^21", "a/Cargo.toml"), dep("soroban-sdk", ">=21", "b/Cargo.toml")]),
    );
    expect(r.rustDeps[0]).toMatchObject({ resolved: "21.7.6", resolvedFrom: "Cargo.lock" });
    expect(r.rustDeps[1]).toMatchObject({ resolved: null, resolvedFrom: null, lockNote: expect.stringContaining("ambiguous in Cargo.lock") });
  });

  it("uses the pnpm importer path of the member relative to the lockfile", async () => {
    await put(
      "pnpm-lock.yaml",
      "importers:\n\n  .:\n    dependencies:\n      '@stellar/stellar-sdk':\n        specifier: ^12.0.0\n        version: 12.1.0\n  web:\n    dependencies:\n      '@stellar/stellar-sdk':\n        specifier: ^13.0.0\n        version: 13.2.0\n",
    );
    const sdk = "@stellar/stellar-sdk";
    const r = await resolveLockfiles(dir, facts([], [dep(sdk, "^12.0.0", "package.json"), dep(sdk, "^13.0.0", "web/package.json")]));
    expect(r.jsDeps.map((d) => d.resolved)).toEqual(["12.1.0", "13.2.0"]);
  });

  it("hints at a lockfile above the scan root when deps stayed unresolved", async () => {
    await put("Cargo.lock", cargoLock("21.7.6"));
    await put("repo/Cargo.toml", "");
    const root = join(dir, "repo");
    const f: RepoFacts = { root, rustDeps: [dep("soroban-sdk", "^21", "Cargo.toml")], jsDeps: [], manifestErrors: [] };
    const hints = await lockfileHints(root, await resolveLockfiles(root, f));
    expect(hints).toHaveLength(1);
    expect(hints[0]).toContain("Cargo.lock");
    expect(hints[0]).toContain(dir);
  });

  it("gives no hint when everything resolved or nothing exists above", async () => {
    await put("repo/Cargo.lock", cargoLock("21.7.6"));
    const root = join(dir, "repo");
    const f: RepoFacts = { root, rustDeps: [dep("soroban-sdk", "^21", "Cargo.toml")], jsDeps: [], manifestErrors: [] };
    expect(await lockfileHints(root, await resolveLockfiles(root, f))).toEqual([]);
    expect(await lockfileHints(root, { ...f, rustDeps: [dep("soroban-sdk", "^21", "Cargo.toml")] })).toEqual([]);
  });
});
