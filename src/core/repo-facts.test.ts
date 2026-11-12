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
    expect(m.deps).toEqual([{ name: "soroban-sdk", key: "soroban-sdk", raw: "21.0.0", workspace: false, line: 2 }]);
  });

  it("handles table form and dev-dependencies", () => {
    const m = parseCargoManifest(
      `[dev-dependencies]\nsoroban-sdk = { version = "21.1.0", features = ["testutils"] }\n`,
    );
    expect(m.deps).toEqual([{ name: "soroban-sdk", key: "soroban-sdk", raw: "21.1.0", workspace: false, line: 2 }]);
  });

  it("flags workspace = true references", () => {
    const m = parseCargoManifest(`[dependencies]\nsoroban-sdk = { workspace = true }\n`);
    expect(m.deps).toEqual([{ name: "soroban-sdk", key: "soroban-sdk", raw: "", workspace: true, line: 2 }]);
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
    expect(m.deps).toEqual([{ name: "soroban-sdk", key: "sdk", raw: "21", workspace: false, line: 2 }]);
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
      { name: "soroban-sdk", raw: "21.0.0", version: "21.0.0", major: 21, resolved: null, resolvedFrom: null, file: "a/Cargo.toml", line: 2, declaredIn: "Cargo.toml" },
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
      { name: "soroban-sdk", raw: "21.0.0", version: "21.0.0", major: 21, resolved: null, resolvedFrom: null, file: "contracts/a/Cargo.toml", line: 2, declaredIn: "Cargo.toml" },
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
      { name: "soroban-sdk", raw: "", version: null, major: null, resolved: null, resolvedFrom: null, file: "a/Cargo.toml", line: 2 },
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
        { name: "@stellar/stellar-sdk", raw: "^12.1.0", version: "12.1.0", major: 12, resolved: null, resolvedFrom: null, file: "package.json", line: 1 },
        { name: "soroban-client", raw: "~1.0.1", version: "1.0.1", major: 1, resolved: null, resolvedFrom: null, file: "package.json", line: 1 },
        { name: "stellar-sdk", raw: ">=10.0.0", version: "10.0.0", major: 10, resolved: null, resolvedFrom: null, file: "package.json", line: 1 },
        { name: "@stellar/stellar-base", raw: "12.0.0", version: "12.0.0", major: 12, resolved: null, resolvedFrom: null, file: "package.json", line: 1 },
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

describe("manifest lines", () => {
  it("records the 1-based line of the soroban-sdk key in Cargo manifests", () => {
    const text = `[package]\nname = "x"\n\n[dependencies]\nserde = "1"\nsoroban-sdk = "21.0.0"\n\n[dev-dependencies.soroban-sdk]\nversion = "21.0.0"\n`;
    const m = parseCargoManifest(text);
    expect(m.deps.map((d) => d.line)).toEqual([6, 8]);
    expect(resolveRustDeps([{ file: "Cargo.toml", manifest: m }]).map((d) => d.line)).toEqual([6]);
  });

  it("uses the member's own line for workspace-inherited deps and the root line when unreferenced", () => {
    const root = parseCargoManifest(`[workspace]\nmembers = ["a"]\n\n[workspace.dependencies]\nsoroban-sdk = "21.0.0"\n`);
    const member = parseCargoManifest(`[package]\nname = "a"\n[dependencies]\nsoroban-sdk = { workspace = true }\n`);
    expect(
      resolveRustDeps([
        { file: "Cargo.toml", manifest: root },
        { file: "a/Cargo.toml", manifest: member },
      ]).map((d) => [d.file, d.line]),
    ).toEqual([["a/Cargo.toml", 4]]);
    expect(resolveRustDeps([{ file: "Cargo.toml", manifest: root }]).map((d) => d.line)).toEqual([5]);
  });

  it("records the line of each stellar key in package.json", () => {
    const text = `{\n  "name": "x",\n  "dependencies": {\n    "left": "1",\n    "@stellar/stellar-sdk": "^12.0.0"\n  },\n  "devDependencies": {\n    "soroban-client": "1.0.0"\n  }\n}\n`;
    const { deps } = parsePackageJsonDeps(text, "package.json");
    expect(Object.fromEntries(deps.map((d) => [d.name, d.line]))).toEqual({ "@stellar/stellar-sdk": 5, "soroban-client": 8 });
  });
});

describe("package.json npm: aliases", () => {
  it("treats an alias to a Stellar package as that package and remembers the declared key and value", () => {
    const text = JSON.stringify({
      dependencies: { "stellar-sdk": "npm:@stellar/stellar-sdk@17.4.0", "stellar-sdk-next": "npm:@stellar/stellar-sdk@17.4.0", other: "npm:left-pad@1" },
    });
    const { deps } = parsePackageJsonDeps(text, "package.json");
    expect(deps).toHaveLength(2); // one per declared key: migrate must edit each member
    expect(deps[0]).toMatchObject({
      name: "@stellar/stellar-sdk",
      raw: "17.4.0",
      version: "17.4.0",
      major: 17,
      declaredKey: "stellar-sdk",
      declaredRaw: "npm:@stellar/stellar-sdk@17.4.0",
    });
    expect(deps[1]).toMatchObject({ declaredKey: "stellar-sdk-next" });
  });

  it("an alias without a version means any version (raw *, version unknown)", () => {
    const { deps } = parsePackageJsonDeps(JSON.stringify({ dependencies: { sdk: "npm:@stellar/stellar-sdk" } }), "package.json");
    expect(deps[0]).toMatchObject({ name: "@stellar/stellar-sdk", raw: "*", version: null, major: null, declaredKey: "sdk", declaredRaw: "npm:@stellar/stellar-sdk" });
  });

  it("an alias to the legacy package stays legacy", () => {
    const { deps } = parsePackageJsonDeps(JSON.stringify({ dependencies: { foo: "npm:stellar-sdk" } }), "package.json");
    expect(deps[0]).toMatchObject({ name: "stellar-sdk", raw: "*", declaredKey: "foo" });
    const v = parsePackageJsonDeps(JSON.stringify({ dependencies: { foo: "npm:soroban-client@^1.0.0" } }), "package.json");
    expect(v.deps[0]).toMatchObject({ name: "soroban-client", raw: "^1.0.0", declaredKey: "foo" });
  });

  it("does not record declaredKey for plain entries", () => {
    const { deps } = parsePackageJsonDeps(JSON.stringify({ dependencies: { "@stellar/stellar-sdk": "^12.0.0" } }), "package.json");
    expect(deps[0]?.declaredKey).toBeUndefined();
  });
});

describe("package.json lines (span-aware)", () => {
  it("ignores look-alike keys in other objects, such as overrides.dependencies, earlier in the file", () => {
    const text = [
      "{",
      '  "overrides": {',
      '    "dependencies": {',
      '      "@stellar/stellar-sdk": "1.0.0"',
      "    }",
      "  },",
      '  "dependencies": {',
      '    "@stellar/stellar-sdk": "^12.0.0"',
      "  }",
      "}",
    ].join("\n");
    const { deps } = parsePackageJsonDeps(text, "package.json");
    expect(deps).toHaveLength(1);
    expect(deps[0]?.line).toBe(8);
  });

  it("finds a key that is only in devDependencies, and not-top-level sections never count", () => {
    const text = '{\n  "dependencies": {\n    "left": "1"\n  },\n  "devDependencies": {\n    "@stellar/stellar-sdk": "^12.0.0"\n  },\n  "config": { "devDependencies": { "soroban-client": "1.0.0" } }\n}\n';
    const { deps } = parsePackageJsonDeps(text, "package.json");
    expect(deps.map((d) => [d.name, d.line])).toEqual([["@stellar/stellar-sdk", 6]]);
  });

  it("copes with a BOM and CRLF line endings", () => {
    const text = '\uFEFF{\r\n  "dependencies": {\r\n    "@stellar/stellar-sdk": "^12.0.0"\r\n  }\r\n}\r\n';
    expect(parsePackageJsonDeps(text, "package.json").deps[0]?.line).toBe(3);
  });
});
