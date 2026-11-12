import { describe, expect, it } from "vitest";
import { diagnose, meetsThreshold } from "./diagnose.js";
import type { DetectedDep, RepoFacts } from "./repo-facts.js";
import type { EcosystemSnapshot } from "../ports/ecosystem.js";

const snap = (
  over: Partial<EcosystemSnapshot["sorobanSdk"]> = {},
  extra: Partial<EcosystemSnapshot> = {},
): EcosystemSnapshot => ({
  observedAt: "2026-01-01T00:00:00.000Z",
  sorobanSdk: { currentMajor: 23, deprecatedVersions: ["20.0.0"], source: "raven:scout", ...over },
  jsSdk: { currentVersion: "14.2.0", source: "raven:docs" },
  protocolCurrent: 25,
  degraded: [],
  notes: [],
  ...extra,
});

const mk = (name: string, version: string | null, file: string): DetectedDep => ({
  name,
  raw: version ?? "",
  version,
  major: version ? Number.parseInt(version, 10) : null,
  file,
});
const rust = (version: string | null, file = "Cargo.toml"): DetectedDep => mk("soroban-sdk", version, file);
const js = (name: string, version: string | null = "1.0.0"): DetectedDep => mk(name, version, "package.json");
const facts = (rustDeps: DetectedDep[], jsDeps: DetectedDep[] = [], manifestErrors: RepoFacts["manifestErrors"] = []): RepoFacts => ({
  root: "/r",
  rustDeps,
  jsDeps,
  manifestErrors,
});

describe("diagnose: soroban-sdk", () => {
  it("SDK_DEPRECATED when a Scout-deprecated major is below the official current major", () => {
    const d = diagnose(facts([rust("20.0.0")]), snap({ currentMajor: 21 }));
    expect(d.findings[0]).toMatchObject({ severity: "critical", code: "SDK_DEPRECATED", file: "Cargo.toml" });
    expect(d.findings[0]?.evidence).toContain("raven:scout");
    expect(d.findings[0]?.evidence).toContain("2026-01-01T00:00:00.000Z");
  });

  it("compares the Scout deprecated set on major, not exact string", () => {
    const d = diagnose(facts([rust("22.7.3")]), snap({ deprecatedVersions: ["22.0.1"] }));
    expect(d.findings[0]?.code).toBe("SDK_DEPRECATED");
  });

  it("official docs win: a Scout-deprecated major >= current is not deprecated", () => {
    const d = diagnose(facts([rust("29.0.0")]), snap({ currentMajor: 28, deprecatedVersions: ["29.0.0"] }));
    expect(d.findings[0]?.code).toBe("SDK_CURRENT");
  });

  it("SDK_DEPRECATED when major < currentMajor - 1", () => {
    expect(diagnose(facts([rust("21.4.0")]), snap()).findings[0]?.code).toBe("SDK_DEPRECATED");
  });

  it("SDK_BEHIND when major === currentMajor - 1", () => {
    expect(diagnose(facts([rust("22.0.1")]), snap()).findings[0]).toMatchObject({
      severity: "warning",
      code: "SDK_BEHIND",
    });
  });

  it("SDK_CURRENT when major === currentMajor, and when ahead", () => {
    expect(diagnose(facts([rust("23.0.0")]), snap()).findings[0]).toMatchObject({ severity: "info", code: "SDK_CURRENT" });
    expect(diagnose(facts([rust("24.0.0")]), snap()).findings[0]?.code).toBe("SDK_CURRENT");
  });

  it("SDK_UNKNOWN when version unparseable, never claiming deprecated", () => {
    const d = diagnose(facts([rust(null)]), snap());
    expect(d.findings[0]).toMatchObject({ severity: "warning", code: "SDK_UNKNOWN" });
    expect(d.findings[0]?.message.toLowerCase()).not.toContain("deprecated");
  });

  it("SDK_UNKNOWN when currentMajor is null, even if Scout lists the version", () => {
    const d = diagnose(facts([rust("20.0.0")]), snap({ currentMajor: null }));
    expect(d.findings[0]).toMatchObject({ severity: "warning", code: "SDK_UNKNOWN" });
    expect(d.findings[0]?.evidence.toLowerCase()).toContain("unavailable");
  });
});

