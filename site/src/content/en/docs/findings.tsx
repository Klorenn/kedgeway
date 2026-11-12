import type { DocsFindingsDict } from "../../schema/docs-findings";
import { linkFor } from "@/i18n/Link";

const L = linkFor("en");
const PIN = "The pin and the file and line it came from, for example pinned in .github/workflows/ci.yml:23.";

export default {
  meta: { title: "Findings — kedgeway docs", description: "Every kedgeway finding code: severity, meaning, evidence and what to do." },
  h1: "Findings",
  lede: <>Each finding has a severity, a code, the file it applies to, a message and the evidence behind it. There are eighteen codes.</>,
  lockfile: <>When a lockfile resolves a dependency, the evidence says so, for example <code>resolved 21.7.6 from Cargo.lock; manifest ^21</code>, and the comparison uses the resolved version. When the lockfile is ambiguous the manifest version is used and the evidence notes it. See <L to="/docs/what-it-scans">What it scans</L>.</>,
  js: <>The JavaScript checks compare against the current <code>@stellar/stellar-sdk</code> release. <code>@stellar/stellar-base</code> is compared with that same release.</>,
  labels: { meaning: "Meaning", evidence: "Evidence shown", todo: "What to do" },
  findings: {
    SDK_DEPRECATED: {
      meaning: <>soroban-sdk is on a major that Scout lists as deprecated and that is below the current major, or it is more than one major behind the current major.</>,
      evidence: <>The major comparison: for example <code>{"major 21 < current major 28 and appears in the Scout deprecated sample"}</code>, or <code>{"major 21 < current major 28 - 1"}</code>, followed by the source and observation time.</>,
      todo: <>Upgrade soroban-sdk to the current major shown in the report header. Release notes are collected from the docs search (see Data sources).</>,
    },
    SDK_BEHIND: {
      meaning: <>soroban-sdk is exactly one major behind the current major.</>,
      evidence: <><code>{"major N = current major M - 1"}</code>, with the source and observation time.</>,
      todo: <>Plan an upgrade to the current major. It is not deprecated yet.</>,
    },
    SDK_CURRENT: {
      meaning: <>soroban-sdk is on the current major or newer.</>,
      evidence: <><code>{"major N >= current major M"}</code>, with the source and observation time.</>,
      todo: <>Nothing. If the major is newer than the ecosystem&apos;s, the message says <code>or newer</code>.</>,
    },
    SDK_UNKNOWN: {
      meaning: <>The soroban-sdk version could not be parsed from the manifest, or the current major is unavailable, so no comparison was made.</>,
      evidence: <>Either <code>Version unparseable from manifest; no comparison made</code>, or <code>Current major evidence unavailable; no deprecation claim made</code>.</>,
      todo: <>If the version is unparseable, declare a plain version such as <code>21.0.0</code> (see What it scans). If the current major is unavailable, look for a DATA_DEGRADED finding and run again.</>,
    },
    JS_SDK_DEPRECATED: {
      meaning: <>A JavaScript Stellar SDK dependency is more than one major behind the current release.</>,
      evidence: <><code>{"major N < current major M - 1"}</code>, with the source and observation time.</>,
      todo: <>Upgrade to the current @stellar/stellar-sdk. Check its release notes for breaking changes.</>,
    },
    JS_SDK_BEHIND: {
      meaning: <>A JavaScript Stellar SDK dependency is exactly one major behind the current release.</>,
      evidence: <><code>{"major N = current major M - 1"}</code>, with the source and observation time.</>,
      todo: <>Plan an upgrade to the current major.</>,
    },
    JS_SDK_CURRENT: {
      meaning: <>A JavaScript Stellar SDK dependency is on the current major or newer.</>,
      evidence: <><code>{"major N >= current major M"}</code>, with the source and observation time.</>,
      todo: <>Nothing.</>,
    },
    JS_SDK_UNKNOWN: {
      meaning: <>The version could not be parsed, or the current JavaScript SDK release is unavailable, so no comparison was made.</>,
      evidence: <>Either <code>Version unparseable from manifest</code> or <code>Current JS SDK version evidence unavailable</code>.</>,
      todo: <>Declare a plain version, or look for DATA_DEGRADED and run again.</>,
    },
    JS_LEGACY_PACKAGE: {
      meaning: <>The repo depends on the legacy <code>soroban-client</code> or the unscoped <code>stellar-sdk</code> package.</>,
      evidence: <><code>Legacy package name detected in manifest</code>, with the reference source and observation time.</>,
      todo: <>Replace it with <code>@stellar/stellar-sdk</code>.</>,
    },
    MANIFEST_UNPARSEABLE: {
      meaning: <>A Cargo.toml, a package.json, or a directory could not be read or parsed. Its dependencies were not checked.</>,
      evidence: <>The parser or file-system error message.</>,
      todo: <>Fix the file or the unreadable directory (for example invalid TOML or JSON, or a permission error) and run again. Until then that path is unchecked.</>,
    },
    DATA_DEGRADED: {
      meaning: <>One of the ecosystem sources failed or returned partial data, or a stale or fallback cached snapshot was used. Related verdicts may be unknown or incomplete.</>,
      evidence: <><code>{"Reported while collecting the snapshot observed <time>"}</code>. The message names the failing source, for example <code>stellarDocs.get_doc_page: ...</code>. The file column reads <code>(ecosystem data)</code>.</>,
      todo: <>Run again. If it persists, check Raven availability and read the message for which source failed.</>,
    },
    NO_SDK_FOUND: {
      meaning: <>No soroban-sdk or Stellar JavaScript SDK dependency was detected in the scanned path.</>,
      evidence: <><code>{"Scanned Cargo.toml and package.json files under <root>"}</code>.</>,
      todo: <>Check the path. Folders such as node_modules and target are skipped, and the scan stops four levels down.</>,
    },
    CLI_DEPRECATED: {
      meaning: <>A pinned stellar-cli is two or more majors behind the current Stellar CLI. One finding per pin; nothing is reported when the repo pins none.</>,
      evidence: <>{PIN.slice(0, -1)}. The comparison uses the Stellar CLI version on the official software versions page.</>,
      todo: <>Upgrade the pin to the current Stellar CLI major.</>,
    },
    CLI_BEHIND: {
      meaning: <>A pinned stellar-cli is exactly one major behind the current Stellar CLI.</>,
      evidence: PIN,
      todo: <>Plan an upgrade to the current major.</>,
    },
    CLI_CURRENT: {
      meaning: <>A pinned stellar-cli is on the current major (or newer).</>,
      evidence: PIN,
      todo: <>Nothing.</>,
    },
    CLI_UNKNOWN: {
      meaning: <>A stellar-cli pin exists but its version is unparseable (for example a branch name or a CI expression), or the current Stellar CLI version is unavailable, so no verdict is made.</>,
      evidence: PIN,
      todo: <>Pin a plain version, or look for DATA_DEGRADED and run again.</>,
    },
    RUST_TARGET_LEGACY: {
      meaning: <>wasm32-unknown-unknown is declared in a repo with soroban-sdk and no wasm32v1-none. Stellar CLI 23+ builds for wasm32v1-none. One finding per declaration site.</>,
      evidence: <>The declaring file and line, such as rust-toolchain.toml, .cargo/config.toml, a workflow, a Makefile or a script.</>,
      todo: <>Run rustup target add wasm32v1-none and declare it where the legacy target is declared.</>,
    },
    RUST_TOOLCHAIN_OLD: {
      meaning: <>A pinned Rust channel is below 1.84.0 in a repo with soroban-sdk. The setup guide requires Rust v1.84.0 or higher. stable and nightly are not pins.</>,
      evidence: <>The pinned channel and the file and line it came from.</>,
      todo: <>Raise the pinned channel to 1.84.0 or higher.</>,
    },
  },
} satisfies DocsFindingsDict;
