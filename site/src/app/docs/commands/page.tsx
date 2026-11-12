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
      <p className={styles.lede}>Five commands: <code>diagnose</code>, <code>login</code>, <code>logout</code>, <code>migrate</code> and <code>mcp</code>.</p>

      <h2 id="diagnose">diagnose</h2>
      <CodeBlock label="bash" code={"kedgeway diagnose [path] [--json] [--fixture <file>] [--fail-on <severity>]"} />
      <p>Scans the repo at <code>path</code> (default: the current directory), fetches ecosystem data, and prints a report. Raven is used unless you pass <code>--fixture</code>.</p>
      <dl className={styles.defs}>
        <dt><code>--json</code></dt>
        <dd>Print the diagnosis as JSON instead of text. The object has <code>findings</code> (each with <code>severity</code>, <code>code</code>, <code>message</code>, <code>file</code>, <code>evidence</code>) and <code>summary</code> (<code>critical</code>, <code>warning</code>, <code>info</code>).</dd>
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

      <h2 id="logout">logout</h2>
      <CodeBlock label="bash" code={"kedgeway logout"} />
      <p>Deletes the stored credentials. It prints whether anything was removed and exits with 0 either way.</p>

      <h2 id="migrate">migrate</h2>
      <CodeBlock code={"kedgeway migrate [path] [--write] [--fixture <file>]"} />
      <p>Experimental. Plans SDK version bumps and prints a unified diff; it edits files only with <code>--write</code>. Exit 0 when there is nothing to do or the edits were applied, 2 on a dry run with a plan, 1 on error. See <Link href="/docs/migrate">Migration mode</Link>.</p>

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
