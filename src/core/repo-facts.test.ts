import { describe, expect, it } from "vitest";
import {
  parseVersion,
  parseCargoManifest,
  resolveRustDeps,
  parsePackageJsonDeps,
} from "./repo-facts.js";

describe("parseVersion", () => {
  it.each([
    ["21.0.0", "21.0.0", 21],
    ["^21.0.0", "21.0.0", 21],
    ["~20.1", "20.1", 20],
    [">=19.0.0", "19.0.0", 19],
    ["=22.0.0-rc.1", "22.0.0-rc.1", 22],
    ["22", "22", 22],
  ])("parses %s", (raw, version, major) => {
    expect(parseVersion(raw)).toEqual({ version, major });
  });

  it.each(["*", "latest", "workspace:*", "", "git+https://x", "<21", "<=21.0.0", "^20 || ^21", ">=20 || <19"])("returns null for %s", (raw) => {
    expect(parseVersion(raw)).toEqual({ version: null, major: null });
  });
});

describe("parseCargoManifest", () => {
  it("handles string form", () => {
    const m = parseCargoManifest(`[dependencies]\nsoroban-sdk = "21.0.0"\n`);
    expect(m.deps).toEqual([{ name: "soroban-sdk", key: "soroban-sdk", raw: "21.0.0", workspace: false }]);
  });

  it("handles table form and dev-dependencies", () => {
    const m = parseCargoManifest(
      `[dev-dependencies]\nsoroban-sdk = { version = "21.1.0", features = ["testutils"] }\n`,
    );
    expect(m.deps).toEqual([{ name: "soroban-sdk", key: "soroban-sdk", raw: "21.1.0", workspace: false }]);
  });

  it("flags workspace = true references", () => {
    const m = parseCargoManifest(`[dependencies]\nsoroban-sdk = { workspace = true }\n`);
    expect(m.deps).toEqual([{ name: "soroban-sdk", key: "soroban-sdk", raw: "", workspace: true }]);
  });

  it("collects [workspace.dependencies]", () => {
    const m = parseCargoManifest(`[workspace.dependencies]\nsoroban-sdk = "20.5.0"\n`);
    expect(m.workspaceDeps).toEqual({ "soroban-sdk": "20.5.0" });
  });

  it("ignores other crates and tolerates invalid TOML", () => {
    expect(parseCargoManifest(`[dependencies]\nserde = "1"\n`).deps).toEqual([]);
  });

  it("reports an error for invalid TOML instead of swallowing it", () => {
    const m = parseCargoManifest(`not = [valid`);
    expect(m.deps).toEqual([]);
    expect(m.error).toMatch(/\S/);
    expect(parseCargoManifest(`[dependencies]\n`).error).toBeNull();
  });

  it("detects renamed deps via package = \"soroban-sdk\"", () => {
    const m = parseCargoManifest(`[dependencies]\nsdk = { package = "soroban-sdk", version = "21" }\n`);
    expect(m.deps).toEqual([{ name: "soroban-sdk", key: "sdk", raw: "21", workspace: false }]);
  });

  it("dedupes the same dep across [dependencies] and [dev-dependencies] when resolving", () => {
    const m = parseCargoManifest(
      `[dependencies]\nsoroban-sdk = "21.0.0"\n[dev-dependencies]\nsoroban-sdk = { version = "21.0.0", features = ["testutils"] }\n`,
    );
    expect(resolveRustDeps([{ file: "Cargo.toml", manifest: m }])).toHaveLength(1);
  });

  it("keeps different raw versions for the same file as separate deps", () => {
    const m = parseCargoManifest(
      `[dependencies]\nsoroban-sdk = "21.0.0"\n[dev-dependencies]\nsoroban-sdk = "22.0.0"\n`,
    );
    expect(resolveRustDeps([{ file: "Cargo.toml", manifest: m }])).toHaveLength(2);
  });
});

