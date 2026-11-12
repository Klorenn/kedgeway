import { describe, expect, it } from "vitest";
import { diagnose, meetsThreshold } from "./diagnose.js";
import { parseVersion, type DetectedDep, type RepoFacts } from "./repo-facts.js";
import type { CliPin, RustTargetDecl, RustToolchainPin, ToolchainFacts } from "./toolchain.js";
import type { EcosystemSnapshot } from "../ports/ecosystem.js";

const snap = (
  over: Partial<EcosystemSnapshot["sorobanSdk"]> = {},
  extra: Partial<EcosystemSnapshot> = {},
): EcosystemSnapshot => ({
  observedAt: "2026-01-01T00:00:00.000Z",
  sorobanSdk: { currentMajor: 23, deprecatedVersions: ["20.0.0"], source: "raven:scout", ...over },
  jsSdk: { currentVersion: "14.2.0", source: "raven:docs" },
  stellarCli: { currentVersion: "28.1.0", source: "fake" },
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
  resolved: null,
  resolvedFrom: null,
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

describe("diagnose: lockfile resolution", () => {
  const resolvedRust = (raw: string, resolved: string): DetectedDep => ({
    ...mk("soroban-sdk", raw, "Cargo.toml"),
    resolved,
    resolvedFrom: "Cargo.lock",
  });

  it("compares the resolved version instead of the manifest range and says so in evidence", () => {
    const d = diagnose(facts([resolvedRust("^21", "21.7.6")]), snap({ currentMajor: 23, deprecatedVersions: [] }));
    expect(d.findings[0]).toMatchObject({ code: "SDK_DEPRECATED" });
    expect(d.findings[0]?.evidence).toContain("resolved 21.7.6 from Cargo.lock; manifest ^21");
  });

  it("a lax manifest range can resolve to the current major", () => {
    const d = diagnose(facts([resolvedRust("^22", "23.1.0")]), snap({ currentMajor: 23 }));
    expect(d.findings[0]?.code).toBe("SDK_CURRENT");
    expect(d.findings[0]?.message).toContain("resolved 23.1.0");
  });

  it("resolves an otherwise unparseable manifest range", () => {
    const d = diagnose(facts([{ ...resolvedRust("<21", "20.9.0") , version: null, major: null }]), snap({ currentMajor: 23 }));
    expect(d.findings[0]?.code).toBe("SDK_DEPRECATED");
  });

  it("uses the resolved version for JS deps too", () => {
    const dep: DetectedDep = { ...mk("@stellar/stellar-sdk", "^13.0.0", "package.json"), resolved: "13.9.0", resolvedFrom: "package-lock.json" };
    const d = diagnose(facts([], [dep]), snap());
    expect(d.findings[0]?.code).toBe("JS_SDK_BEHIND");
    expect(d.findings[0]?.evidence).toContain("resolved 13.9.0 from package-lock.json; manifest ^13.0.0");
  });

  it("mentions an ambiguous lockfile in evidence and falls back to the manifest", () => {
    const dep: DetectedDep = { ...mk("soroban-sdk", "21.0.0", "Cargo.toml"), lockNote: "ambiguous in Cargo.lock: 21.1.0, 21.2.0 all satisfy 21" };
    const d = diagnose(facts([dep]), snap());
    expect(d.findings[0]?.code).toBe("SDK_DEPRECATED");
    expect(d.findings[0]?.evidence).toContain("ambiguous in Cargo.lock");
  });

  it("keeps the dependency raw as the manifest value", () => {
    const d = diagnose(facts([resolvedRust("^21", "21.7.6")]), snap());
    expect(d.findings[0]?.dependency).toEqual({ name: "soroban-sdk", raw: "^21", file: "Cargo.toml", resolved: "21.7.6", resolvedFrom: "Cargo.lock" });
  });
});

describe("diagnose: manifest lines", () => {
  it("carries the dependency line on its finding", () => {
    const d = diagnose(facts([{ ...mk("soroban-sdk", "21.0.0", "Cargo.toml"), line: 12 }], [{ ...mk("soroban-client", "1.0.0", "package.json"), line: 5 }]), snap());
    expect(d.findings.map((f) => f.line)).toEqual([12, 5]);
  });
});

describe("diagnose: toolchain checks", () => {
  const pin = (raw: string, over: Partial<CliPin> = {}): CliPin => {
    const parsed = parseVersion(raw.replace(/^v/, ""));
    return { raw, version: parsed.version, major: parsed.major, file: ".github/workflows/ci.yml", line: 23, source: "workflow", via: "cargo install --version", ...over };
  };
  const tc = (over: Partial<ToolchainFacts> = {}): ToolchainFacts => ({ cliPins: [], rustTargets: [], rustToolchains: [], ...over });
  const withTc = (t: ToolchainFacts, rustDeps: DetectedDep[] = [rust("28.0.0")]): RepoFacts => ({ ...facts(rustDeps), toolchain: t });
  const cliSnap = (currentVersion: string | null = "28.1.0"): EcosystemSnapshot =>
    snap({}, { stellarCli: { currentVersion, source: "docs: software-versions" } });
  const codes = (d: ReturnType<typeof diagnose>): string[] => d.findings.map((f) => f.code);
  const unknownTarget = (line = 7, file = ".github/workflows/ci.yml"): RustTargetDecl => ({ target: "wasm32-unknown-unknown", file, line, via: "rustup target add" });

  it("says nothing about the CLI when no pin exists", () => {
    const d = diagnose(withTc(tc()), cliSnap());
    expect(codes(d).filter((c) => c.startsWith("CLI_"))).toEqual([]);
    expect(diagnose(facts([rust("28.0.0")]), cliSnap()).findings.map((f) => f.code)).toEqual(["SDK_CURRENT"]);
  });

  it("CLI_DEPRECATED (critical) when the pinned major is 2+ behind, with file, line and provenance", () => {
    const d = diagnose(withTc(tc({ cliPins: [pin("21.5.0")] })), cliSnap());
    const f = d.findings.find((x) => x.code === "CLI_DEPRECATED");
    expect(f).toMatchObject({ severity: "critical", file: ".github/workflows/ci.yml", line: 23 });
    expect(f?.message).toContain("21.5.0");
    expect(f?.evidence).toContain("pinned in .github/workflows/ci.yml:23");
    expect(f?.evidence).toContain("docs: software-versions");
    expect(f?.evidence).toContain("2026-01-01T00:00:00.000Z");
  });

  it("CLI_BEHIND (warning) exactly one major behind; CLI_CURRENT (info) on the current major or newer", () => {
    expect(diagnose(withTc(tc({ cliPins: [pin("27.9.0")] })), cliSnap()).findings.find((f) => f.code.startsWith("CLI_"))).toMatchObject({ code: "CLI_BEHIND", severity: "warning" });
    expect(diagnose(withTc(tc({ cliPins: [pin("28.0.1")] })), cliSnap()).findings.find((f) => f.code.startsWith("CLI_"))).toMatchObject({ code: "CLI_CURRENT", severity: "info" });
    const newer = diagnose(withTc(tc({ cliPins: [pin("29.0.0")] })), cliSnap()).findings.find((f) => f.code === "CLI_CURRENT");
    expect(newer?.message).toContain("or newer");
  });

  it("CLI_UNKNOWN (warning) when the pin is unparseable or the current CLI version is unavailable", () => {
    const unparseable = diagnose(withTc(tc({ cliPins: [pin("main")] })), cliSnap()).findings.find((f) => f.code.startsWith("CLI_"));
    expect(unparseable).toMatchObject({ code: "CLI_UNKNOWN", severity: "warning" });
    expect(unparseable?.evidence).toContain("unparseable");
    const noCurrent = diagnose(withTc(tc({ cliPins: [pin("21.5.0")] })), cliSnap(null)).findings.find((f) => f.code.startsWith("CLI_"));
    expect(noCurrent).toMatchObject({ code: "CLI_UNKNOWN", severity: "warning" });
    expect(noCurrent?.evidence).toContain("unavailable");
  });

  it("emits one CLI finding per pin", () => {
    const d = diagnose(withTc(tc({ cliPins: [pin("21.5.0"), pin("28.1.0", { file: "Makefile", line: 3, source: "makefile" })] })), cliSnap());
    expect(d.findings.filter((f) => f.code.startsWith("CLI_")).map((f) => [f.code, f.file, f.line])).toEqual([
      ["CLI_DEPRECATED", ".github/workflows/ci.yml", 23],
      ["CLI_CURRENT", "Makefile", 3],
    ]);
  });

  it("a repo with only a CLI pin still gets NO_SDK_FOUND plus its CLI finding", () => {
    const d = diagnose({ ...facts([]), toolchain: tc({ cliPins: [pin("27.0.0")] }) }, cliSnap());
    expect(codes(d)).toEqual(["NO_SDK_FOUND", "CLI_BEHIND"]);
  });

  it("RUST_TARGET_LEGACY (warning) per wasm32-unknown-unknown site when soroban-sdk exists and wasm32v1-none is absent", () => {
    const d = diagnose(withTc(tc({ rustTargets: [unknownTarget(7), unknownTarget(3, "Makefile")] })), cliSnap());
    const found = d.findings.filter((f) => f.code === "RUST_TARGET_LEGACY");
    expect(found.map((f) => [f.severity, f.file, f.line])).toEqual([
      ["warning", ".github/workflows/ci.yml", 7],
      ["warning", "Makefile", 3],
    ]);
    expect(found[0]?.message).toContain("rustup target add wasm32v1-none");
    expect(found[0]?.message).toMatch(/Stellar CLI 23\+/);
    expect(found[0]?.evidence).toContain("declared in .github/workflows/ci.yml:7");
    expect(found[0]?.evidence).toContain("setup");
  });

  it("RUST_TARGET_LEGACY drops to info when the declaring line also uses wasm-pack, wasm-bindgen or trunk", () => {
    const web: RustTargetDecl = { ...unknownTarget(4, "build.sh"), webTooling: true };
    const d = diagnose(withTc(tc({ rustTargets: [web, unknownTarget(9)] })), cliSnap());
    const found = d.findings.filter((f) => f.code === "RUST_TARGET_LEGACY");
    expect(found.map((f) => [f.file, f.severity])).toEqual([
      ["build.sh", "info"],
      [".github/workflows/ci.yml", "warning"],
    ]);
    expect(found[0]?.evidence).toMatch(/wasm-pack|browser/);
  });

  it("RUST_TARGET_LEGACY is silent without a soroban-sdk dependency or when wasm32v1-none is declared somewhere", () => {
    expect(codes(diagnose({ ...facts([]), toolchain: tc({ rustTargets: [unknownTarget()] }) }, cliSnap()))).toEqual(["NO_SDK_FOUND"]);
    const both = tc({ rustTargets: [unknownTarget(), { target: "wasm32v1-none", file: "rust-toolchain.toml", line: 3, via: "rust-toolchain targets" }] });
    expect(codes(diagnose(withTc(both), cliSnap()))).not.toContain("RUST_TARGET_LEGACY");
  });

  it("RUST_TOOLCHAIN_OLD (warning) for a pinned channel below 1.84.0 with a soroban-sdk dependency", () => {
    const old: RustToolchainPin = { channel: "1.79.0", version: "1.79.0", file: "rust-toolchain.toml", line: 2 };
    const f = diagnose(withTc(tc({ rustToolchains: [old] })), cliSnap()).findings.find((x) => x.code === "RUST_TOOLCHAIN_OLD");
    expect(f).toMatchObject({ severity: "warning", file: "rust-toolchain.toml", line: 2 });
    expect(f?.evidence).toContain("1.84.0");
    expect(f?.evidence).toContain("https://developers.stellar.org/docs/build/smart-contracts/getting-started/setup");
    expect(f?.evidence).toContain("rust-toolchain.toml:2");
  });

  it("RUST_TOOLCHAIN_OLD is silent for 1.84.0+, unpinned channels, or no soroban-sdk", () => {
    const at = (version: string | null): RustToolchainPin => ({ channel: version ?? "stable", version, file: "rust-toolchain.toml", line: 2 });
    for (const v of ["1.84.0", "1.90.1"]) expect(codes(diagnose(withTc(tc({ rustToolchains: [at(v)] })), cliSnap()))).not.toContain("RUST_TOOLCHAIN_OLD");
    expect(codes(diagnose(withTc(tc({ rustToolchains: [at(null)] })), cliSnap()))).not.toContain("RUST_TOOLCHAIN_OLD");
    expect(codes(diagnose({ ...facts([]), toolchain: tc({ rustToolchains: [at("1.70.0")] }) }, cliSnap()))).toEqual(["NO_SDK_FOUND"]);
  });

  it("toolchain findings do not change the summary arithmetic or --fail-on semantics", () => {
    const d = diagnose(withTc(tc({ cliPins: [pin("21.5.0")] }), []), cliSnap());
    expect(d.summary).toEqual({ critical: 1, warning: 0, info: 1 });
    expect(meetsThreshold(d, "critical")).toBe(true);
  });
});
