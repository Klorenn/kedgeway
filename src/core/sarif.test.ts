import { describe, expect, it } from "vitest";
import type { Diagnosis, Finding } from "./diagnose.js";
import { FINDINGS_REFERENCE } from "./findings-reference.js";
import { buildSarif } from "./sarif.js";

const finding = (over: Partial<Finding> = {}): Finding => ({
  severity: "critical",
  code: "SDK_DEPRECATED",
  message: "soroban-sdk 21.0.0 is deprecated",
  file: "contracts/a/Cargo.toml",
  evidence: "major 21 < 27",
  ...over,
});
const diag = (findings: Finding[]): Diagnosis => ({
  findings,
  summary: { critical: 0, warning: 0, info: 0 },
});

describe("buildSarif", () => {
  const log = buildSarif(diag([finding()]), { version: "1.2.3" });
  const run = log.runs[0];

  it("is a single SARIF 2.1.0 run with the schema URL", () => {
    expect(log.$schema).toBe("https://json.schemastore.org/sarif-2.1.0.json");
    expect(log.version).toBe("2.1.0");
    expect(log.runs).toHaveLength(1);
    expect(run?.tool.driver).toMatchObject({ name: "kedgeway", version: "1.2.3" });
  });

  it("declares one rule per finding code with the required fields", () => {
    const rules = run?.tool.driver.rules ?? [];
    expect(rules.map((r) => r.id)).toEqual(FINDINGS_REFERENCE.map((f) => f.code));
    expect(rules).toHaveLength(18);
    const ids = rules.map((r) => r.id);
    for (const id of ["CLI_DEPRECATED", "CLI_BEHIND", "CLI_CURRENT", "CLI_UNKNOWN", "RUST_TARGET_LEGACY", "RUST_TOOLCHAIN_OLD"]) expect(ids).toContain(id);
    for (const r of rules) {
      expect(r.shortDescription.text.length).toBeGreaterThan(0);
      expect(r.shortDescription.text).not.toBe(r.id);
      expect(r.fullDescription.text.length).toBeGreaterThan(0);
      expect(["error", "warning", "note"]).toContain(r.defaultConfiguration.level);
    }
  });

  it("maps critical/warning/info to error/warning/note for rules and results", () => {
    const rules = Object.fromEntries((run?.tool.driver.rules ?? []).map((r) => [r.id, r.defaultConfiguration.level]));
    expect(rules["SDK_DEPRECATED"]).toBe("error");
    expect(rules["SDK_BEHIND"]).toBe("warning");
    expect(rules["SDK_CURRENT"]).toBe("note");
    const l = buildSarif(
      diag([
        finding(),
        finding({ severity: "warning", code: "SDK_BEHIND" }),
        finding({ severity: "info", code: "SDK_CURRENT" }),
      ]),
      { version: "1" },
    );
    expect(l.runs[0]?.results.map((r) => r.level)).toEqual(["error", "warning", "note"]);
  });

  it("emits results with ruleId, ruleIndex, message and a repo-relative location", () => {
    const res = run?.results[0];
    expect(res).toMatchObject({
      ruleId: "SDK_DEPRECATED",
      level: "error",
      message: { text: "soroban-sdk 21.0.0 is deprecated" },
      properties: { evidence: "major 21 < 27" },
    });
    expect(run?.tool.driver.rules[res?.ruleIndex ?? -1]?.id).toBe("SDK_DEPRECATED");
    expect(res?.locations?.[0]?.physicalLocation).toEqual({
      artifactLocation: { uri: "contracts/a/Cargo.toml", uriBaseId: "%SRCROOT%" },
      region: { startLine: 1 },
    });
  });

  it("points at the finding's line when it has one", () => {
    const l = buildSarif(diag([finding({ code: "CLI_DEPRECATED", file: ".github/workflows/ci.yml", line: 23 })]), { version: "1" });
    expect(l.runs[0]?.results[0]?.locations?.[0]?.physicalLocation.region).toEqual({ startLine: 23 });
  });

  it("never emits a startLine below 1", () => {
    const l = buildSarif(diag([finding({ line: 0 }), finding({ line: -3 })]), { version: "1" });
    expect(l.runs[0]?.results.map((r) => r.locations?.[0]?.physicalLocation.region.startLine)).toEqual([1, 1]);
  });

  it("prefixes uris when the scan root is below the repo root", () => {
    const l = buildSarif(diag([finding({ file: "a/Cargo.toml" })]), { version: "1", uriPrefix: "contracts" });
    expect(l.runs[0]?.results[0]?.locations?.[0]?.physicalLocation.artifactLocation.uri).toBe("contracts/a/Cargo.toml");
  });

  it("omits locations for findings that are not about a file in the repo", () => {
    const l = buildSarif(
      diag([
        finding({ code: "DATA_DEGRADED", severity: "warning", file: "(ecosystem data)" }),
        finding({ code: "NO_SDK_FOUND", severity: "info", file: "/abs/path/to/repo" }),
      ]),
      { version: "1" },
    );
    for (const r of l.runs[0]?.results ?? []) expect(r.locations).toBeUndefined();
  });

  it("serialises to JSON and handles an empty diagnosis", () => {
    const l = buildSarif(diag([]), { version: "1" });
    expect(l.runs[0]?.results).toEqual([]);
    expect(JSON.parse(JSON.stringify(l))).toEqual(l);
  });

  it("percent-encodes each uri segment but keeps the separators", () => {
    const l = buildSarif(diag([finding({ file: "my contracts/a#1/Cargo.toml" })]), { version: "1", uriPrefix: "sub dir" });
    expect(l.runs[0]?.results[0]?.locations?.[0]?.physicalLocation.artifactLocation.uri).toBe("sub%20dir/my%20contracts/a%231/Cargo.toml");
  });

  it("declares %SRCROOT% in originalUriBaseIds with a description only", () => {
    expect(log.runs[0]?.originalUriBaseIds).toEqual({ "%SRCROOT%": { description: { text: expect.any(String) } } });
    expect(JSON.stringify(log.runs[0]?.originalUriBaseIds)).not.toContain("file:");
  });

  it("uses absolute file:// uris without uriBaseId when the scan root is outside the repo", () => {
    const l = buildSarif(diag([finding({ file: "a b/Cargo.toml" })]), { version: "1", absoluteRootUri: "file:///tmp/other%20repo/" });
    expect(l.runs[0]?.results[0]?.locations?.[0]?.physicalLocation.artifactLocation).toEqual({
      uri: "file:///tmp/other%20repo/a%20b/Cargo.toml",
    });
  });
});
