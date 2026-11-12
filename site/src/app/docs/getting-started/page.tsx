import type { Metadata } from "next";
import { docsMeta } from "@/lib/seo";
import Link from "next/link";
import CodeBlock from "@/components/CodeBlock";
import PrevNext from "@/components/docs/PrevNext";
import styles from "../docs.module.css";

export const metadata: Metadata = docsMeta("Getting started — kedgeway docs", "Install kedgeway from npm, log in, and run your first diagnosis.", "/docs/getting-started");

export default function GettingStarted() {
  return (
    <>
      <h1>Getting started</h1>
      <p className={styles.lede}>Five minutes from clone to your first report. You need Node.js 22.12 or newer.</p>

      <h2>Install</h2>
      <p>Install the CLI. It needs Node.js 22.12 or newer.</p>
      <CodeBlock code={"npm install -g kedgeway"} />
      <p>To hack on it, clone <a href="https://github.com/Klorenn/kedgeway">Klorenn/kedgeway</a>, then <code>npm ci</code>, <code>npm run build</code> and <code>npm link</code>.</p>
      <p>Check it worked:</p>
      <CodeBlock code={"kedgeway --help"} />

      <h2>Log in</h2>
      <CodeBlock code={"kedgeway login"} />
      <p>
        This opens your browser to authorize kedgeway with Stellar Raven. The authorization URL is also printed to the terminal, in case the browser does not open. You only do this once; the token is stored locally. Details are in <Link href="/docs/authentication">Authentication</Link>.
      </p>

      <h2>Run your first diagnosis</h2>
      <CodeBlock code={"kedgeway diagnose ./my-contract"} />
      <p>The path is optional and defaults to the current directory. kedgeway walks the repo, fetches live ecosystem data, and prints a report.</p>

      <h2>Read the output</h2>
      <CodeBlock copy={false} code={`kedgeway: ./my-contract
Ecosystem: soroban-sdk current major 28, observed 2026-11-11T22:00:57Z

[CRITICAL] SDK_DEPRECATED  contracts/hello/Cargo.toml
  soroban-sdk 21.0.0 is on a major listed as deprecated (current: 28). Upgrade.
  evidence: major 21 < current major 28 and appears in the Scout deprecated sample (source: <source>, observed <time>).
[CRITICAL] JS_LEGACY_PACKAGE  package.json
  soroban-client 1.0.0 is a legacy package; replace it with @stellar/stellar-sdk.
  evidence: Legacy package name detected in manifest; reference: <source>, observed <time>.

Summary: 2 critical, 0 warning, 0 info`} />
      <dl className={styles.defs}>
        <div><dt>Header</dt><dd>The root that was scanned, and the current soroban-sdk major with the time it was observed.</dd></div>
        <div><dt>Each finding</dt><dd>Severity, code and file on the first line, then what it means, then the evidence and its source.</dd></div>
        <div><dt>Summary</dt><dd>Counts by severity.</dd></div>
      </dl>
      <p>Every code is explained in <Link href="/docs/findings">Findings</Link>. In the example, <code>&lt;source&gt;</code> and <code>&lt;time&gt;</code> stand in for the real source string and timestamp.</p>
      <p className={styles.note}>Use <code>--json</code> for machine-readable output and <code>--fail-on</code> to turn findings into an exit code. See <Link href="/docs/commands">Commands</Link>.</p>
      <PrevNext href="/docs/getting-started" />
    </>
  );
}
