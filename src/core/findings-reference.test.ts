import { describe, expect, it } from "vitest";
import { FINDINGS_REFERENCE } from "./findings-reference.js";

describe("FINDINGS_REFERENCE", () => {
  it("documents the 18 finding codes with a severity and meaning", () => {
    expect(FINDINGS_REFERENCE.map((f) => f.code).sort()).toEqual(
      [
        "CLI_BEHIND",
        "CLI_CURRENT",
        "CLI_DEPRECATED",
        "CLI_UNKNOWN",
        "DATA_DEGRADED",
        "JS_LEGACY_PACKAGE",
        "JS_SDK_BEHIND",
        "JS_SDK_CURRENT",
        "JS_SDK_DEPRECATED",
        "JS_SDK_UNKNOWN",
        "MANIFEST_UNPARSEABLE",
        "NO_SDK_FOUND",
        "RUST_TARGET_LEGACY",
        "RUST_TOOLCHAIN_OLD",
        "SDK_BEHIND",
        "SDK_CURRENT",
        "SDK_DEPRECATED",
        "SDK_UNKNOWN",
      ].sort(),
    );
    for (const f of FINDINGS_REFERENCE) {
      expect(["critical", "warning", "info"]).toContain(f.severity);
      expect(f.meaning.length).toBeGreaterThan(10);
    }
  });

  it("describes what `kedgeway migrate` does for each actionable code", () => {
    const withMigration = FINDINGS_REFERENCE.filter((f) => f.migration).map((f) => f.code).sort();
    expect(withMigration).toEqual(
      [
        "JS_LEGACY_PACKAGE",
        "JS_SDK_BEHIND",
        "JS_SDK_DEPRECATED",
        "JS_SDK_UNKNOWN",
        "MANIFEST_UNPARSEABLE",
        "SDK_BEHIND",
        "SDK_DEPRECATED",
        "SDK_UNKNOWN",
      ].sort(),
    );
  });

  it("gives the toolchain codes the documented severities and evidence-bearing meanings", () => {
    const by = Object.fromEntries(FINDINGS_REFERENCE.map((f) => [f.code, f]));
    expect(by["CLI_DEPRECATED"]?.severity).toBe("critical");
    expect(by["CLI_BEHIND"]?.severity).toBe("warning");
    expect(by["CLI_CURRENT"]?.severity).toBe("info");
    expect(by["CLI_UNKNOWN"]?.severity).toBe("warning");
    expect(by["RUST_TARGET_LEGACY"]?.severity).toBe("warning");
    expect(by["RUST_TOOLCHAIN_OLD"]?.severity).toBe("warning");
    expect(by["RUST_TARGET_LEGACY"]?.meaning).toMatch(/wasm32v1-none/);
    expect(by["RUST_TOOLCHAIN_OLD"]?.meaning).toMatch(/1\.84\.0/);
    expect(by["RUST_TARGET_LEGACY"]?.meaning).toMatch(/wasm-pack/);
    // migrate edits no toolchain files
    for (const c of ["CLI_DEPRECATED", "CLI_BEHIND", "CLI_CURRENT", "CLI_UNKNOWN", "RUST_TARGET_LEGACY", "RUST_TOOLCHAIN_OLD"]) expect(by[c]?.migration).toBeUndefined();
  });

  it("mentions lockfile resolution and cached snapshots where they change a verdict", () => {
    const by = Object.fromEntries(FINDINGS_REFERENCE.map((f) => [f.code, f.meaning]));
    expect(by["SDK_DEPRECATED"]).toMatch(/lockfile/i);
    expect(by["JS_SDK_BEHIND"]).toMatch(/lockfile/i);
    expect(by["DATA_DEGRADED"]).toMatch(/cached snapshot/i);
  });
});
