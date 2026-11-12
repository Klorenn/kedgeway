import { describe, expect, it } from "vitest";
import { bumpCargoDep, editPackageJson } from "./manifest-edit.js";
import type { MigrationStep } from "./migration.js";

const step = (over: Partial<MigrationStep>): MigrationStep => ({
  file: "package.json",
  kind: "bump-js-dep",
  dependency: "@stellar/stellar-sdk",
  from: "^12.0.0",
  to: "^17.2.1",
  reason: "r",
  findingCode: "JS_SDK_DEPRECATED",
  ...over,
});

describe("bumpCargoDep", () => {
  it("edits only the string-form version and leaves every other byte alone", () => {
    const src = `[package]\nname = "x" # keep\nversion = "0.1.0"\n\n[dependencies]\nserde = "1" # untouched\nsoroban-sdk = "21.0.0" # pinned\n`;
    const r = bumpCargoDep(src, "21.0.0", "28.0.0");
    expect(r.count).toBe(1);
    expect(r.text).toBe(src.replace('soroban-sdk = "21.0.0"', 'soroban-sdk = "28.0.0"'));
  });

  it("edits table form keeping features, and both [dependencies] and [dev-dependencies]", () => {
    const src = `[dependencies]\nsoroban-sdk = "21.0.0"\n\n[dev-dependencies]\nsoroban-sdk = { version = "21.0.0", features = ["testutils"] }\n`;
    const r = bumpCargoDep(src, "21.0.0", "28.0.0");
    expect(r.count).toBe(2);
    expect(r.text).toBe(
      `[dependencies]\nsoroban-sdk = "28.0.0"\n\n[dev-dependencies]\nsoroban-sdk = { version = "28.0.0", features = ["testutils"] }\n`,
    );
  });

  it("edits [workspace.dependencies] and leaves workspace = true members untouched", () => {
    const root = `[workspace.dependencies]\nsoroban-sdk = "21.0.0"\n`;
    expect(bumpCargoDep(root, "21.0.0", "28.0.0").text).toBe(`[workspace.dependencies]\nsoroban-sdk = "28.0.0"\n`);
    const member = `[dependencies]\nsoroban-sdk = { workspace = true }\n`;
    expect(bumpCargoDep(member, "21.0.0", "28.0.0")).toEqual({ text: member, count: 0 });
  });

  it("handles renamed deps (package = ...) and ignores other crates with the same version", () => {
    const src = `[dependencies]\nsdk = { package = "soroban-sdk", version = "21" }\nother = "21"\n`;
    const r = bumpCargoDep(src, "21", "28.0.0");
    expect(r.count).toBe(1);
    expect(r.text).toBe(`[dependencies]\nsdk = { package = "soroban-sdk", version = "28.0.0" }\nother = "21"\n`);
  });

  it("handles the [dependencies.soroban-sdk] sub-table form", () => {
    const src = `[dependencies.soroban-sdk]\nversion = "21.0.0"\nfeatures = ["alloc"]\n`;
    expect(bumpCargoDep(src, "21.0.0", "28.0.0").text).toBe(
      `[dependencies.soroban-sdk]\nversion = "28.0.0"\nfeatures = ["alloc"]\n`,
    );
  });

  it("does not touch a different version and preserves CRLF endings", () => {
    const src = `[dependencies]\r\nsoroban-sdk = "20.0.0"\r\n`;
    expect(bumpCargoDep(src, "21.0.0", "28.0.0")).toEqual({ text: src, count: 0 });
    const crlf = `[dependencies]\r\nsoroban-sdk = "21.0.0"\r\n`;
    expect(bumpCargoDep(crlf, "21.0.0", "28.0.0").text).toBe(`[dependencies]\r\nsoroban-sdk = "28.0.0"\r\n`);
  });
});

describe("editPackageJson", () => {
  it("bumps in dependencies and devDependencies, keeping key order, indent and trailing newline", () => {
    const src = `{\n    "name": "x",\n    "dependencies": {\n        "a": "1",\n        "@stellar/stellar-sdk": "^12.0.0"\n    },\n    "devDependencies": {\n        "@stellar/stellar-sdk": "^12.0.0"\n    }\n}\n`;
    const r = editPackageJson(src, [step({})]);
    expect(r.text).toBe(src.replaceAll('"^12.0.0"', '"^17.2.1"'));
    expect(r.applied).toHaveLength(1);
    expect(r.skipped).toEqual([]);
  });

  it("preserves tab indentation and a missing trailing newline", () => {
    const src = `{\n\t"dependencies": {\n\t\t"@stellar/stellar-sdk": "^12.0.0"\n\t}\n}`;
    expect(editPackageJson(src, [step({})]).text).toBe(src.replace("^12.0.0", "^17.2.1"));
  });

  it("replaces a legacy package in place, keeping its position", () => {
    const src = `{\n  "dependencies": {\n    "a": "1",\n    "soroban-client": "^1.0.0",\n    "z": "2"\n  }\n}\n`;
    const r = editPackageJson(src, [
      step({ kind: "replace-legacy-package", dependency: "soroban-client", from: "^1.0.0", to: "^17.2.1", replacement: "@stellar/stellar-sdk" }),
    ]);
    expect(r.text).toBe(src.replace('"soroban-client": "^1.0.0"', '"@stellar/stellar-sdk": "^17.2.1"'));
  });

  it("drops the legacy key when the replacement already exists", () => {
    const src = `{\n  "dependencies": {\n    "@stellar/stellar-sdk": "^17.0.0",\n    "stellar-sdk": "10.0.0"\n  }\n}\n`;
    const r = editPackageJson(src, [
      step({ kind: "replace-legacy-package", dependency: "stellar-sdk", from: "10.0.0", to: "^17.2.1", replacement: "@stellar/stellar-sdk" }),
    ]);
    expect(JSON.parse(r.text)).toEqual({ dependencies: { "@stellar/stellar-sdk": "^17.0.0" } });
  });

  it("skips steps that no longer match and reports invalid JSON", () => {
    const src = `{\n  "dependencies": { "@stellar/stellar-sdk": "^13.0.0" }\n}\n`;
    const r = editPackageJson(src, [step({})]);
    expect(r.text).toBe(src);
    expect(r.skipped).toHaveLength(1);
    expect(editPackageJson("{nope", [step({})]).skipped[0]?.reason).toMatch(/parse/i);
  });
});
