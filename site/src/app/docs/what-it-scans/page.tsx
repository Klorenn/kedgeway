import type { Metadata } from "next";
import { docsMeta } from "@/lib/seo";
import Link from "next/link";
import CodeBlock from "@/components/CodeBlock";
import PrevNext from "@/components/docs/PrevNext";
import styles from "../docs.module.css";

export const metadata: Metadata = docsMeta("What it scans — kedgeway docs", "Which manifests and dependency forms kedgeway reads, what it skips, and how it reads version ranges.", "/docs/what-it-scans");

export default function WhatItScans() {
  return (
    <>
      <h1>What it scans</h1>
      <p className={styles.lede}>A diagnosis reads manifests and lockfiles. It does not score source code. <code>migrate</code> also lists up to 20 import lines of legacy packages, using the same depth and skipped directories.</p>

      <h2>Cargo.toml</h2>
      <p>It looks for the <code>soroban-sdk</code> crate in these forms:</p>
      <CodeBlock label="toml" code={`# string
soroban-sdk = "21.0.0"

# table
soroban-sdk = { version = "21.0.0", features = ["testutils"] }

# renamed
sdk = { package = "soroban-sdk", version = "21.0.0" }

# workspace
[workspace.dependencies]
soroban-sdk = "21.0.0"

[dependencies]
soroban-sdk = { workspace = true }`} />
      <ul>
        <li><strong>Tables read:</strong> <code>[dependencies]</code>, <code>[dev-dependencies]</code>, <code>[build-dependencies]</code>, and the same three under <code>[target.&lt;cfg&gt;]</code>.</li>
        <li><strong>Renames:</strong> a <code>package = &quot;soroban-sdk&quot;</code> key is followed to the real crate name.</li>
        <li><strong>Workspaces:</strong> a member with <code>workspace = true</code> takes its version from the nearest ancestor manifest that declares the same key in <code>[workspace.dependencies]</code>. A workspace dependency that no member uses is still reported, at the workspace manifest. If a <code>workspace = true</code> dependency cannot be resolved, it is reported with no version, which gives SDK_UNKNOWN.</li>
        <li><strong>Duplicates:</strong> identical findings (same file, crate and version) are reported once.</li>
      </ul>

      <h2>package.json</h2>
      <p>It reads <code>dependencies</code> and <code>devDependencies</code> only, for these packages:</p>
      <ul>
        <li><code>@stellar/stellar-sdk</code></li>
        <li><code>@stellar/stellar-base</code></li>
        <li><code>soroban-client</code> (legacy)</li>
        <li><code>stellar-sdk</code> (legacy, unscoped)</li>
      </ul>
      <p>Peer and optional dependencies are not read.</p>
      <h3>npm aliases</h3>
      <p>A member that uses an <code>npm:</code> alias is read as the real package behind it. This one is the current SDK, <strong>not</strong> the legacy <code>stellar-sdk</code>:</p>
      <CodeBlock label="package.json" code={`"stellar-sdk": "npm:@stellar/stellar-sdk@17.4.0"`} />
      <p>The version after the last <code>@</code> is read as usual. An alias with no version (<code>npm:@stellar/stellar-sdk</code>) is unknown. This was found in a real manifest (stellar/freighter) while building the lockfile corpus. See <Link href="/docs/migrate">Migration mode</Link> for how aliases are edited.</p>

      <h2>Where it looks</h2>
      <ul>
        <li>It walks the path you give, in alphabetical order, up to four folders deep.</li>
        <li>It skips <code>node_modules</code>, <code>target</code>, <code>dist</code>, <code>.git</code>, <code>.next</code>, <code>vendor</code>, <code>build</code> and <code>coverage</code>.</li>
        <li>Unreadable folders and files, and manifests that fail to parse, are reported as MANIFEST_UNPARSEABLE instead of being ignored.</li>
      </ul>

      <h2>How versions are read</h2>
      <p>kedgeway needs a single major version to compare. It strips leading range operators and reads the major from what is left.</p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th scope="col">Declared</th><th scope="col">Read as</th></tr></thead>
          <tbody>
            <tr><th scope="row"><code>21.0.0</code>, <code>^21.0.0</code>, <code>~21.0</code></th><td>major 21</td></tr>
            <tr><th scope="row"><code>{">=21.0.0"}</code></th><td>major 21 (the <code>{">="}</code> is stripped)</td></tr>
            <tr><th scope="row"><code>21.x</code></th><td>major 21</td></tr>
            <tr><th scope="row"><code>{"<22"}</code>, <code>{"<=21.0.0"}</code></th><td>unknown: an upper bound alone does not identify a major</td></tr>
            <tr><th scope="row"><code>{">=20 || ^21"}</code></th><td>unknown: compound ranges are not resolved</td></tr>
            <tr><th scope="row">empty, <code>*</code>, a git or path source</th><td>unknown</td></tr>
          </tbody>
        </table>
      </div>
      <p>An unknown version produces SDK_UNKNOWN or JS_SDK_UNKNOWN, never a guess.</p>
      <p>When a lockfile resolves the dependency, that exact version is used instead and this table only matters as a fallback. Where a JS range is matched against candidate versions, kedgeway uses the <code>semver</code> package, so hyphen ranges, <code>||</code>, x-ranges and npm prerelease rules behave like npm. Cargo requirements use kedgeway&apos;s own matcher: a bare <code>1.2.3</code> is <code>^1.2.3</code>, and <code>*</code>, <code>=</code> and <code>&gt;=, &lt;</code> combinations are understood.</p>
      <h2>Lockfiles</h2>
      <p>A manifest range like <code>^21</code> says little about what you build. When a lockfile exists, kedgeway reports the <strong>resolved</strong> version of each detected dependency and compares that instead of the manifest version. Evidence says which it used, for example <code>resolved 21.7.6 from Cargo.lock; manifest ^21</code>.</p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th scope="col">Lockfile</th><th scope="col">How the direct dependency is found</th></tr></thead>
          <tbody>
            <tr><th scope="row"><code>Cargo.lock</code></th><td>Among the entries for the crate, the one whose version satisfies the manifest requirement (Cargo rules). If none or several do, the dependency stays unresolved and the evidence says <code>ambiguous in Cargo.lock</code>.</td></tr>
            <tr><th scope="row"><code>package-lock.json</code></th><td><code>packages[&quot;node_modules/&lt;name&gt;&quot;]</code> (v2 and v3), else <code>dependencies[&lt;name&gt;]</code> (v1).</td></tr>
            <tr><th scope="row"><code>pnpm-lock.yaml</code></th><td>The importer&apos;s own entry (the root or the workspace member), else the single package version that satisfies the manifest range. Several candidates are reported as ambiguous. Lockfile versions 5 to 9, with a minimal parser.</td></tr>
            <tr><th scope="row"><code>yarn.lock</code></th><td>The block whose descriptor is <code>name@&lt;manifest range&gt;</code> (classic) or <code>name@npm:&lt;range&gt;</code> (berry). Minimal parser.</td></tr>
          </tbody>
        </table>
      </div>
      <ul>
        <li><strong>Ambiguous means fallback.</strong> When a lockfile cannot give one answer, kedgeway uses the manifest version and says so in the evidence. It never guesses.</li>
        <li><strong>Where it looks.</strong> The nearest lockfile walking up from the manifest&apos;s folder to the scan root that has a verdict for that dependency. It never reads above the scan root. If a lockfile exists above it, the text report prints a <code>hint:</code>.</li>
        <li><strong>Ranges that do not pin a major</strong> (such as <code>&lt;21</code>) are no longer unknown when a lockfile pins the dependency.</li>
        <li><strong>Limits.</strong> Only these four lockfiles are read. Unusual pnpm or yarn layouts resolve to nothing and fall back to the manifest. Prerelease tags are ignored when testing a version against a Cargo requirement.</li>
        <li><strong>Tested on real files.</strong> The parsers run against seven real lockfiles from public repositories (Cargo.lock v4, package-lock v3, pnpm-lock v9, yarn classic and berry). Repositories and commits are listed in <code>fixtures/lockfiles/SOURCES.md</code> in the kedgeway repo.</li>
      </ul>

      <h2 id="remote-repositories">Remote repositories</h2>
      <p><code>diagnose</code> and <code>migrate</code> can scan a repository you have not cloned. Pass a git URL or <code>owner/repo</code> instead of a path. See <Link href="/docs/commands#diagnose">Commands</Link> for the accepted forms and <code>--ref</code>.</p>
      <ul>
        <li><strong>How it fetches.</strong> kedgeway runs <code>git clone --depth 1 --single-branch --no-tags</code> into a private temporary directory, scans it, and deletes it afterwards, also when the scan fails. Nothing from the repository is executed.</li>
        <li><strong>Private repositories.</strong> Git credentials must already be configured, through an SSH agent or a credential helper. kedgeway never asks for or stores them.</li>
        <li><strong>Without git.</strong> For GitHub repositories, kedgeway downloads the source tarball and unpacks it with Node only, capped at 50 MB and 20,000 entries.</li>
        <li><strong>Rejected.</strong> <code>file://</code> and every other scheme, URLs with embedded credentials, and unsafe refs exit with 1.</li>
        <li><strong>Output.</strong> The report header shows <code>github.com/o/r@main</code> instead of the temporary path. Finding, SARIF and annotation paths stay relative to the repository root.</li>
        <li><strong>Migrate.</strong> A remote <code>migrate</code> is a dry run only.</li>
      </ul>
      <CodeBlock code={`kedgeway diagnose https://github.com/o/r
kedgeway diagnose o/r --ref v1.2.0`} />

      <h2>Toolchain checks</h2>
      <p>Beyond the SDKs, kedgeway reads the toolchain the repo pins. Every finding points at a file and line.</p>
      <ul>
        <li><strong>Stellar CLI pins.</strong> They are read from workflows (<code>cargo install ... --version X</code>, <code>stellar-cli@X</code>, and the <code>version:</code> input of the <code>stellar/stellar-cli</code> action), <code>Dockerfile*</code>, <code>Makefile</code>, shell scripts in the root and <code>scripts/</code>, <code>.tool-versions</code>, and <code>@stellar/stellar-cli</code> in <code>package.json</code>. Each pin is compared by major with the Stellar CLI version on the official <a href="https://developers.stellar.org/docs/networks/software-versions">software versions</a> page. Nothing is reported if the repo pins none.</li>
        <li><strong>Rust target.</strong> If a repo with <code>soroban-sdk</code> declares <code>wasm32-unknown-unknown</code> (<code>rust-toolchain.toml</code>, <code>.cargo/config.toml</code>, workflows, Makefiles, scripts) and never <code>wasm32v1-none</code>, RUST_TARGET_LEGACY tells you to run <code>rustup target add wasm32v1-none</code>.</li>
        <li><strong>Rust toolchain.</strong> A pinned Rust channel below 1.84.0 raises RUST_TOOLCHAIN_OLD, because the <a href="https://developers.stellar.org/docs/build/smart-contracts/getting-started/setup">setup guide</a> requires Rust v1.84.0 or higher. <code>stable</code> and <code>nightly</code> are not pins.</li>
      </ul>

      <PrevNext href="/docs/what-it-scans" />
    </>
  );
}
