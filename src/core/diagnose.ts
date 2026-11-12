import type { EcosystemSnapshot } from "../ports/ecosystem.js";
import type { LockfileKind } from "./lockfile.js";
import type { DetectedDep, RepoFacts } from "./repo-facts.js";
import { compareRustVersion, RUST_MIN_VERSION, SETUP_DOC_OBSERVED, SETUP_DOC_URL, type CliPin } from "./toolchain.js";

export type Severity = "critical" | "warning" | "info";

export interface Finding {
  severity: Severity;
  code: string;
  message: string;
  file: string;
  /** 1-based line of the dependency in `file`, when known. */
  line?: number;
  evidence: string;
  /** The dependency a finding is about; `file` is where its version is declared. */
  dependency?: {
    name: string;
    raw: string;
    file: string;
    /** `npm:` alias: the member key and value as written in package.json. */
    declaredKey?: string;
    declaredRaw?: string;
    resolved?: string;
    resolvedFrom?: LockfileKind;
  };
}

export interface Diagnosis {
  findings: Finding[];
  summary: { critical: number; warning: number; info: number };
}

export const SEVERITY_RANK: Record<Severity, number> = { info: 0, warning: 1, critical: 2 };

function provenance(s: EcosystemSnapshot): string {
  return `source: ${s.sorobanSdk.source}, observed ${s.observedAt}`;
}

function jsProvenance(s: EcosystemSnapshot): string {
  return `source: ${s.jsSdk.source}, observed ${s.observedAt}`;
}

function lineOf(dep: DetectedDep): { line?: number } {
  return dep.line === undefined ? {} : { line: dep.line };
}

function depRef(dep: DetectedDep): NonNullable<Finding["dependency"]> {
  return {
    name: dep.name,
    raw: dep.raw,
    file: dep.declaredIn ?? dep.file,
    ...(dep.declaredKey !== undefined && dep.declaredRaw !== undefined ? { declaredKey: dep.declaredKey, declaredRaw: dep.declaredRaw } : {}),
    ...(dep.resolved !== null && dep.resolvedFrom !== null ? { resolved: dep.resolved, resolvedFrom: dep.resolvedFrom } : {}),
  };
}

function majorOf(version: string): number | null {
  const m = /^(\d+)/.exec(version);
  return m?.[1] === undefined ? null : Number.parseInt(m[1], 10);
}

/** The version used for comparisons: the lockfile-resolved one when present, else the manifest's. */
function effective(dep: DetectedDep): { version: string | null; major: number | null } {
  return dep.resolved === null ? { version: dep.version, major: dep.major } : { version: dep.resolved, major: majorOf(dep.resolved) };
}

/** Evidence prefix naming the lockfile basis ("" when the manifest version was used). */
function basisOf(dep: DetectedDep): string {
  if (dep.resolved === null) return dep.lockNote === undefined ? "" : `${dep.lockNote}; using manifest ${dep.raw || "(unspecified)"}: `;
  return `resolved ${dep.resolved} from ${dep.resolvedFrom ?? "lockfile"}; manifest ${dep.raw || "(unspecified)"}: `;
}

function labelOf(name: string, dep: DetectedDep): string {
  const raw = dep.raw || "(unspecified)";
  return dep.resolved === null ? `${name} ${raw}` : `${name} ${raw} (resolved ${dep.resolved})`;
}

function diagnoseRustDep(dep: DetectedDep, s: EcosystemSnapshot): Finding {
  const { currentMajor, deprecatedVersions } = s.sorobanSdk;
  const base = { file: dep.file };
  const label = labelOf("soroban-sdk", dep);
  const basis = basisOf(dep);
  const eff = effective(dep);

  if (eff.version === null || eff.major === null) {
    return {
      ...base,
      severity: "warning",
      code: "SDK_UNKNOWN",
      message: `${label}: version could not be determined, so it cannot be compared with the ecosystem.`,
      evidence: `${basis}Version unparseable from manifest; no comparison made (${provenance(s)}).`,
    };
  }
  if (currentMajor === null) {
    return {
      ...base,
      severity: "warning",
      code: "SDK_UNKNOWN",
      message: `${label}: current soroban-sdk major is unknown, so staleness cannot be judged.`,
      evidence: `${basis}Current major evidence unavailable; no deprecation claim made (${provenance(s)}).`,
    };
  }
  // Official docs win: a Scout "deprecated" entry only counts when it is below the current major.
  const scoutMajors = new Set(deprecatedVersions.map(majorOf).filter((m): m is number => m !== null));
  if (eff.major < currentMajor && scoutMajors.has(eff.major)) {
    return {
      ...base,
      severity: "critical",
      code: "SDK_DEPRECATED",
      message: `${label} is on a major listed as deprecated (current: ${currentMajor}). Upgrade.`,
      evidence: `${basis}major ${eff.major} < current major ${currentMajor} and appears in the Scout deprecated sample (${provenance(s)}).`,
    };
  }
  if (eff.major < currentMajor - 1) {
    return {
      ...base,
      severity: "critical",
      code: "SDK_DEPRECATED",
      message: `${label} is ${currentMajor - eff.major} majors behind (current: ${currentMajor}). Treat as deprecated.`,
      evidence: `${basis}major ${eff.major} < current major ${currentMajor} - 1 (${provenance(s)}).`,
    };
  }
  if (eff.major === currentMajor - 1) {
    return {
      ...base,
      severity: "warning",
      code: "SDK_BEHIND",
      message: `${label} is one major behind (current: ${currentMajor}).`,
      evidence: `${basis}major ${eff.major} = current major ${currentMajor} - 1 (${provenance(s)}).`,
    };
  }
  return {
    ...base,
    severity: "info",
    code: "SDK_CURRENT",
    message: `${label} is on the current major (${currentMajor})${eff.major > currentMajor ? " or newer" : ""}.`,
    evidence: `${basis}major ${eff.major} >= current major ${currentMajor} (${provenance(s)}).`,
  };
}

