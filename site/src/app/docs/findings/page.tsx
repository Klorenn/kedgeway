import type { Metadata } from "next";
import { docsMeta } from "@/lib/seo";
import Link from "next/link";
import PrevNext from "@/components/docs/PrevNext";
import styles from "../docs.module.css";

export const metadata: Metadata = docsMeta("Findings — kedgeway docs", "Every kedgeway finding code: severity, meaning, evidence and what to do.", "/docs/findings");

export default function Findings() {
  return (
    <>
      <h1>Findings</h1>
      <p className={styles.lede}>
        Each finding has a severity, a code, the file it applies to, a message and the evidence behind it. There are eighteen codes.
      </p>
      <ul>
        <li><strong>critical:</strong> SDK_DEPRECATED, JS_SDK_DEPRECATED, JS_LEGACY_PACKAGE, CLI_DEPRECATED</li>
        <li><strong>warning:</strong> SDK_BEHIND, JS_SDK_BEHIND, SDK_UNKNOWN, JS_SDK_UNKNOWN, MANIFEST_UNPARSEABLE, DATA_DEGRADED, CLI_BEHIND, CLI_UNKNOWN, RUST_TARGET_LEGACY, RUST_TOOLCHAIN_OLD</li>
        <li><strong>info:</strong> SDK_CURRENT, JS_SDK_CURRENT, NO_SDK_FOUND, CLI_CURRENT</li>
      </ul>
      <p>When a lockfile resolves a dependency, the evidence says so, for example <code>resolved 21.7.6 from Cargo.lock; manifest ^21</code>, and the comparison uses the resolved version. When the lockfile is ambiguous the manifest version is used and the evidence notes it. See <Link href="/docs/what-it-scans">What it scans</Link>.</p>
      <p>The JavaScript checks compare against the current <code>@stellar/stellar-sdk</code> release. <code>@stellar/stellar-base</code> is compared with that same release.</p>
      <section className={styles.finding} aria-labelledby="sdk_deprecated">
        <h2 id="sdk_deprecated">SDK_DEPRECATED</h2>
        <p className={styles.sev}>critical</p>
        <dl className={styles.defs}>
          <dt>Meaning</dt><dd>{"soroban-sdk is on a major that Scout lists as deprecated and that is below the current major, or it is more than one major behind the current major."}</dd>
          <dt>Evidence shown</dt><dd>{"The major comparison: for example "}<code>{"major 21 < current major 28 and appears in the Scout deprecated sample"}</code>{", or "}<code>{"major 21 < current major 28 - 1"}</code>{", followed by the source and observation time."}</dd>
          <dt>What to do</dt><dd>{"Upgrade soroban-sdk to the current major shown in the report header. Release notes are collected from the docs search (see Data sources)."}</dd>
        </dl>
      </section>
      <section className={styles.finding} aria-labelledby="sdk_behind">
        <h2 id="sdk_behind">SDK_BEHIND</h2>
        <p className={styles.sev}>warning</p>
        <dl className={styles.defs}>
          <dt>Meaning</dt><dd>{"soroban-sdk is exactly one major behind the current major."}</dd>
          <dt>Evidence shown</dt><dd><code>{"major N = current major M - 1"}</code>{", with the source and observation time."}</dd>
          <dt>What to do</dt><dd>{"Plan an upgrade to the current major. It is not deprecated yet."}</dd>
        </dl>
      </section>
      <section className={styles.finding} aria-labelledby="sdk_current">
        <h2 id="sdk_current">SDK_CURRENT</h2>
        <p className={styles.sev}>info</p>
        <dl className={styles.defs}>
          <dt>Meaning</dt><dd>{"soroban-sdk is on the current major or newer."}</dd>
          <dt>Evidence shown</dt><dd><code>{"major N >= current major M"}</code>{", with the source and observation time."}</dd>
          <dt>What to do</dt><dd>{"Nothing. If the major is newer than the ecosystem's, the message says "}<code>{"or newer"}</code>{"."}</dd>
        </dl>
      </section>
      <section className={styles.finding} aria-labelledby="sdk_unknown">
        <h2 id="sdk_unknown">SDK_UNKNOWN</h2>
        <p className={styles.sev}>warning</p>
        <dl className={styles.defs}>
          <dt>Meaning</dt><dd>{"The soroban-sdk version could not be parsed from the manifest, or the current major is unavailable, so no comparison was made."}</dd>
          <dt>Evidence shown</dt><dd>{"Either "}<code>{"Version unparseable from manifest; no comparison made"}</code>{", or "}<code>{"Current major evidence unavailable; no deprecation claim made"}</code>{"."}</dd>
          <dt>What to do</dt><dd>{"If the version is unparseable, declare a plain version such as "}<code>{"21.0.0"}</code>{" (see What it scans). If the current major is unavailable, look for a DATA_DEGRADED finding and run again."}</dd>
        </dl>
      </section>
      <section className={styles.finding} aria-labelledby="js_sdk_deprecated">
        <h2 id="js_sdk_deprecated">JS_SDK_DEPRECATED</h2>
        <p className={styles.sev}>critical</p>
        <dl className={styles.defs}>
          <dt>Meaning</dt><dd>{"A JavaScript Stellar SDK dependency is more than one major behind the current release."}</dd>
          <dt>Evidence shown</dt><dd><code>{"major N < current major M - 1"}</code>{", with the source and observation time."}</dd>
          <dt>What to do</dt><dd>{"Upgrade to the current @stellar/stellar-sdk. Check its release notes for breaking changes."}</dd>
        </dl>
      </section>
      <section className={styles.finding} aria-labelledby="js_sdk_behind">
        <h2 id="js_sdk_behind">JS_SDK_BEHIND</h2>
        <p className={styles.sev}>warning</p>
        <dl className={styles.defs}>
          <dt>Meaning</dt><dd>{"A JavaScript Stellar SDK dependency is exactly one major behind the current release."}</dd>
          <dt>Evidence shown</dt><dd><code>{"major N = current major M - 1"}</code>{", with the source and observation time."}</dd>
          <dt>What to do</dt><dd>{"Plan an upgrade to the current major."}</dd>
        </dl>
      </section>
      <section className={styles.finding} aria-labelledby="js_sdk_current">
        <h2 id="js_sdk_current">JS_SDK_CURRENT</h2>
        <p className={styles.sev}>info</p>
        <dl className={styles.defs}>
          <dt>Meaning</dt><dd>{"A JavaScript Stellar SDK dependency is on the current major or newer."}</dd>
          <dt>Evidence shown</dt><dd><code>{"major N >= current major M"}</code>{", with the source and observation time."}</dd>
          <dt>What to do</dt><dd>{"Nothing."}</dd>
        </dl>
      </section>
      <section className={styles.finding} aria-labelledby="js_sdk_unknown">
        <h2 id="js_sdk_unknown">JS_SDK_UNKNOWN</h2>
        <p className={styles.sev}>warning</p>
        <dl className={styles.defs}>
          <dt>Meaning</dt><dd>{"The version could not be parsed, or the current JavaScript SDK release is unavailable, so no comparison was made."}</dd>
          <dt>Evidence shown</dt><dd>{"Either "}<code>{"Version unparseable from manifest"}</code>{" or "}<code>{"Current JS SDK version evidence unavailable"}</code>{"."}</dd>
          <dt>What to do</dt><dd>{"Declare a plain version, or look for DATA_DEGRADED and run again."}</dd>
        </dl>
      </section>
      <section className={styles.finding} aria-labelledby="js_legacy_package">
        <h2 id="js_legacy_package">JS_LEGACY_PACKAGE</h2>
        <p className={styles.sev}>critical</p>
        <dl className={styles.defs}>
          <dt>Meaning</dt><dd>{"The repo depends on the legacy "}<code>{"soroban-client"}</code>{" or the unscoped "}<code>{"stellar-sdk"}</code>{" package."}</dd>
          <dt>Evidence shown</dt><dd><code>{"Legacy package name detected in manifest"}</code>{", with the reference source and observation time."}</dd>
          <dt>What to do</dt><dd>{"Replace it with "}<code>{"@stellar/stellar-sdk"}</code>{"."}</dd>
        </dl>
      </section>
      <section className={styles.finding} aria-labelledby="manifest_unparseable">
        <h2 id="manifest_unparseable">MANIFEST_UNPARSEABLE</h2>
        <p className={styles.sev}>warning</p>
        <dl className={styles.defs}>
          <dt>Meaning</dt><dd>{"A Cargo.toml, a package.json, or a directory could not be read or parsed. Its dependencies were not checked."}</dd>
          <dt>Evidence shown</dt><dd>{"The parser or file-system error message."}</dd>
          <dt>What to do</dt><dd>{"Fix the file or the unreadable directory (for example invalid TOML or JSON, or a permission error) and run again. Until then that path is unchecked."}</dd>
        </dl>
      </section>
      <section className={styles.finding} aria-labelledby="data_degraded">
        <h2 id="data_degraded">DATA_DEGRADED</h2>
        <p className={styles.sev}>warning</p>
        <dl className={styles.defs}>
          <dt>Meaning</dt><dd>{"One of the ecosystem sources failed or returned partial data, or a stale or fallback cached snapshot was used. Related verdicts may be unknown or incomplete."}</dd>
          <dt>Evidence shown</dt><dd><code>{"Reported while collecting the snapshot observed <time>"}</code>{". The message names the failing source, for example "}<code>{"stellarDocs.get_doc_page: ..."}</code>{". The file column reads "}<code>{"(ecosystem data)"}</code>{"."}</dd>
          <dt>What to do</dt><dd>{"Run again. If it persists, check Raven availability and read the message for which source failed."}</dd>
        </dl>
      </section>
      <section className={styles.finding} aria-labelledby="no_sdk_found">
        <h2 id="no_sdk_found">NO_SDK_FOUND</h2>
        <p className={styles.sev}>info</p>
        <dl className={styles.defs}>
          <dt>Meaning</dt><dd>{"No soroban-sdk or Stellar JavaScript SDK dependency was detected in the scanned path."}</dd>
          <dt>Evidence shown</dt><dd><code>{"Scanned Cargo.toml and package.json files under <root>"}</code>{"."}</dd>
          <dt>What to do</dt><dd>{"Check the path. Folders such as node_modules and target are skipped, and the scan stops four levels down."}</dd>
        </dl>
      </section>
      <section className={styles.finding} aria-labelledby="cli_deprecated">
        <h2 id="cli_deprecated">CLI_DEPRECATED</h2>
        <p className={styles.sev}>critical</p>
        <dl className={styles.defs}>
          <dt>Meaning</dt><dd>{"A pinned stellar-cli is two or more majors behind the current Stellar CLI. One finding per pin; nothing is reported when the repo pins none."}</dd>
          <dt>Evidence shown</dt><dd>{"The pin and the file and line it came from, for example pinned in .github/workflows/ci.yml:23. The comparison uses the Stellar CLI version on the official software versions page."}</dd>
          <dt>What to do</dt><dd>{"Upgrade the pin to the current Stellar CLI major."}</dd>
        </dl>
      </section>
      <section className={styles.finding} aria-labelledby="cli_behind">
        <h2 id="cli_behind">CLI_BEHIND</h2>
        <p className={styles.sev}>warning</p>
        <dl className={styles.defs}>
          <dt>Meaning</dt><dd>{"A pinned stellar-cli is exactly one major behind the current Stellar CLI."}</dd>
          <dt>Evidence shown</dt><dd>{"The pin and the file and line it came from, for example pinned in .github/workflows/ci.yml:23."}</dd>
          <dt>What to do</dt><dd>{"Plan an upgrade to the current major."}</dd>
        </dl>
      </section>
      <section className={styles.finding} aria-labelledby="cli_current">
        <h2 id="cli_current">CLI_CURRENT</h2>
        <p className={styles.sev}>info</p>
        <dl className={styles.defs}>
          <dt>Meaning</dt><dd>{"A pinned stellar-cli is on the current major (or newer)."}</dd>
          <dt>Evidence shown</dt><dd>{"The pin and the file and line it came from, for example pinned in .github/workflows/ci.yml:23."}</dd>
          <dt>What to do</dt><dd>{"Nothing."}</dd>
        </dl>
      </section>
      <section className={styles.finding} aria-labelledby="cli_unknown">
        <h2 id="cli_unknown">CLI_UNKNOWN</h2>
        <p className={styles.sev}>warning</p>
        <dl className={styles.defs}>
          <dt>Meaning</dt><dd>{"A stellar-cli pin exists but its version is unparseable (for example a branch name or a CI expression), or the current Stellar CLI version is unavailable, so no verdict is made."}</dd>
          <dt>Evidence shown</dt><dd>{"The pin and the file and line it came from, for example pinned in .github/workflows/ci.yml:23."}</dd>
          <dt>What to do</dt><dd>{"Pin a plain version, or look for DATA_DEGRADED and run again."}</dd>
        </dl>
      </section>
      <section className={styles.finding} aria-labelledby="rust_target_legacy">
        <h2 id="rust_target_legacy">RUST_TARGET_LEGACY</h2>
        <p className={styles.sev}>warning</p>
        <dl className={styles.defs}>
          <dt>Meaning</dt><dd>{"wasm32-unknown-unknown is declared in a repo with soroban-sdk and no wasm32v1-none. Stellar CLI 23+ builds for wasm32v1-none. One finding per declaration site."}</dd>
          <dt>Evidence shown</dt><dd>{"The declaring file and line, such as rust-toolchain.toml, .cargo/config.toml, a workflow, a Makefile or a script."}</dd>
          <dt>What to do</dt><dd>{"Run rustup target add wasm32v1-none and declare it where the legacy target is declared."}</dd>
        </dl>
      </section>
      <section className={styles.finding} aria-labelledby="rust_toolchain_old">
        <h2 id="rust_toolchain_old">RUST_TOOLCHAIN_OLD</h2>
        <p className={styles.sev}>warning</p>
        <dl className={styles.defs}>
          <dt>Meaning</dt><dd>{"A pinned Rust channel is below 1.84.0 in a repo with soroban-sdk. The setup guide requires Rust v1.84.0 or higher. stable and nightly are not pins."}</dd>
          <dt>Evidence shown</dt><dd>{"The pinned channel and the file and line it came from."}</dd>
          <dt>What to do</dt><dd>{"Raise the pinned channel to 1.84.0 or higher."}</dd>
        </dl>
      </section>
      <PrevNext href="/docs/findings" />
    </>
  );
}
