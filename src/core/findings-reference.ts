import type { Severity } from "./diagnose.js";

export interface FindingReference {
  code: string;
  severity: Severity;
  meaning: string;
  /** What `kedgeway migrate` does for this code, when it acts on it. */
  migration?: string;
}

const MIGRATION: Record<string, string> = {
  SDK_DEPRECATED: "Bumps soroban-sdk to the exact current version (workspace root for inherited deps); operator ranges become a manual step.",
  SDK_BEHIND: "Bumps soroban-sdk to the exact current version, preserving =, ~ or ^ prefixes.",
  SDK_UNKNOWN: "Manual step explaining why no edit was made.",
  JS_SDK_DEPRECATED: "Bumps @stellar/stellar-sdk to the current version, keeping ^ or ~; @stellar/stellar-base becomes a manual step.",
  JS_SDK_BEHIND: "Bumps @stellar/stellar-sdk to the current version, keeping ^ or ~; @stellar/stellar-base becomes a manual step.",
  JS_SDK_UNKNOWN: "Manual step explaining why no edit was made.",
  JS_LEGACY_PACKAGE: "Replaces the legacy package with @stellar/stellar-sdk at ^current and adds a manual step with rg patterns to update imports.",
  MANIFEST_UNPARSEABLE: "Manual step: fix the manifest, then re-run.",
};

const BASE: readonly FindingReference[] = [
  { code: "SDK_DEPRECATED", severity: "critical", meaning: "soroban-sdk is on a deprecated major: two or more majors behind the official current major, or a major listed as deprecated by Scout that is below current. Judged on the lockfile-resolved version when a lockfile exists." },
  { code: "SDK_BEHIND", severity: "warning", meaning: "soroban-sdk is exactly one major behind the official current major (lockfile-resolved version when available)." },
  { code: "SDK_CURRENT", severity: "info", meaning: "soroban-sdk is on the official current major (or newer)." },
  { code: "SDK_UNKNOWN", severity: "warning", meaning: "soroban-sdk version is unparseable or the current major is unavailable, so no verdict is made." },
  { code: "JS_SDK_DEPRECATED", severity: "critical", meaning: "@stellar/stellar-sdk or @stellar/stellar-base is two or more majors behind the current JS SDK (lockfile-resolved version when available)." },
  { code: "JS_SDK_BEHIND", severity: "warning", meaning: "@stellar/stellar-sdk or @stellar/stellar-base is exactly one major behind the current JS SDK (lockfile-resolved version when available)." },
  { code: "JS_SDK_CURRENT", severity: "info", meaning: "@stellar/stellar-sdk or @stellar/stellar-base is on the current JS SDK major (or newer)." },
  { code: "JS_SDK_UNKNOWN", severity: "warning", meaning: "JS SDK version is unparseable or the current JS SDK version is unavailable." },
  { code: "JS_LEGACY_PACKAGE", severity: "critical", meaning: "A legacy package (soroban-client or unscoped stellar-sdk) is used; replace it with @stellar/stellar-sdk." },
  { code: "CLI_DEPRECATED", severity: "critical", meaning: "A pinned stellar-cli (workflow, Dockerfile, Makefile, shell script, .tool-versions or @stellar/stellar-cli in package.json) is two or more majors behind the current Stellar CLI major from the official software-versions page. One finding per pin; nothing is reported when no pin exists." },
  { code: "CLI_BEHIND", severity: "warning", meaning: "A pinned stellar-cli is exactly one major behind the current Stellar CLI major from the official software-versions page. One finding per pin." },
  { code: "CLI_CURRENT", severity: "info", meaning: "A pinned stellar-cli is on the current Stellar CLI major (or newer). One finding per pin." },
  { code: "CLI_UNKNOWN", severity: "warning", meaning: "A stellar-cli pin exists but its version is unparseable (for example a branch name or a CI expression), or the current Stellar CLI version is unavailable, so no verdict is made." },
  { code: "RUST_TARGET_LEGACY", severity: "warning", meaning: "wasm32-unknown-unknown is declared (rust-toolchain.toml, .cargo/config.toml, a workflow, Makefile, Dockerfile or script) in a repo with a soroban-sdk dependency and no wasm32v1-none declaration. Stellar CLI 23+ builds contracts for wasm32v1-none: run `rustup target add wasm32v1-none`. One finding per declaration site; it is reported as info instead of warning when the declaring line also uses wasm-pack, wasm-bindgen or trunk (browser Wasm in a monorepo)." },
  { code: "RUST_TOOLCHAIN_OLD", severity: "warning", meaning: "A Rust toolchain pinned in rust-toolchain.toml (or a legacy rust-toolchain file) is below 1.84.0 in a repo with a soroban-sdk dependency; the official setup guide requires Rust v1.84.0 or higher because the wasm32v1-none target is only available in recent versions. Channels such as stable or nightly are not pins." },
  { code: "NO_SDK_FOUND", severity: "info", meaning: "No Stellar or Soroban SDK dependencies were detected in the scanned path." },
  { code: "MANIFEST_UNPARSEABLE", severity: "warning", meaning: "A Cargo.toml, package.json or directory could not be read or parsed, so it was not checked." },
  { code: "DATA_DEGRADED", severity: "warning", meaning: "Part of the ecosystem data could not be fetched or parsed, or a cached snapshot was used (stale with --offline, or because Raven failed); related verdicts may be unknown or incomplete." },
];

export const FINDINGS_REFERENCE: readonly FindingReference[] = BASE.map((f) => {
  const migration = MIGRATION[f.code];
  return migration ? { ...f, migration } : f;
});
