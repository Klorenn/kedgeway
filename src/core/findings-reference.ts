import type { Severity } from "./diagnose.js";

export interface FindingReference {
  code: string;
  severity: Severity;
  meaning: string;
}

export const FINDINGS_REFERENCE: readonly FindingReference[] = [
  { code: "SDK_DEPRECATED", severity: "critical", meaning: "soroban-sdk is on a deprecated major: two or more majors behind the official current major, or a major listed as deprecated by Scout that is below current." },
  { code: "SDK_BEHIND", severity: "warning", meaning: "soroban-sdk is exactly one major behind the official current major." },
  { code: "SDK_CURRENT", severity: "info", meaning: "soroban-sdk is on the official current major (or newer)." },
  { code: "SDK_UNKNOWN", severity: "warning", meaning: "soroban-sdk version is unparseable or the current major is unavailable, so no verdict is made." },
  { code: "JS_SDK_DEPRECATED", severity: "critical", meaning: "@stellar/stellar-sdk or @stellar/stellar-base is two or more majors behind the current JS SDK." },
  { code: "JS_SDK_BEHIND", severity: "warning", meaning: "@stellar/stellar-sdk or @stellar/stellar-base is exactly one major behind the current JS SDK." },
  { code: "JS_SDK_CURRENT", severity: "info", meaning: "@stellar/stellar-sdk or @stellar/stellar-base is on the current JS SDK major (or newer)." },
  { code: "JS_SDK_UNKNOWN", severity: "warning", meaning: "JS SDK version is unparseable or the current JS SDK version is unavailable." },
  { code: "JS_LEGACY_PACKAGE", severity: "critical", meaning: "A legacy package (soroban-client or unscoped stellar-sdk) is used; replace it with @stellar/stellar-sdk." },
  { code: "NO_SDK_FOUND", severity: "info", meaning: "No Stellar or Soroban SDK dependencies were detected in the scanned path." },
  { code: "MANIFEST_UNPARSEABLE", severity: "warning", meaning: "A Cargo.toml, package.json or directory could not be read or parsed, so it was not checked." },
  { code: "DATA_DEGRADED", severity: "warning", meaning: "Part of the ecosystem data could not be fetched or parsed; related verdicts may be unknown or incomplete." },
];
