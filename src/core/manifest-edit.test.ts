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

  it("does not mistake keys that merely end in 'version' for the version key", () => {
    const src = `[dependencies]\nsoroban-sdk = { min-version = "21.0.0", version = "22.0.0" }\n`;
    expect(bumpCargoDep(src, "21.0.0", "28.0.0")).toEqual({ text: src, count: 0 });
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

describe("editPackageJson: byte-exact span edits", () => {
  const bump = step({});

  it("changes only the value span; everything else round-trips byte for byte", () => {
    const src =
      '\uFEFF{\r\n  "big": 12345678901234567890123,\n\t"one": 1.0,\n  "esc": "caf\u00e9 \\/ \\u00e9",\n  "7": "int-like", "2": "key",\n' +
      '  "dup": 1, "dup": 2,\n  "dependencies": {"a":"1",  "@stellar/stellar-sdk" :   "^12.0.0" ,"z":"2"}\r\n}';
    const r = editPackageJson(src, [bump]);
    expect(r.text).toBe(src.replace('"^12.0.0"', '"^17.2.1"'));
    expect(r.applied).toHaveLength(1);
  });

  it("keeps minified files minified", () => {
    const src = '{"name":"x","dependencies":{"@stellar/stellar-sdk":"^12.0.0"}}';
    expect(editPackageJson(src, [bump]).text).toBe('{"name":"x","dependencies":{"@stellar/stellar-sdk":"^17.2.1"}}');
  });

  it("ignores same-named keys outside dependencies/devDependencies", () => {
    const src = '{"overrides":{"@stellar/stellar-sdk":"^12.0.0"},"dependencies":{"x":"1"}}';
    const r = editPackageJson(src, [bump]);
    expect(r.text).toBe(src);
    expect(r.skipped[0]?.reason).toMatch(/outside dependencies\/devDependencies.*overrides.*edit manually/i);
  });

  it("explains peer/optional/resolutions declarations too", () => {
    for (const section of ["peerDependencies", "optionalDependencies", "resolutions"]) {
      const src = `{"${section}":{"@stellar/stellar-sdk":"^12.0.0"}}`;
      expect(editPackageJson(src, [bump]).skipped[0]?.reason).toContain(section);
    }
  });

  const legacy = step({ kind: "replace-legacy-package", dependency: "soroban-client", from: "^1.0.0", to: "^17.2.1", replacement: "@stellar/stellar-sdk" });

  it("legacy replacement edits only the key and value spans", () => {
    const src = '{"dependencies":{"a":"1", "soroban-client" :  "^1.0.0",\n "z":"2"}}';
    expect(editPackageJson(src, [legacy]).text).toBe('{"dependencies":{"a":"1", "@stellar/stellar-sdk" :  "^17.2.1",\n "z":"2"}}');
  });

  it("removes a middle or last legacy member cleanly when the replacement exists, and renames a sole one", () => {
    const r = { ...legacy };
    const mid = '{"dependencies":{"@stellar/stellar-sdk":"^17.0.0","soroban-client":"^1.0.0","z":"2"}}';
    expect(editPackageJson(mid, [r]).text).toBe('{"dependencies":{"@stellar/stellar-sdk":"^17.0.0","z":"2"}}');
    const last = '{\n  "dependencies": {\n    "@stellar/stellar-sdk": "^17.0.0",\n    "soroban-client": "^1.0.0"\n  }\n}\n';
    expect(editPackageJson(last, [r]).text).toBe('{\n  "dependencies": {\n    "@stellar/stellar-sdk": "^17.0.0"\n  }\n}\n');
    const only = '{"dependencies":{"soroban-client":"^1.0.0"},"x":1}';
    expect(editPackageJson(only, [{ ...r }]).text).toBe('{"dependencies":{"@stellar/stellar-sdk":"^17.2.1"},"x":1}');
  });

  it("does not count a legacy step as applied when nothing changed", () => {
    const noRepl = { ...legacy, replacement: undefined } as MigrationStep;
    const src = '{"dependencies":{"soroban-client":"^1.0.0"}}';
    const r = editPackageJson(src, [noRepl]);
    expect(r.text).toBe(src);
    expect(r.applied).toEqual([]);
    expect(r.skipped).toHaveLength(1);
  });

  it("edits duplicate dependencies sections and both sections independently", () => {
    const src = '{"dependencies":{"@stellar/stellar-sdk":"^12.0.0"},"devDependencies":{"@stellar/stellar-sdk":"^12.0.0"}}';
    expect(editPackageJson(src, [bump]).text).toBe(src.replaceAll("^12.0.0", "^17.2.1"));
  });
});

describe("editPackageJson: aliases", () => {
  const pkg = `{\n  "dependencies": {\n    "stellar-sdk": "npm:@stellar/stellar-sdk@^12.0.0",\n    "foo": "npm:soroban-client@^1.0.0"\n  }\n}\n`;
  it("rewrites an alias value and replaces a legacy alias member wholesale", () => {
    const r = editPackageJson(pkg, [
      { file: "package.json", kind: "bump-js-dep", dependency: "stellar-sdk", from: "npm:@stellar/stellar-sdk@^12.0.0", to: "npm:@stellar/stellar-sdk@^17.2.1", reason: "r", findingCode: "JS_SDK_BEHIND" },
      { file: "package.json", kind: "replace-legacy-package", dependency: "foo", from: "npm:soroban-client@^1.0.0", to: "^17.2.1", replacement: "@stellar/stellar-sdk", reason: "r", findingCode: "JS_LEGACY_PACKAGE" },
    ]);
    expect(r.skipped).toEqual([]);
    expect(r.text).toBe(`{\n  "dependencies": {\n    "stellar-sdk": "npm:@stellar/stellar-sdk@^17.2.1",\n    "@stellar/stellar-sdk": "^17.2.1"\n  }\n}\n`);
  });
});
