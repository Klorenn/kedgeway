import type { Metadata } from "next";
import PrevNext from "@/components/docs/PrevNext";
import styles from "../docs.module.css";

export const metadata: Metadata = {
  title: "What it scans — kedgeway docs",
  description: "Which manifests and dependency forms kedgeway reads, what it skips, and how it reads version ranges.",
  alternates: { canonical: "/docs/what-it-scans" },
  openGraph: { title: "What it scans — kedgeway docs", description: "Which manifests and dependency forms kedgeway reads, what it skips, and how it reads version ranges.", url: "/docs/what-it-scans" },
};

export default function WhatItScans() {
  return (
    <>
      <h1>What it scans</h1>
      <p className={styles.lede}>kedgeway reads manifests, not source code and not lockfiles.</p>

      <h2>Cargo.toml</h2>
      <p>It looks for the <code>soroban-sdk</code> crate in these forms:</p>
      <pre className="block"><code>{`# string
soroban-sdk = "21.0.0"

# table
soroban-sdk = { version = "21.0.0", features = ["testutils"] }

# renamed
sdk = { package = "soroban-sdk", version = "21.0.0" }

# workspace
[workspace.dependencies]
soroban-sdk = "21.0.0"

[dependencies]
soroban-sdk = { workspace = true }`}</code></pre>
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
      <PrevNext href="/docs/what-it-scans" />
    </>
  );
}
