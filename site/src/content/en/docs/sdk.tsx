import type { DocsSdkDict } from "../../schema/docs-sdk";
import { linkFor } from "@/i18n/Link";

const L = linkFor("en");

export default {
  meta: { title: "TypeScript SDK — kedgeway docs", description: "Call kedgeway diagnose and migrate from your own TypeScript or JavaScript code." },
  h1: "TypeScript SDK",
  lede: <>The CLI runs on top of a library. Import it to diagnose or migrate a repo from your own tooling.</>,
  installH: "Install",
  install: <><code>npm install kedgeway</code>. It needs Node 22.12 or newer. Type declarations are bundled. See <L to="/docs/getting-started">Getting started</L> for the CLI.</>,
  esmWarning: <>The package is ESM only. The <code>exports</code> map has no <code>default</code> or <code>require</code> condition, so <code>require(&quot;kedgeway&quot;)</code> does not work. Use <code>import</code>.</>,
  apiH: "API",
  cols: { export: "Export", does: "What it does" },
  api: {
    diagnose: <>Scans the repo and returns a <code>Diagnosis</code> (<code>findings</code> and <code>summary</code>). Uses live Raven unless you pass <code>fixture</code> or an <code>ecosystem</code>.</>,
    diagnoseDetailed: <>Same options; returns <code>{"{ facts, snapshot, diagnosis }"}</code>.</>,
    scanRepo: <>Reads manifests and returns <code>RepoFacts</code>. Throws if the path does not exist or is not a directory.</>,
    diagnoseRepo: <>The pure rule engine: no I/O.</>,
    createRavenEcosystem: <>An <code>EcosystemPort</code> backed by Stellar Raven. Options: <code>authPath</code> and <code>interactive</code> (set <code>false</code> to fail fast instead of starting OAuth).</>,
    fixtures: <>Offline snapshots. See <L to="/docs/fixtures">Fixtures</L>.</>,
    planMigration: <>Builds a <code>MigrationPlan</code> of version bumps and manual steps.</>,
    buildGuide: <>The migration guide: published version, protocol, steps, and the Raven notes whose title or url is a migration document.</>,
    findImportHits: <>Pure search for import lines of the given package names.</>,
    applyMigration: <>Dry run by default; edits files only when <code>write</code> is true.</>,
    migrate: <>Diagnose, plan and apply in one call. Adds <code>write?</code> to the diagnose options.</>,
    toSarif: <>A SARIF 2.1.0 log. Same document as <code>diagnose --format sarif</code> or <code>--sarif</code>.</>,
    toAnnotations: <>GitHub workflow commands, one per finding. Same lines as <code>--format annotations</code>.</>,
  },
  types: <>Types: <code>Diagnosis</code>, <code>Finding</code>, <code>Severity</code>, <code>EcosystemSnapshot</code>, <code>RepoFacts</code>, <code>MigrationPlan</code>, <code>MigrationStep</code>, <code>MigrationGuide</code>, <code>SourceHit</code>.</>,
  exampleH: "Example, offline",
  live: <>For live data, drop <code>fixture</code> or pass <code>ecosystem: createRavenEcosystem()</code>. That needs a stored login (<code>kedgeway login</code>).</>,
} satisfies DocsSdkDict;
