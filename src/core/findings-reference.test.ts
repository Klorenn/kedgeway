import { describe, expect, it } from "vitest";
import { FINDINGS_REFERENCE } from "./findings-reference.js";

describe("FINDINGS_REFERENCE", () => {
  it("documents the 12 finding codes with a severity and meaning", () => {
    expect(FINDINGS_REFERENCE.map((f) => f.code).sort()).toEqual(
      [
        "DATA_DEGRADED",
        "JS_LEGACY_PACKAGE",
        "JS_SDK_BEHIND",
        "JS_SDK_CURRENT",
        "JS_SDK_DEPRECATED",
        "JS_SDK_UNKNOWN",
        "MANIFEST_UNPARSEABLE",
        "NO_SDK_FOUND",
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

  it("mentions lockfile resolution and cached snapshots where they change a verdict", () => {
    const by = Object.fromEntries(FINDINGS_REFERENCE.map((f) => [f.code, f.meaning]));
    expect(by["SDK_DEPRECATED"]).toMatch(/lockfile/i);
    expect(by["JS_SDK_BEHIND"]).toMatch(/lockfile/i);
    expect(by["DATA_DEGRADED"]).toMatch(/cached snapshot/i);
  });
});
