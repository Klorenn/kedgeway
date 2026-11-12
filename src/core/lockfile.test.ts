import { describe, expect, it } from "vitest";
import { compareVersions, indexLockfile, satisfies, type LockQuery } from "./lockfile.js";

const q = (name: string, raw: string, importer = "."): LockQuery => ({ name, raw, importer });

describe("compareVersions", () => {
  it("orders numerically, not lexically, and ranks prereleases lower", () => {
    expect(compareVersions("21.10.0", "21.9.9")).toBeGreaterThan(0);
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
    expect(compareVersions("22.0.0-rc.1", "22.0.0")).toBeLessThan(0);
    expect(compareVersions("20.5.0", "21.0.0")).toBeLessThan(0);
  });
  it("compares prerelease identifiers numerically, numeric below alphanumeric", () => {
    expect(compareVersions("1.0.0-rc.10", "1.0.0-rc.9")).toBeGreaterThan(0);
    expect(compareVersions("1.0.0-alpha.1", "1.0.0-alpha.beta")).toBeLessThan(0);
    expect(compareVersions("1.0.0-alpha", "1.0.0-alpha.1")).toBeLessThan(0);
    expect(compareVersions("1.0.0-beta.2", "1.0.0-beta.11")).toBeLessThan(0);
  });
});

describe("satisfies (cargo: bare means caret)", () => {
  it.each([
    ["21.7.6", "21", true],
    ["22.0.0", "21", false],
    ["21.7.6", "^21.7", true],
    ["21.6.0", "^21.7", false],
    ["21.7.6", "~21.7.0", true],
    ["21.8.0", "~21.7.0", false],
    ["21.7.6", "=21.7.6", true],
    ["21.7.7", "=21.7.6", false],
    ["0.2.5", "0.2.3", true],
    ["0.3.0", "0.2.3", false],
    ["0.0.3", "0.0.3", true],
    ["0.0.4", "0.0.3", false],
    ["22.1.0", ">=21, <23", true],
    ["23.0.0", ">=21, <23", false],
    ["21.5.0", "21.*", true],
    ["5.0.0", "*", true],
  ])("%s vs %s", (v, range, expected) => {
    expect(satisfies(v, range, "caret")).toBe(expected);
  });
});

describe("satisfies (npm: bare means exact)", () => {
  it.each([
    ["12.1.0", "12.1.0", true],
    ["12.1.1", "12.1.0", false],
    ["12.1.1", "^12.1.0", true],
    ["13.0.0", "^12.1.0 || ^13", true],
    ["12.9.0", "12.x", true],
    ["11.0.0", ">=12", false],
  ])("%s vs %s", (v, range, expected) => {
    expect(satisfies(v, range, "exact")).toBe(expected);
  });
});

describe("satisfies (npm ranges via semver)", () => {
  it.each([
    ["1.5.0", "1.2.3 - 2.3.4", true],
    ["2.4.0", "1.2.3 - 2.3.4", false],
    ["2.3.9", "1.2.3 - 2.3", true],
    ["13.1.0", "^12 || ^13", true],
    ["14.0.0", "^12 || ^13", false],
    ["12.4.1", "12.x", true],
    ["12.4.1", "12.4.X", true],
    ["13.0.0", "12.x", false],
    ["1.2.3", "*", true],
    ["1.2.3", "", true],
    ["1.2.4", ">=1.2.3 <1.3.0", true],
    ["1.3.0", ">=1.2.3 <1.3.0", false],
    ["1.2.3-beta.2", "^1.2.3-beta.1", true],
    ["1.2.4-beta.1", "^1.2.3", false], // prerelease of a higher tuple never satisfies a plain range
    ["2.0.0-rc.1", "^2.0.0", false],
    ["2.0.0-rc.1", ">=2.0.0-rc.0", true],
    ["1.0.0", "not a range", false],
  ])("%s vs %j", (v, range, expected) => {
    expect(satisfies(v, range, "exact")).toBe(expected);
  });
});

describe("Cargo.lock", () => {
  const lock = `version = 3

[[package]]
name = "serde"
version = "1.0.0"

[[package]]
name = "soroban-sdk"
version = "21.7.6"

[[package]]
name = "soroban-sdk"
version = "22.0.1"
`;
  const idx = indexLockfile("Cargo.lock", lock, ["soroban-sdk"]);
  it("picks the entry that satisfies the manifest requirement", () => {
    expect(idx.resolve(q("soroban-sdk", "^21"))).toEqual({ version: "21.7.6" });
    expect(idx.resolve(q("soroban-sdk", "22"))).toEqual({ version: "22.0.1" });
  });
  it("reports ambiguity when several or none satisfy, never the highest", () => {
    const r1 = idx.resolve(q("soroban-sdk", ">=21"));
    expect(r1).toEqual({ note: expect.stringContaining("ambiguous in Cargo.lock") });
    const r2 = idx.resolve(q("soroban-sdk", "^23"));
    expect(r2).toEqual({ note: expect.stringContaining("ambiguous in Cargo.lock") });
    const r3 = idx.resolve(q("soroban-sdk", ""));
    expect(r3).toEqual({ note: expect.stringContaining("ambiguous in Cargo.lock") });
  });
  it("takes the only entry when the manifest gives no requirement", () => {
    const one = indexLockfile("Cargo.lock", `[[package]]\nname = "soroban-sdk"\nversion = "21.7.6"\n`, ["soroban-sdk"]);
    expect(one.resolve(q("soroban-sdk", ""))).toEqual({ version: "21.7.6" });
  });
  it("returns null for absent crates and garbage", () => {
    expect(idx.resolve(q("nope", "1"))).toBeNull();
    expect(indexLockfile("Cargo.lock", "not = [toml", ["soroban-sdk"]).resolve(q("soroban-sdk", "21"))).toBeNull();
  });
});