describe("diagnose: JS", () => {
  it("JS_LEGACY_PACKAGE for soroban-client and unscoped stellar-sdk", () => {
    const d = diagnose(facts([], [js("soroban-client"), js("stellar-sdk")]), snap());
    const legacy = d.findings.filter((f) => f.code === "JS_LEGACY_PACKAGE");
    expect(legacy).toHaveLength(2);
    expect(legacy.every((f) => f.severity === "critical")).toBe(true);
    expect(legacy[0]?.message).toContain("@stellar/stellar-sdk");
  });

  it.each([
    ["11.0.0", "JS_SDK_DEPRECATED", "critical"],
    ["13.1.0", "JS_SDK_BEHIND", "warning"],
    ["14.0.0", "JS_SDK_CURRENT", "info"],
    ["15.0.0", "JS_SDK_CURRENT", "info"],
  ])("@stellar/stellar-sdk %s -> %s", (version, code, severity) => {
    const d = diagnose(facts([], [js("@stellar/stellar-sdk", version)]), snap());
    expect(d.findings[0]).toMatchObject({ code, severity, file: "package.json" });
    expect(d.findings[0]?.evidence).toContain("raven:docs");
  });

  it("applies the same rules to @stellar/stellar-base", () => {
    const d = diagnose(facts([], [js("@stellar/stellar-base", "12.0.0")]), snap());
    expect(d.findings[0]?.code).toBe("JS_SDK_DEPRECATED");
  });

  it("JS_SDK_UNKNOWN when current version or dep version is unavailable", () => {
    const noCurrent = snap({}, { jsSdk: { currentVersion: null, source: "raven:docs" } });
    expect(diagnose(facts([], [js("@stellar/stellar-sdk", "12.0.0")]), noCurrent).findings[0]).toMatchObject({
      code: "JS_SDK_UNKNOWN",
      severity: "warning",
    });
    expect(diagnose(facts([], [js("@stellar/stellar-sdk", null)]), snap()).findings[0]?.code).toBe("JS_SDK_UNKNOWN");
  });
});

describe("diagnose: dependency reference", () => {
  it("attaches the declaring dependency to dep findings (workspace root when resolved)", () => {
    const ws: DetectedDep = { ...rust("21.0.0", "contracts/a/Cargo.toml"), declaredIn: "Cargo.toml" };
    const d = diagnose(facts([ws, rust("21.0.0", "b/Cargo.toml")], [js("@stellar/stellar-sdk", "12.0.0"), js("soroban-client")]), snap());
    expect(d.findings[0]?.dependency).toEqual({ name: "soroban-sdk", raw: "21.0.0", file: "Cargo.toml" });
    expect(d.findings[1]?.dependency).toEqual({ name: "soroban-sdk", raw: "21.0.0", file: "b/Cargo.toml" });
    expect(d.findings[2]?.dependency).toEqual({ name: "@stellar/stellar-sdk", raw: "1.0.0".replace("1.0.0", "12.0.0"), file: "package.json" });
    expect(d.findings[3]?.dependency).toEqual({ name: "soroban-client", raw: "1.0.0", file: "package.json" });
  });
});

describe("diagnose: meta findings", () => {
  it("NO_SDK_FOUND when nothing detected", () => {
    const d = diagnose(facts([]), snap());
    expect(d.findings).toHaveLength(1);
    expect(d.findings[0]).toMatchObject({ severity: "info", code: "NO_SDK_FOUND" });
  });

  it("MANIFEST_UNPARSEABLE warning per error, and no NO_SDK_FOUND claim", () => {
    const d = diagnose(facts([], [], [{ file: "bad/Cargo.toml", message: "unexpected token" }]), snap());
    expect(d.findings).toHaveLength(1);
    expect(d.findings[0]).toMatchObject({ severity: "warning", code: "MANIFEST_UNPARSEABLE", file: "bad/Cargo.toml" });
    expect(d.findings[0]?.evidence).toContain("unexpected token");
  });

  it("DATA_DEGRADED warning for each degraded entry", () => {
    const d = diagnose(facts([rust("23.0.0")]), snap({}, { degraded: ["scout.analyzeEcosystem: timeout", "x"] }));
    const deg = d.findings.filter((f) => f.code === "DATA_DEGRADED");
    expect(deg).toHaveLength(2);
    expect(deg[0]).toMatchObject({ severity: "warning" });
    expect(deg[0]?.message).toContain("scout.analyzeEcosystem: timeout");
  });

  it("summarises counts by severity", () => {
    const d = diagnose(facts([rust("21.0.0"), rust("22.0.0"), rust("23.0.0")], [js("soroban-client")]), snap());
    expect(d.summary).toEqual({ critical: 2, warning: 1, info: 1 });
  });
});

describe("meetsThreshold", () => {
  it("is true when any finding is at or above the severity", () => {
    const d = diagnose(facts([rust("22.0.1")]), snap()); // one warning
    expect(meetsThreshold(d, "info")).toBe(true);
    expect(meetsThreshold(d, "warning")).toBe(true);
    expect(meetsThreshold(d, "critical")).toBe(false);
  });
});