function diagnoseJsDep(dep: DetectedDep, s: EcosystemSnapshot): Finding {
  const current = s.jsSdk.currentVersion;
  const currentMajor = current === null ? null : majorOf(current);
  const label = labelOf(dep.name, dep);
  const basis = basisOf(dep);
  const eff = effective(dep);
  const base = { file: dep.file };

  if (eff.major === null || currentMajor === null) {
    return {
      ...base,
      severity: "warning",
      code: "JS_SDK_UNKNOWN",
      message: `${label}: cannot be compared with the current @stellar/stellar-sdk release.`,
      evidence:
        eff.major === null
          ? `${basis}Version unparseable from manifest (${jsProvenance(s)}).`
          : `${basis}Current JS SDK version evidence unavailable (${jsProvenance(s)}).`,
    };
  }
  if (eff.major < currentMajor - 1) {
    return {
      ...base,
      severity: "critical",
      code: "JS_SDK_DEPRECATED",
      message: `${label} is ${currentMajor - eff.major} majors behind (current: ${current}). Treat as deprecated.`,
      evidence: `${basis}major ${eff.major} < current major ${currentMajor} - 1 (${jsProvenance(s)}).`,
    };
  }
  if (eff.major === currentMajor - 1) {
    return {
      ...base,
      severity: "warning",
      code: "JS_SDK_BEHIND",
      message: `${label} is one major behind (current: ${current}).`,
      evidence: `${basis}major ${eff.major} = current major ${currentMajor} - 1 (${jsProvenance(s)}).`,
    };
  }
  return {
    ...base,
    severity: "info",
    code: "JS_SDK_CURRENT",
    message: `${label} is on the current major (${currentMajor})${eff.major > currentMajor ? " or newer" : ""}.`,
    evidence: `${basis}major ${eff.major} >= current major ${currentMajor} (${jsProvenance(s)}).`,
  };
}

function cliProvenance(s: EcosystemSnapshot): string {
  return `source: ${s.stellarCli.source}, observed ${s.observedAt}`;
}

function diagnoseCliPin(pin: CliPin, s: EcosystemSnapshot): Finding {
  const where = `${pin.file}:${pin.line}`;
  const pinned = `pinned in ${where} (${pin.via})`;
  const label = `stellar-cli ${pin.raw}`;
  const base = { file: pin.file, line: pin.line };
  const current = s.stellarCli.currentVersion;
  const currentMajor = current === null ? null : majorOf(current);

  if (pin.major === null) {
    return {
      ...base,
      severity: "warning",
      code: "CLI_UNKNOWN",
      message: `${label} (${where}): version could not be determined, so it cannot be compared with the current Stellar CLI.`,
      evidence: `${pinned}; version unparseable; no comparison made (${cliProvenance(s)}).`,
    };
  }
  if (currentMajor === null) {
    return {
      ...base,
      severity: "warning",
      code: "CLI_UNKNOWN",
      message: `${label} (${where}): the current Stellar CLI version is unknown, so staleness cannot be judged.`,
      evidence: `${pinned}; current Stellar CLI version evidence unavailable; no deprecation claim made (${cliProvenance(s)}).`,
    };
  }
  if (pin.major < currentMajor - 1) {
    return {
      ...base,
      severity: "critical",
      code: "CLI_DEPRECATED",
      message: `${label} (${where}) is ${currentMajor - pin.major} majors behind (current: ${current}). Treat as deprecated.`,
      evidence: `${pinned}; major ${pin.major} < current major ${currentMajor} - 1 (${cliProvenance(s)}).`,
    };
  }
  if (pin.major === currentMajor - 1) {
    return {
      ...base,
      severity: "warning",
      code: "CLI_BEHIND",
      message: `${label} (${where}) is one major behind (current: ${current}).`,
      evidence: `${pinned}; major ${pin.major} = current major ${currentMajor} - 1 (${cliProvenance(s)}).`,
    };
  }
  return {
    ...base,
    severity: "info",
    code: "CLI_CURRENT",
    message: `${label} (${where}) is on the current major (${currentMajor})${pin.major > currentMajor ? " or newer" : ""}.`,
    evidence: `${pinned}; major ${pin.major} >= current major ${currentMajor} (${cliProvenance(s)}).`,
  };
}

