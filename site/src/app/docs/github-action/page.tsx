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
    fixture: fixtures/ecosystem-2026-11-11.json`} />
      <p>Pin a release tag as above. <code>@main</code> is unpinned and can change under you.</p>

      <h2>Inputs and outputs</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th scope="col">Input</th><th scope="col">Default</th><th scope="col">Meaning</th></tr></thead>
          <tbody>
            <tr><th scope="row"><code>path</code></th><td><code>.</code></td><td>Directory to scan.</td></tr>
            <tr><th scope="row"><code>fail-on</code></th><td><code>warning</code></td><td>Fail on any finding at or above this severity. Empty disables.</td></tr>
            <tr><th scope="row"><code>fixture</code></th><td>none</td><td>Ecosystem snapshot JSON. Required for now.</td></tr>
            <tr><th scope="row"><code>json</code></th><td><code>false</code></td><td>Print JSON instead of text.</td></tr>
          </tbody>
        </table>
      </div>
      <p>Outputs: <code>summary</code> (for example <code>critical=0 warning=1 info=2</code>) and <code>report-json</code> (the path of the JSON report under <code>RUNNER_TEMP</code>).</p>

      <h2>A fixture is required</h2>
      <Callout kind="warning">
        <p>OAuth in CI is not supported yet. Without <code>fixture</code> the action fails fast with a clear message. Commit a snapshot (see <Link href="/docs/fixtures">Fixtures</Link>) and refresh it from a machine where you are logged in.</p>
      </Callout>

      <h2>Exit codes and speed</h2>
      <p>The action runs <code>diagnose</code> once, always writes its outputs, then exits with the CLI&apos;s code: 0 when nothing met the threshold, 2 when a finding did, 1 on a tool error. It builds kedgeway from source on every run (<code>npm ci &amp;&amp; npm run build</code>), which is slow, until built <code>dist/</code> is committed on release tags.</p>
      <PrevNext href="/docs/github-action" />
    </>
  );
}
