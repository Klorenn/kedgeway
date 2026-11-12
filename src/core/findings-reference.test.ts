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
});