function toolchainFindings(facts: RepoFacts, s: EcosystemSnapshot): Finding[] {
  const tc = facts.toolchain;
  if (tc === undefined) return [];
  const findings: Finding[] = tc.cliPins.map((pin) => diagnoseCliPin(pin, s));
  const sdk = facts.rustDeps.find((d) => d.name === "soroban-sdk");
  if (sdk === undefined) return findings;
  const sdkAt = `soroban-sdk detected in ${sdk.declaredIn ?? sdk.file}${sdk.line === undefined ? "" : `:${sdk.line}`}`;
  const docs = `source: ${SETUP_DOC_URL}, observed ${SETUP_DOC_OBSERVED}`;

  if (!tc.rustTargets.some((t) => t.target === "wasm32v1-none")) {
    for (const t of tc.rustTargets) {
      if (t.target !== "wasm32-unknown-unknown") continue;
      findings.push({
        severity: t.webTooling === true ? "info" : "warning",
        code: "RUST_TARGET_LEGACY",
        message: `wasm32-unknown-unknown is declared in ${t.file}:${t.line}, but Stellar CLI 23+ builds contracts for wasm32v1-none. Run \`rustup target add wasm32v1-none\`.`,
        file: t.file,
        line: t.line,
        evidence: `wasm32-unknown-unknown declared in ${t.file}:${t.line} (${t.via}); wasm32v1-none is not declared anywhere in the scanned repo${t.webTooling === true ? "; the line also uses wasm-pack, wasm-bindgen or trunk (browser Wasm), so this is informational" : ""}; ${sdkAt} (${docs}).`,
      });
    }
  }
  for (const r of tc.rustToolchains) {
    if (r.version === null || compareRustVersion(r.version, RUST_MIN_VERSION) >= 0) continue;
    findings.push({
      severity: "warning",
      code: "RUST_TOOLCHAIN_OLD",
      message: `Rust ${r.version} is pinned in ${r.file}:${r.line}, below the ${RUST_MIN_VERSION} that Stellar smart contracts require.`,
      file: r.file,
      line: r.line,
      evidence: `channel "${r.channel}" pinned in ${r.file}:${r.line}; the setup guide requires Rust toolchain v${RUST_MIN_VERSION} or higher because the wasm32v1-none target is only available in recent versions; ${sdkAt} (${docs}).`,
    });
  }
  return findings;
}

export function meetsThreshold(d: Diagnosis, severity: Severity): boolean {
  return d.findings.some((f) => SEVERITY_RANK[f.severity] >= SEVERITY_RANK[severity]);
}

export function diagnose(facts: RepoFacts, snapshot: EcosystemSnapshot): Diagnosis {
  const findings: Finding[] = [];

  for (const note of snapshot.degraded) {
    findings.push({
      severity: "warning",
      code: "DATA_DEGRADED",
      message: `Ecosystem data is degraded: ${note}`,
      file: "(ecosystem data)",
      evidence: `Reported while collecting the snapshot observed ${snapshot.observedAt}; related verdicts may be SDK_UNKNOWN or incomplete.`,
    });
  }
  for (const err of facts.manifestErrors) {
    findings.push({
      severity: "warning",
      code: "MANIFEST_UNPARSEABLE",
      message: `${err.file} could not be read or parsed; its dependencies were not checked.`,
      file: err.file,
      evidence: `Error: ${err.message}`,
    });
  }
  for (const dep of facts.rustDeps) {
    if (dep.name === "soroban-sdk") findings.push({ ...diagnoseRustDep(dep, snapshot), ...lineOf(dep), dependency: depRef(dep) });
  }
  for (const dep of facts.jsDeps) {
    if (dep.name === "soroban-client" || dep.name === "stellar-sdk") {
      findings.push({
        severity: "critical",
        code: "JS_LEGACY_PACKAGE",
        message: `${dep.name} ${dep.raw} is a legacy package; replace it with @stellar/stellar-sdk.`,
        file: dep.file,
        ...lineOf(dep),
        evidence: `Legacy package name detected in manifest; reference: ${snapshot.jsSdk.source}, observed ${snapshot.observedAt}.`,
        dependency: depRef(dep),
      });
    } else {
      findings.push({ ...diagnoseJsDep(dep, snapshot), ...lineOf(dep), dependency: depRef(dep) });
    }
  }
  if (facts.rustDeps.length === 0 && facts.jsDeps.length === 0 && facts.manifestErrors.length === 0) {
    findings.push({
      severity: "info",
      code: "NO_SDK_FOUND",
      message: "No Stellar/Soroban SDK dependencies were detected.",
      file: facts.root,
      evidence: `Scanned Cargo.toml and package.json files under ${facts.root}.`,
    });
  }

  findings.push(...toolchainFindings(facts, snapshot));

  const summary = { critical: 0, warning: 0, info: 0 };
  for (const f of findings) summary[f.severity] += 1;
  return { findings, summary };
}
