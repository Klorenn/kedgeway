import type { Metadata } from "next";
import Link from "next/link";
import CodeBlock from "@/components/CodeBlock";
import PrevNext from "@/components/docs/PrevNext";
import styles from "../docs.module.css";

export const metadata: Metadata = {
  title: "Commands — kedgeway docs",
  description: "Every kedgeway command, flag and exit code.",
  alternates: { canonical: "/docs/commands" },
  openGraph: { title: "Commands — kedgeway docs", description: "Every kedgeway command, flag and exit code.", url: "/docs/commands", images: [{ url: "/docs/opengraph-image", width: 1200, height: 630 }] },
};

export default function Commands() {
  return (
    <>
      <h1>Commands</h1>
      <p className={styles.lede}>Six commands: <code>diagnose</code>, <code>login</code>, <code>logout</code>, <code>doctor</code>, <code>migrate</code> and <code>mcp</code>.</p>

      <h2 id="diagnose">diagnose</h2>
      <CodeBlock label="bash" code={"kedgeway diagnose [path] [--format <text|json|sarif|annotations>] [--sarif <file>] [--annotations <file>] [--fixture <file>] [--fail-on <severity>] [--offline] [--no-cache] [--max-age <duration>]"} />
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
        <dd>Use the cached ecosystem snapshot only and never call Raven. Exits 1 if there is no cache; contradicts <code>--no-cache</code>; ignored with a warning when <code>--fixture</code> is set. Also on <code>migrate</code>.</dd>
        <dt><code>--no-cache</code></dt>
        <dd>Ignore the cached snapshot and fetch live. The result is still written to the cache. Also on <code>migrate</code>.</dd>
        <dt><code>{"--max-age <duration>"}</code></dt>
        <dd>How old a cached snapshot may be before it is refetched: <code>30s</code>, <code>15m</code>, <code>24h</code>, <code>2d</code>. Default <code>24h</code>. Also on <code>migrate</code>. See <Link href="/docs/data-sources">Data sources</Link>.</dd>
        <dt><code>{"--fixture <file>"}</code></dt>
        <dd>Read the ecosystem snapshot from a JSON file instead of calling Raven. No login needed. See <Link href="/docs/fixtures">Fixtures</Link>.</dd>
        <dt><code>{"--fail-on <severity>"}</code></dt>
        <dd>Exit with code 2 if any finding is at or above <code>critical</code>, <code>warning</code> or <code>info</code>. Any other value is an error and exits with 1.</dd>
      </dl>
      <CodeBlock label="bash" code={`kedgeway diagnose ./my-contract --fail-on critical
kedgeway diagnose . --json > report.json`} />

      <h2 id="login">login</h2>
      <CodeBlock label="bash" code={"kedgeway login"} />
      <p>Starts a fresh OAuth authorization with Stellar Raven and stores the token. Prints <code>Logged in to Stellar Raven.</code> on success. See <Link href="/docs/authentication">Authentication</Link>.</p>

      <CodeBlock label="bash" code={"kedgeway login --no-browser"} />
      <p><code>login --no-browser</code> is for machines without a browser. It prints the authorization URL instead of opening it. Open the URL anywhere, sign in, then paste the redirect URL (or just its <code>code</code>) back into the terminal. A pasted URL is checked against the login attempt's OAuth state; a bare code carries none. Or forward the callback port with <code>ssh -L</code> and let the redirect land on kedgeway directly. It combines with <code>--export</code>. See <Link href="/docs/authentication#headless">Headless login</Link>.</p>

      <CodeBlock code={"kedgeway login --export"} />
      <p><code>login --export</code> prints your stored credentials as a base64 secret for CI and removes nothing. It only opens the browser flow if nothing is stored. Put the output in a <code>KEDGEWAY_AUTH</code> secret. See <Link href="/docs/ci">CI</Link>.</p>

      <h2 id="logout">logout</h2>
      <CodeBlock label="bash" code={"kedgeway logout"} />
      <p>Deletes the stored credentials. It prints whether anything was removed and exits with 0 either way.</p>

      <h2 id="doctor">doctor</h2>
      <CodeBlock label="bash" code={"kedgeway doctor [--offline]"} />
      <p>A self-check that changes nothing. It prints one line per check, <code>ok</code>, <code>warn</code>, <code>fail</code> or <code>skip</code>:</p>
      <ul>
        <li>Node version (22.12 or newer).</li>
        <li>Auth: a valid <code>KEDGEWAY_AUTH</code> in the environment, an <code>auth.json</code> with tokens, or none.</li>
        <li>Snapshot cache: path and age.</li>
        <li>Raven reachability: one cheap <code>search</code> call with a 10 second timeout. <code>--offline</code> skips it. It uses a read-only copy of your credentials, so a token refresh cannot modify <code>auth.json</code>.</li>
      </ul>
      <p>Exit 0 when nothing failed (warnings do not fail it), 1 when any check failed.</p>

      <h2 id="migrate">migrate</h2>
      <CodeBlock code={"kedgeway migrate [path] [--write] [--fixture <file>]"} />
      <p>Experimental. Plans SDK version bumps and prints a unified diff; it edits files only with <code>--write</code>. Exit 0 for nothing to do, a manual-only dry run, or edits applied; 2 for a dry run with at least one automatic edit, or a write where some step was skipped; 1 on error. It edits manifests only and notes any lockfile it leaves stale, with a manual step to refresh it. See <Link href="/docs/migrate">Migration mode</Link>.</p>

      <h2 id="mcp">mcp</h2>
      <CodeBlock code={"kedgeway mcp"} />
      <p>Runs an MCP server over stdio. It never starts OAuth: log in first. See <Link href="/docs/mcp">MCP server</Link>.</p>

      <h2 id="exit-codes">Exit codes</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th scope="col">Code</th><th scope="col">Meaning</th></tr></thead>
          <tbody>
            <tr><th scope="row"><code>0</code></th><td>The run finished and no <code>--fail-on</code> threshold was hit.</td></tr>
            <tr><th scope="row"><code>1</code></th><td>Tool error: an invalid <code>--fail-on</code> value, a bad flag, a login failure, or a scan or network failure.</td></tr>
            <tr><th scope="row"><code>2</code></th><td>A finding met the <code>--fail-on</code> threshold.</td></tr>
          </tbody>
        </table>
      </div>
      <PrevNext href="/docs/commands" />
    </>
  );
}
