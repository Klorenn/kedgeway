import type { EcosystemSnapshot } from "../ports/ecosystem.js";
import type { LockfileKind } from "./lockfile.js";
import type { DetectedDep, RepoFacts } from "./repo-facts.js";

export type Severity = "critical" | "warning" | "info";

export interface Finding {
  severity: Severity;
  code: string;
  message: string;
  file: string;
  evidence: string;
  /** The dependency a finding is about; `file` is where its version is declared. */
  dependency?: { name: string; raw: string; file: string; resolved?: string; resolvedFrom?: LockfileKind };
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

function depRef(dep: DetectedDep): NonNullable<Finding["dependency"]> {
  return {
    name: dep.name,
    raw: dep.raw,
    file: dep.declaredIn ?? dep.file,
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
    if (dep.name === "soroban-sdk") findings.push({ ...diagnoseRustDep(dep, snapshot), dependency: depRef(dep) });
  }
  for (const dep of facts.jsDeps) {
    if (dep.name === "soroban-client" || dep.name === "stellar-sdk") {
      findings.push({
        severity: "critical",
        code: "JS_LEGACY_PACKAGE",
        message: `${dep.name} ${dep.raw} is a legacy package; replace it with @stellar/stellar-sdk.`,
        file: dep.file,
        evidence: `Legacy package name detected in manifest; reference: ${snapshot.jsSdk.source}, observed ${snapshot.observedAt}.`,
        dependency: depRef(dep),
      });
    } else {
      findings.push({ ...diagnoseJsDep(dep, snapshot), dependency: depRef(dep) });
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

  const summary = { critical: 0, warning: 0, info: 0 };
  for (const f of findings) summary[f.severity] += 1;
  return { findings, summary };
}
