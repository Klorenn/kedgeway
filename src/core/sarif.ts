import type { Diagnosis, Severity } from "./diagnose.js";
import { FINDINGS_REFERENCE } from "./findings-reference.js";

export type SarifLevel = "error" | "warning" | "note";

export interface SarifRule {
  id: string;
  name: string;
  shortDescription: { text: string };
  fullDescription: { text: string };
  defaultConfiguration: { level: SarifLevel };
}

export interface SarifResult {
  ruleId: string;
  ruleIndex: number;
  level: SarifLevel;
  message: { text: string };
  locations?: {
    physicalLocation: {
      artifactLocation: { uri: string; uriBaseId?: "%SRCROOT%" };
      region: { startLine: number };
    };
  }[];
  properties: { evidence: string };
}

export interface SarifLog {
  $schema: "https://json.schemastore.org/sarif-2.1.0.json";
  version: "2.1.0";
  runs: {
    tool: { driver: { name: "kedgeway"; version: string; informationUri: string; rules: SarifRule[] } };
    originalUriBaseIds: { "%SRCROOT%": { description: { text: string } } };
    results: SarifResult[];
  }[];
}

export interface SarifOptions {
  version: string;
  /** Path of the scan root relative to the repository root (posix, no trailing slash); "" when equal. */
  uriPrefix?: string;
  informationUri?: string;
  /** `file://` URI (trailing slash) of the scan root, for when it lies outside the repository: uris become absolute. */
  absoluteRootUri?: string;
}

const LEVEL: Record<Severity, SarifLevel> = { critical: "error", warning: "warning", info: "note" };

const TITLE: Record<string, string> = {
  SDK_DEPRECATED: "soroban-sdk is on a deprecated major",
  SDK_BEHIND: "soroban-sdk is one major behind",
  SDK_CURRENT: "soroban-sdk is current",
  SDK_UNKNOWN: "soroban-sdk version could not be judged",
  JS_SDK_DEPRECATED: "Stellar JS SDK is on a deprecated major",
  JS_SDK_BEHIND: "Stellar JS SDK is one major behind",
  JS_SDK_CURRENT: "Stellar JS SDK is current",
  JS_SDK_UNKNOWN: "Stellar JS SDK version could not be judged",
  JS_LEGACY_PACKAGE: "Legacy Stellar JS package in use",
  NO_SDK_FOUND: "No Stellar SDK dependency found",
  MANIFEST_UNPARSEABLE: "Manifest could not be parsed",
  DATA_DEGRADED: "Ecosystem data is degraded",
  CLI_DEPRECATED: "Pinned Stellar CLI is on a deprecated major",
  CLI_BEHIND: "Pinned Stellar CLI is one major behind",
  CLI_CURRENT: "Pinned Stellar CLI is current",
  CLI_UNKNOWN: "Pinned Stellar CLI version could not be judged",
  RUST_TARGET_LEGACY: "Contracts target wasm32-unknown-unknown instead of wasm32v1-none",
  RUST_TOOLCHAIN_OLD: "Pinned Rust toolchain is below the Stellar minimum",
};

const encodePath = (p: string): string => p.split("/").map(encodeURIComponent).join("/");

function pascal(code: string): string {
  return code
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join("");
}

/** A finding points at a file only when `file` is a repo-relative manifest path. */
function isRepoPath(file: string): boolean {
  return file !== "" && !file.startsWith("(") && !file.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(file);
}

export function buildSarif(diagnosis: Diagnosis, opts: SarifOptions): SarifLog {
  const rules: SarifRule[] = FINDINGS_REFERENCE.map((f) => ({
    id: f.code,
    name: pascal(f.code),
    shortDescription: { text: TITLE[f.code] ?? f.code },
    fullDescription: { text: f.migration ? `${f.meaning} ${f.migration}` : f.meaning },
    defaultConfiguration: { level: LEVEL[f.severity] },
  }));
  const index = new Map(rules.map((r, i) => [r.id, i]));
  const prefix = (opts.uriPrefix ?? "").replace(/\/+$/, "");

  const results: SarifResult[] = diagnosis.findings.map((f) => {
    const result: SarifResult = {
      ruleId: f.code,
      ruleIndex: index.get(f.code) ?? -1,
      level: LEVEL[f.severity],
      message: { text: f.message },
      properties: { evidence: f.evidence },
    };
    if (isRepoPath(f.file)) {
      const artifactLocation =
        opts.absoluteRootUri !== undefined
          ? { uri: `${opts.absoluteRootUri}${encodePath(f.file)}` }
          : { uri: encodePath(prefix === "" ? f.file : `${prefix}/${f.file}`), uriBaseId: "%SRCROOT%" as const };
      result.locations = [{ physicalLocation: { artifactLocation, region: { startLine: Math.max(1, f.line ?? 1) } } }];
    }
    return result;
  });

  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "kedgeway",
            version: opts.version,
            informationUri: opts.informationUri ?? "https://github.com/Klorenn/kedgeway",
            rules,
          },
        },
        originalUriBaseIds: { "%SRCROOT%": { description: { text: "The repository root (the directory kedgeway runs from)." } } },
        results,
      },
    ],
  };
}