describe("resolveRustDeps", () => {
  it("resolves renamed workspace deps by key", () => {
    const root = parseCargoManifest(
      `[workspace.dependencies]\nsdk = { package = "soroban-sdk", version = "21.0.0" }\n`,
    );
    const member = parseCargoManifest(`[dependencies]\nsdk = { workspace = true }\n`);
    expect(
      resolveRustDeps([
        { file: "Cargo.toml", manifest: root },
        { file: "a/Cargo.toml", manifest: member },
      ]),
    ).toEqual([
      { name: "soroban-sdk", raw: "21.0.0", version: "21.0.0", major: 21, file: "a/Cargo.toml", declaredIn: "Cargo.toml" },
    ]);
  });

  it("resolves workspace refs against the nearest ancestor workspace", () => {
    const root = parseCargoManifest(
      `[workspace]\nmembers=["contracts/a"]\n[workspace.dependencies]\nsoroban-sdk = "21.0.0"\n`,
    );
    const member = parseCargoManifest(`[dependencies]\nsoroban-sdk = { workspace = true }\n`);
    const deps = resolveRustDeps([
      { file: "Cargo.toml", manifest: root },
      { file: "contracts/a/Cargo.toml", manifest: member },
    ]);
    expect(deps).toEqual([
      { name: "soroban-sdk", raw: "21.0.0", version: "21.0.0", major: 21, file: "contracts/a/Cargo.toml", declaredIn: "Cargo.toml" },
    ]);
  });

  it("reports an unreferenced workspace declaration at the root", () => {
    const root = parseCargoManifest(`[workspace.dependencies]\nsoroban-sdk = "21.0.0"\n`);
    const deps = resolveRustDeps([{ file: "Cargo.toml", manifest: root }]);
    expect(deps.map((d) => d.file)).toEqual(["Cargo.toml"]);
  });

  it("yields null version when a workspace ref cannot be resolved", () => {
    const member = parseCargoManifest(`[dependencies]\nsoroban-sdk = { workspace = true }\n`);
    const deps = resolveRustDeps([{ file: "a/Cargo.toml", manifest: member }]);
    expect(deps).toEqual([
      { name: "soroban-sdk", raw: "", version: null, major: null, file: "a/Cargo.toml" },
    ]);
  });
});

describe("parsePackageJsonDeps", () => {
  it("detects stellar packages in deps and devDeps, keeping the raw range", () => {
    const { deps } = parsePackageJsonDeps(
      JSON.stringify({
        dependencies: { "@stellar/stellar-sdk": "^12.1.0", "soroban-client": "~1.0.1", left: "1" },
        devDependencies: { "stellar-sdk": ">=10.0.0", "@stellar/stellar-base": "12.0.0" },
      }),
      "package.json",
    );
    expect(deps).toEqual(
      expect.arrayContaining([
        { name: "@stellar/stellar-sdk", raw: "^12.1.0", version: "12.1.0", major: 12, file: "package.json" },
        { name: "soroban-client", raw: "~1.0.1", version: "1.0.1", major: 1, file: "package.json" },
        { name: "stellar-sdk", raw: ">=10.0.0", version: "10.0.0", major: 10, file: "package.json" },
        { name: "@stellar/stellar-base", raw: "12.0.0", version: "12.0.0", major: 12, file: "package.json" },
      ]),
    );
    expect(deps).toHaveLength(4);
  });

  it("reports invalid JSON as an error", () => {
    const r = parsePackageJsonDeps("{nope", "package.json");
    expect(r.deps).toEqual([]);
    expect(r.error).toMatch(/\S/);
  });

  it("dedupes a package listed in both dependencies and devDependencies", () => {
    const { deps, error } = parsePackageJsonDeps(
      JSON.stringify({
        dependencies: { "@stellar/stellar-sdk": "^12.0.0" },
        devDependencies: { "@stellar/stellar-sdk": "^12.0.0" },
      }),
      "package.json",
    );
    expect(error).toBeNull();
    expect(deps).toHaveLength(1);
  });
});
