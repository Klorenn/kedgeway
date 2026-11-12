import type { Metadata } from "next";
import Link from "next/link";
import CodeBlock from "@/components/CodeBlock";
import Callout from "@/components/docs/Callout";
import PrevNext from "@/components/docs/PrevNext";
import styles from "../docs.module.css";

export const metadata: Metadata = {
  title: "GitHub Action — kedgeway docs",
  description: "Run kedgeway in GitHub Actions and fail a build on SDK drift.",
  alternates: { canonical: "/docs/github-action" },
  openGraph: { title: "GitHub Action — kedgeway docs", description: "Run kedgeway in GitHub Actions and fail a build on SDK drift.", url: "/docs/github-action", images: [{ url: "/docs/opengraph-image", width: 1200, height: 630 }] },
};

export default function Page() {
  return (
    <>
      <h1>GitHub Action</h1>
      <p className={styles.lede}>Run kedgeway on every pull request and fail the build when a finding meets your threshold.</p>

      <h2>Use it</h2>
      <CodeBlock code={`- uses: actions/checkout@v4
- uses: Klorenn/kedgeway@v0.1.0
  with:
    path: .
    fail-on: warning
    auth: \${{ secrets.KEDGEWAY_AUTH }}   # live Raven data; or use fixture: for offline`} />
      <p>Pin a release tag as above. <code>@main</code> is unpinned and can change under you.</p>

      <h2>Inputs and outputs</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th scope="col">Input</th><th scope="col">Default</th><th scope="col">Meaning</th></tr></thead>
          <tbody>
            <tr><th scope="row"><code>path</code></th><td><code>.</code></td><td>Directory to scan.</td></tr>
            <tr><th scope="row"><code>fail-on</code></th><td><code>warning</code></td><td>Fail on any finding at or above this severity. Empty disables.</td></tr>
            <tr><th scope="row"><code>fixture</code></th><td>none</td><td>Ecosystem snapshot JSON (offline). Set this <strong>or</strong> <code>auth</code>.</td></tr>
            <tr><th scope="row"><code>auth</code></th><td>none</td><td>Raven credentials from <code>kedgeway login --export</code>, as a secret. Set this <strong>or</strong> <code>fixture</code>.</td></tr>
            <tr><th scope="row"><code>json</code></th><td><code>false</code></td><td>Print JSON instead of text.</td></tr>
            <tr><th scope="row"><code>sarif</code></th><td><code>false</code></td><td>Also write SARIF 2.1.0 to <code>$RUNNER_TEMP/kedgeway.sarif</code>.</td></tr>
            <tr><th scope="row"><code>annotations</code></th><td>on in Actions</td><td>Emit a GitHub annotation, with file and line, for each finding. Set <code>&quot;false&quot;</code> to disable.</td></tr>
          </tbody>
        </table>
      </div>
      <p>Outputs: <code>summary</code> (for example <code>critical=0 warning=1 info=2</code>) <code>report-json</code> (the path of the JSON report under <code>RUNNER_TEMP</code>) and <code>sarif</code> (the SARIF file path, only when <code>sarif</code> is on).</p>

      <h2>Auth or a fixture is required</h2>
      <p>The action needs one of two inputs, and names both if neither is set.</p>
      <ul>
        <li><code>auth</code>: your <code>KEDGEWAY_AUTH</code> secret, for live Raven data. Export it with <code>kedgeway login --export</code>.</li>
        <li><code>fixture</code>: a committed snapshot (see <Link href="/docs/fixtures">Fixtures</Link>). Offline and deterministic; you refresh it.</li>
      </ul>
      <Callout kind="warning">
        <p>The secret refreshes in memory only. If Raven rotates refresh tokens, the secret can go stale and must be re-exported when runs start failing. Treat it like a password.</p>
      </Callout>

      <h2>Annotations</h2>
      <p>With <code>annotations</code> on, which is the default when the action runs on GitHub, each finding becomes a workflow command pointing at the dependency&apos;s line in its manifest. Critical is <code>::error</code>, warning is <code>::warning</code>, info is <code>::notice</code>. On a pull request they show on the changed files in the diff. No extra permission or step is needed.</p>
      <ul>
        <li>GitHub caps annotations at 10 per type (error, warning, notice) per step and 50 per job. A large repo shows only the first ones; the full report is still printed in the log.</li>
        <li>Findings that are not about a file, such as <code>DATA_DEGRADED</code> and <code>NO_SDK_FOUND</code>, have no file and show on the run instead.</li>
        <li>The line comes from a plain scan of the manifest (the first matching key), so it is best effort. Paths are relative to the directory the action runs from.</li>
        <li>Finding text is sanitised before it is printed, so a manifest cannot inject workflow commands.</li>
      </ul>
      <p>Outside Actions, use <code>kedgeway diagnose --format annotations</code> or <code>--annotations &lt;file&gt;</code>. See <Link href="/docs/commands">Commands</Link>. SARIF below is separate and stays: it feeds code scanning, annotations feed the diff.</p>

      <h2>SARIF and code scanning</h2>
      <CodeBlock code={`permissions:
  contents: read
  security-events: write
steps:
  - uses: actions/checkout@v4
  - id: kedgeway
    uses: Klorenn/kedgeway@v0.1.0
    with:
      auth: \${{ secrets.KEDGEWAY_AUTH }}
      sarif: "true"
      fail-on: ""            # let the upload step report instead of failing here
  - uses: github/codeql-action/upload-sarif@v3
    if: always()
    with:
      sarif_file: \${{ steps.kedgeway.outputs.sarif }}`} />
      <p>The log has one run for the tool <code>kedgeway</code>, a rule per finding code (12), and one result per finding with the repo-relative manifest path. Critical is an error, warning is a warning, info is a note. Findings that are not about a file, such as <code>DATA_DEGRADED</code> and <code>NO_SDK_FOUND</code>, have no location.</p>

      <h2>Exit codes and speed</h2>
      <p>The action runs <code>diagnose</code> once, always writes its outputs, then exits with the CLI&apos;s code: 0 when nothing met the threshold, 2 when a finding did, 1 on a tool error. It builds kedgeway from source on every run (<code>npm ci &amp;&amp; npm run build</code>), which is slow, until built <code>dist/</code> is committed on release tags.</p>
      <PrevNext href="/docs/github-action" />
    </>
  );
}
