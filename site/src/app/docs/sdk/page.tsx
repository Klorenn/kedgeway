import type { Metadata } from "next";
import { docsMeta } from "@/lib/seo";
import Link from "next/link";
import CodeBlock from "@/components/CodeBlock";
import Callout from "@/components/docs/Callout";
import PrevNext from "@/components/docs/PrevNext";
import styles from "../docs.module.css";

export const metadata: Metadata = docsMeta("TypeScript SDK — kedgeway docs", "Call kedgeway diagnose and migrate from your own TypeScript or JavaScript code.", "/docs/sdk");

export default function Page() {
  return (
    <>
      <h1>TypeScript SDK</h1>
      <p className={styles.lede}>The CLI runs on top of a library. Import it to diagnose or migrate a repo from your own tooling.</p>

      <h2>Install</h2>
      <p>kedgeway is not on npm yet. Build it from source (see <Link href="/docs/getting-started">Getting started</Link>) and link it, or depend on a checkout. It needs Node 22.12 or newer. Type declarations are bundled.</p>
      <Callout kind="warning">
        <p>The package is ESM only. The <code>exports</code> map has no <code>default</code> or <code>require</code> condition, so <code>require(&quot;kedgeway&quot;)</code> does not work. Use <code>import</code>.</p>
      </Callout>

      <h2>API</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th scope="col">Export</th><th scope="col">What it does</th></tr></thead>
          <tbody>
            <tr><th scope="row"><code>{"diagnose(opts: { path; ecosystem?; fixture? })"}</code></th><td>Scans the repo and returns a <code>Diagnosis</code> (<code>findings</code> and <code>summary</code>). Uses live Raven unless you pass <code>fixture</code> or an <code>ecosystem</code>.</td></tr>
            <tr><th scope="row"><code>diagnoseDetailed(opts)</code></th><td>Same options; returns <code>{"{ facts, snapshot, diagnosis }"}</code>.</td></tr>
            <tr><th scope="row"><code>scanRepo(path)</code></th><td>Reads manifests and returns <code>RepoFacts</code>. Throws if the path does not exist or is not a directory.</td></tr>
            <tr><th scope="row"><code>diagnoseRepo(facts, snapshot)</code></th><td>The pure rule engine: no I/O.</td></tr>
            <tr><th scope="row"><code>createRavenEcosystem(opts?)</code></th><td>An <code>EcosystemPort</code> backed by Stellar Raven. Options: <code>authPath</code> and <code>interactive</code> (set <code>false</code> to fail fast instead of starting OAuth).</td></tr>
            <tr><th scope="row"><code>loadFixture(file)</code>, <code>FakeEcosystem</code></th><td>Offline snapshots. See <Link href="/docs/fixtures">Fixtures</Link>.</td></tr>
            <tr><th scope="row"><code>planMigration(facts, snapshot)</code></th><td>Builds a <code>MigrationPlan</code> of version bumps and manual steps.</td></tr>
            <tr><th scope="row"><code>buildGuide(plan, snapshot, hits)</code></th><td>The migration guide: published version, protocol, steps, and the Raven notes whose title or url is a migration document.</td></tr>
            <tr><th scope="row"><code>findImportHits(files, names)</code></th><td>Pure search for import lines of the given package names.</td></tr>
            <tr><th scope="row"><code>applyMigration(plan, {"{ write }"})</code></th><td>Dry run by default; edits files only when <code>write</code> is true.</td></tr>
            <tr><th scope="row"><code>migrate(opts)</code></th><td>Diagnose, plan and apply in one call. Adds <code>write?</code> to the diagnose options.</td></tr>
            <tr><th scope="row"><code>{"toSarif(detailed, { cwd? })"}</code></th><td>A SARIF 2.1.0 log. Same document as <code>diagnose --format sarif</code> or <code>--sarif</code>.</td></tr>
            <tr><th scope="row"><code>{"toAnnotations(detailed, { cwd? })"}</code></th><td>GitHub workflow commands, one per finding. Same lines as <code>--format annotations</code>.</td></tr>
          </tbody>
        </table>
      </div>
      <p>Types: <code>Diagnosis</code>, <code>Finding</code>, <code>Severity</code>, <code>EcosystemSnapshot</code>, <code>RepoFacts</code>, <code>MigrationPlan</code>, <code>MigrationStep</code>, <code>MigrationGuide</code>, <code>SourceHit</code>.</p>

      <h2>Example, offline</h2>
      <CodeBlock code={`import { diagnose } from "kedgeway";

const diagnosis = await diagnose({
  path: ".",
  fixture: "snapshot.json", // see the Fixtures page for the shape
});

console.log(diagnosis.summary); // { critical, warning, info }
for (const f of diagnosis.findings) {
  console.log(f.severity, f.code, f.file);
}
process.exitCode = diagnosis.summary.critical > 0 ? 2 : 0;`} />
      <p>For live data, drop <code>fixture</code> or pass <code>ecosystem: createRavenEcosystem()</code>. That needs a stored login (<code>kedgeway login</code>).</p>
      <PrevNext href="/docs/sdk" />
    </>
  );
}
