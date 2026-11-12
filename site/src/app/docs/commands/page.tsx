import type { Metadata } from "next";
import { docsMeta } from "@/lib/seo";
import Link from "next/link";
import CodeBlock from "@/components/CodeBlock";
import PrevNext from "@/components/docs/PrevNext";
import styles from "../docs.module.css";

export const metadata: Metadata = docsMeta("Commands — kedgeway docs", "Every kedgeway command, flag and exit code.", "/docs/commands");

export default function Commands() {
  return (
    <>
      <h1>Commands</h1>
      <p className={styles.lede}>Seven commands: <code>diagnose</code>, <code>init</code>, <code>login</code>, <code>logout</code>, <code>doctor</code>, <code>migrate</code> and <code>mcp</code>. Plus <code>--version</code>.</p>

      <h2 id="version">--version</h2>
      <CodeBlock code={"kedgeway --version\nkedgeway -V"} />
      <p>Prints the installed version, read from <code>package.json</code>, and exits with 0.</p>

      <h2 id="diagnose">diagnose</h2>
      <CodeBlock code={"kedgeway diagnose [path] [--json] [--format <text|json|sarif|annotations>] [--sarif <file>] [--annotations <file>] [--fixture <file>] [--fail-on <severity>] [--offline] [--no-cache] [--max-age <duration>]"} />
      <p>Scans the repo at <code>path</code> (default: the current directory), fetches ecosystem data, and prints a report. Raven is used unless you pass <code>--fixture</code>.</p>
      <dl className={styles.defs}>
        <dt><code>--json</code></dt>
        <dd>Print the diagnosis as JSON instead of text. The object has <code>findings</code> (each with <code>severity</code>, <code>code</code>, <code>message</code>, <code>file</code>, <code>evidence</code>) and <code>summary</code> (<code>critical</code>, <code>warning</code>, <code>info</code>).</dd>
        <dt><code>{"--format <text|json|sarif|annotations>"}</code></dt>
        <dd>Choose the stdout format. <code>--json</code> is the same as <code>--format json</code>; using both exits with 1. <code>annotations</code> prints one GitHub workflow command per finding (<code>::error</code>, <code>::warning</code>, <code>::notice</code>, with the manifest file and line), then the normal text report.</dd>
        <dt><code>{"--sarif <file>"}</code></dt>
        <dd>Also write a SARIF 2.1.0 log to <code>file</code>. Stdout still follows <code>--format</code>.</dd>
        <dt><code>{"--annotations <file>"}</code></dt>
        <dd>Also write the GitHub annotations to <code>file</code>. Stdout still follows <code>--format</code>. The line is a best-effort scan of the manifest. See <Link href="/docs/github-action">GitHub Action</Link>.</dd>
        <dt><code>--offline</code></dt>
        <dd>Use the cached ecosystem snapshot only and never call Raven. Exits 1 if there is no cache; contradicts <code>--no-cache</code>; ignored with a warning when <code>--fixture</code> is set. Also on <code>migrate</code>. On <code>doctor</code> the same flag only skips the Raven reachability check.</dd>
        <dt><code>--no-cache</code></dt>
        <dd>Ignore the cached snapshot and fetch live. The result is still written to the cache. Also on <code>migrate</code>.</dd>
        <dt><code>{"--max-age <duration>"}</code></dt>
        <dd>How old a cached snapshot may be before it is refetched: <code>30s</code>, <code>15m</code>, <code>24h</code>, <code>2d</code>. Default <code>24h</code>. Also on <code>migrate</code>. See <Link href="/docs/data-sources">Data sources</Link>.</dd>
        <dt><code>{"--fixture <file>"}</code></dt>
        <dd>Read the ecosystem snapshot from a JSON file instead of calling Raven. No login needed. See <Link href="/docs/fixtures">Fixtures</Link>.</dd>
        <dt><code>{"--fail-on <severity>"}</code></dt>
        <dd>Exit with code 2 if any finding is at or above <code>critical</code>, <code>warning</code> or <code>info</code>. Any other value is an error and exits with 1.</dd>
      </dl>
      <CodeBlock code={`kedgeway diagnose ./my-contract --fail-on critical
kedgeway diagnose . --json > report.json`} />

      <h2 id="init">init</h2>
      <CodeBlock code={"kedgeway init [path] [--force] [--print]"} />
      <p>Writes <code>.github/workflows/kedgeway.yml</code> under <code>path</code> (default: the current directory). The workflow runs on pushes to <code>main</code> or <code>master</code> and on pull requests, and uses <code>Klorenn/kedgeway@v&lt;installed version&gt;</code> with <code>path: .</code>, <code>fail-on: warning</code> and <code>auth: $&#123;&#123; secrets.KEDGEWAY_AUTH &#125;&#125;</code>. Afterwards, create the <code>KEDGEWAY_AUTH</code> repository secret from the output of <code>kedgeway login --export</code>. See <Link href="/docs/github-action#quick-start">GitHub Action</Link>.</p>
      <dl className={styles.defs}>
        <dt><code>--force</code></dt>
        <dd>Overwrite an existing workflow file. Without it, an existing file is left as is and the command exits with 1.</dd>
        <dt><code>--print</code></dt>
        <dd>Print the workflow YAML to stdout and write nothing.</dd>
      </dl>
      <p>Exit 0 on success. Exit 1 if the file exists and <code>--force</code> is not set, or if the write fails.</p>

      <h2 id="login">login</h2>
      <CodeBlock code={"kedgeway login"} />
      <p>Starts a fresh OAuth authorization with Stellar Raven and stores the token. Prints <code>Logged in to Stellar Raven.</code> on success. See <Link href="/docs/authentication">Authentication</Link>.</p>

      <CodeBlock code={"kedgeway login --no-browser"} />
      <p><code>login --no-browser</code> is for machines without a browser. It prints the authorization URL instead of opening it. Open the URL anywhere, sign in, then paste the redirect URL (or just its <code>code</code>) back into the terminal. A pasted URL is checked against the login attempt's OAuth state; a bare code carries none. Or forward the callback port with <code>ssh -L</code> and let the redirect land on kedgeway directly. It combines with <code>--export</code>. See <Link href="/docs/authentication#headless">Headless login</Link>.</p>

      <CodeBlock code={"kedgeway login --export"} />
      <p><code>login --export</code> prints your stored credentials as a base64 secret for CI and removes nothing. It logs in first only when nothing is stored, and it opens a browser unless you also pass <code>--no-browser</code>. Stdout is the secret; stderr warns that it is one. If <code>KEDGEWAY_AUTH</code> is already set in the environment, that value is ignored and the stored login is what gets exported. Put the output in a <code>KEDGEWAY_AUTH</code> secret. See <Link href="/docs/ci">CI</Link>.</p>

      <h2 id="logout">logout</h2>
      <CodeBlock code={"kedgeway logout"} />
      <p>Deletes the stored credentials. It prints whether anything was removed and exits with 0 either way.</p>

      <h2 id="doctor">doctor</h2>
      <CodeBlock code={"kedgeway doctor [--offline]"} />
      <p>A self-check that changes nothing. It prints one line per check, <code>ok</code>, <code>warn</code>, <code>fail</code> or <code>skip</code>:</p>
      <ul>
        <li>Node version (22.12 or newer).</li>
        <li>Auth: a valid <code>KEDGEWAY_AUTH</code> in the environment, an <code>auth.json</code> with tokens, or none.</li>
        <li>Snapshot cache: path and age.</li>
        <li>Raven reachability: one cheap <code>search</code> call with a 10 second timeout. <code>--offline</code> skips it. It uses a read-only copy of your credentials, so a token refresh cannot modify <code>auth.json</code>.</li>
      </ul>
      <p>Exit 0 when nothing failed (warnings do not fail it), 1 when any check failed.</p>

      <h2 id="migrate">migrate</h2>
      <CodeBlock code={"kedgeway migrate [path] [--dry-run] [--write] [--fixture <file>] [--offline] [--no-cache] [--max-age <duration>]"} />
      <p>Prints a migration guide and a unified diff of SDK version bumps. The default is a dry run, and <code>--dry-run</code> is that same mode made explicit. <code>--write</code> applies the manifest edits. Passing both <code>--dry-run</code> and <code>--write</code> exits 1. <code>--offline</code>, <code>--no-cache</code> and <code>--max-age</code> behave as they do on <code>diagnose</code>. Exit 0 for nothing to do, a manual-only dry run, or edits applied; 2 for a dry run with at least one automatic edit, or a write where some step was skipped; 1 on error, including a refused write. It edits manifests only and notes any lockfile it leaves stale, with a manual step to refresh it. See <Link href="/docs/migrate">Migration guide</Link>.</p>

      <h2 id="mcp">mcp</h2>
      <CodeBlock code={"kedgeway mcp [--allow-write]"} />
      <p>Runs an MCP server over stdio. It never starts OAuth: log in first. <code>--allow-write</code> lets the migrate tool edit files; without it, <code>write: true</code> returns an error and dry runs still work. See <Link href="/docs/mcp">MCP server</Link>.</p>

      <h2 id="exit-codes">Exit codes</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th scope="col">Code</th><th scope="col">Meaning</th></tr></thead>
          <tbody>
            <tr><th scope="row"><code>0</code></th><td><code>diagnose</code>: finished, and no <code>--fail-on</code> threshold was hit. <code>migrate</code>: nothing to do, only manual steps, or the edits were applied. <code>init</code>: the workflow was written, or printed with <code>--print</code>. <code>doctor</code> and <code>logout</code>: finished. A <code>warn</code> from <code>doctor</code> still exits 0.</td></tr>
            <tr><th scope="row"><code>1</code></th><td>Tool error: an invalid flag (including <code>--fail-on</code>, <code>--format</code> or <code>--max-age</code>), <code>--json</code> combined with <code>--format</code>, <code>--offline</code> with <code>--no-cache</code>, a login failure, a failed <code>doctor</code> check, <code>init</code> finding an existing workflow without <code>--force</code> or failing to write it, or a scan or network failure.</td></tr>
            <tr><th scope="row"><code>2</code></th><td><code>diagnose</code>: a finding met <code>--fail-on</code>. <code>migrate</code>: a dry run has an automatic edit, or <code>--write</code> skipped a step. <code>doctor</code> never exits 2.</td></tr>
          </tbody>
        </table>
      </div>
      <p><code>logout</code> exits 0 whether or not a credentials file was deleted. <code>--help</code> exits 0. An unknown command or flag exits 1.</p>
      <PrevNext href="/docs/commands" />
    </>
  );
}