describe("package-lock.json", () => {
  it("reads v2/v3 packages entries, ignoring nested copies", () => {
    const lock = JSON.stringify({
      packages: {
        "": {},
        "node_modules/@stellar/stellar-sdk": { version: "12.3.0" },
        "node_modules/other/node_modules/@stellar/stellar-sdk": { version: "9.0.0" },
      },
    });
    const idx = indexLockfile("package-lock.json", lock, ["@stellar/stellar-sdk", "soroban-client"]);
    expect(idx.resolve(q("@stellar/stellar-sdk", "^12"))).toEqual({ version: "12.3.0" });
    expect(idx.resolve(q("soroban-client", "1"))).toBeNull();
  });
  it("falls back to v1 dependencies and tolerates invalid JSON", () => {
    const idx = indexLockfile("package-lock.json", JSON.stringify({ dependencies: { "soroban-client": { version: "1.0.1" } } }), ["soroban-client"]);
    expect(idx.resolve(q("soroban-client", "1"))).toEqual({ version: "1.0.1" });
    expect(indexLockfile("package-lock.json", "{", ["x"]).resolve(q("x", "1"))).toBeNull();
  });
});

describe("pnpm-lock.yaml", () => {
  const names = ["@stellar/stellar-sdk", "stellar-sdk"];
  const lock = `lockfileVersion: '9.0'

importers:

  .:
    dependencies:
      '@stellar/stellar-sdk':
        specifier: ^12.0.0
        version: 12.1.0
  packages/web:
    devDependencies:
      '@stellar/stellar-sdk':
        specifier: ^13.0.0
        version: 13.2.0(react@18.0.0)

packages:

  '@stellar/stellar-sdk@12.1.0':
    resolution: {integrity: sha512-x}

  '@stellar/stellar-sdk@13.2.0':
    resolution: {integrity: sha512-y}

snapshots:

  '@stellar/stellar-sdk@12.1.0':
    dependencies: {}
`;
  const idx = indexLockfile("pnpm-lock.yaml", lock, names);
  it("reads the importer's direct dependency, stripping peer suffixes", () => {
    expect(idx.resolve(q("@stellar/stellar-sdk", "^12.0.0", "."))).toEqual({ version: "12.1.0" });
    expect(idx.resolve(q("@stellar/stellar-sdk", "^13.0.0", "packages/web"))).toEqual({ version: "13.2.0" });
  });
  it("falls back to the one package version that satisfies the range", () => {
    expect(idx.resolve(q("@stellar/stellar-sdk", "^13.0.0", "packages/other"))).toEqual({ version: "13.2.0" });
  });
  it("is ambiguous when the fallback matches several", () => {
    expect(idx.resolve(q("@stellar/stellar-sdk", ">=12", "packages/other"))).toEqual({
      note: expect.stringContaining("ambiguous in pnpm-lock.yaml"),
    });
  });
  it("reads the older top-level dependencies layout for the root importer", () => {
    const old = `lockfileVersion: 5.4\n\ndependencies:\n  stellar-sdk: 10.0.0_react@18.0.0\n\npackages:\n\n  /stellar-sdk/10.0.0_react@18.0.0:\n    resolution: {}\n`;
    expect(indexLockfile("pnpm-lock.yaml", old, names).resolve(q("stellar-sdk", "^10"))).toEqual({ version: "10.0.0" });
  });
});

describe("yarn.lock", () => {
  const names = ["@stellar/stellar-sdk", "soroban-client"];
  it("classic: matches the descriptor name@<manifest raw>, not just any entry", () => {
    const lock = `# yarn lockfile v1

"@stellar/stellar-sdk@^12.0.0", "@stellar/stellar-sdk@^12.1.0":
  version "12.1.0"

"@stellar/stellar-sdk@^13.0.0":
  version "13.2.0"

soroban-client@^1.0.0:
  version "1.0.1"
`;
    const idx = indexLockfile("yarn.lock", lock, names);
    expect(idx.resolve(q("@stellar/stellar-sdk", "^12.0.0"))).toEqual({ version: "12.1.0" });
    expect(idx.resolve(q("@stellar/stellar-sdk", "^13.0.0"))).toEqual({ version: "13.2.0" });
    expect(idx.resolve(q("soroban-client", "^1.0.0"))).toEqual({ version: "1.0.1" });
    expect(idx.resolve(q("@stellar/stellar-sdk", "^14.0.0"))).toBeNull();
  });
  it("berry: matches name@npm:<raw> and falls back to the resolution field", () => {
    const lock = `__metadata:
  version: 8

"@stellar/stellar-sdk@npm:^12.0.0":
  version: 12.2.0
  resolution: "@stellar/stellar-sdk@npm:12.2.0"

"soroban-client@npm:^1.0.0":
  resolution: "soroban-client@npm:1.0.1"
`;
    const idx = indexLockfile("yarn.lock", lock, names);
    expect(idx.resolve(q("@stellar/stellar-sdk", "^12.0.0"))).toEqual({ version: "12.2.0" });
    expect(idx.resolve(q("soroban-client", "^1.0.0"))).toEqual({ version: "1.0.1" });
  });
});
