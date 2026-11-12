import type { Metadata } from "next";
import Link from "next/link";
import CodeBlock from "@/components/CodeBlock";
import PrevNext from "@/components/docs/PrevNext";
import styles from "../docs.module.css";

export const metadata: Metadata = {
  title: "Getting started — kedgeway docs",
  description: "Install kedgeway from source, log in, and run your first diagnosis.",
  alternates: { canonical: "/docs/getting-started" },
  openGraph: { title: "Getting started — kedgeway docs", description: "Install kedgeway from source, log in, and run your first diagnosis.", url: "/docs/getting-started", images: [{ url: "/docs/opengraph-image", width: 1200, height: 630 }] },
};

export default function GettingStarted() {
  return (
    <>
      <h1>Getting started</h1>
      <p className={styles.lede}>Five minutes from clone to your first report. You need Node.js 22.12 or newer.</p>

      <h2>Install</h2>
      <p>kedgeway is not published to npm yet. <code>npm install -g kedgeway</code> is coming soon. Until then, build it from source:</p>
      <CodeBlock label="bash" code={`git clone https://github.com/Klorenn/kedgeway
cd kedgeway
npm ci
npm run build
npm link`} />
      <p>Check it worked:</p>
      <CodeBlock label="bash" code={"kedgeway --help"} />

      <h2>Log in</h2>
      <CodeBlock label="bash" code={"kedgeway login"} />
      <p>
        This opens your browser to authorize kedgeway with Stellar Raven. The authorization URL is also printed to the terminal, in case the browser does not open. You only do this once; the token is stored locally. Details are in <Link href="/docs/authentication">Authentication</Link>.
      </p>

      <h2>Run your first diagnosis</h2>
      <CodeBlock label="bash" code={"kedgeway diagnose ./my-contract"} />
      <p>The path is optional and defaults to the current directory. kedgeway walks the repo, fetches live ecosystem data, and prints a report.</p>

      <h2>Read the output</h2>
      <CodeBlock label="output" copy={false} code={`kedgeway: ./my-contract
Ecosystem: soroban-sdk current major 28, observed 2026-11-11T22:00:57Z

[CRITICAL] SDK_DEPRECATED  contracts/hello/Cargo.toml
  soroban-sdk 21.0.0 is on a major listed as deprecated (current: 28). Upgrade.
  evidence: major 21 < current major 28 and appears in the Scout deprecated sample (source: <source>, observed <time>).
[CRITICAL] JS_LEGACY_PACKAGE  package.json
  soroban-client 1.0.0 is a legacy package; replace it with @stellar/stellar-sdk.
  evidence: Legacy package name detected in manifest; reference: <source>, observed <time>.

Summary: 2 critical, 0 warning, 0 info`} />
      <ul>
        <li><strong>Header.</strong> The root that was scanned, and the current soroban-sdk major with the time it was observed.</li>
        <li><strong>Each finding.</strong> Severity, code and file on the first line, then what it means, then the evidence and its source.</li>
        <li><strong>Summary.</strong> Counts by severity.</li>
      </ul>
      <p>Every code is explained in <Link href="/docs/findings">Findings</Link>. In the example, <code>&lt;source&gt;</code> and <code>&lt;time&gt;</code> stand in for the real source string and timestamp.</p>
      <p className={styles.note}>Use <code>--json</code> for machine-readable output and <code>--fail-on</code> to turn findings into an exit code. See <Link href="/docs/commands">Commands</Link>.</p>
      <PrevNext href="/docs/getting-started" />
    </>
  );
}
