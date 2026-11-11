import type { Metadata } from "next";
import Link from "next/link";
import PrevNext from "@/components/docs/PrevNext";
import styles from "../docs.module.css";

export const metadata: Metadata = {
  title: "Architecture — kedgeway docs",
  description: "How kedgeway is organized: pure core, ports, adapters and the CLI.",
  alternates: { canonical: "/docs/architecture" },
  openGraph: { title: "Architecture — kedgeway docs", description: "How kedgeway is organized: pure core, ports, adapters and the CLI.", url: "/docs/architecture" },
};

export default function Architecture() {
  return (
    <>
      <h1>Architecture</h1>
      <p className={styles.lede}>kedgeway is hexagonal: the rules are pure, and everything that touches the outside world sits behind a port.</p>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th scope="col">Layer</th><th scope="col">Files</th><th scope="col">Role</th></tr></thead>
          <tbody>
            <tr><th scope="row">core</th><td><code>src/core/diagnose.ts</code>, <code>src/core/repo-facts.ts</code></td><td>Pure functions. <code>repo-facts</code> parses manifests and versions; <code>diagnose</code> turns facts and a snapshot into findings. No I/O.</td></tr>
            <tr><th scope="row">ports</th><td><code>src/ports/ecosystem.ts</code></td><td><code>EcosystemPort</code>: one method, <code>fetchSnapshot()</code>, returning an ecosystem snapshot.</td></tr>
            <tr><th scope="row">adapters</th><td><code>src/adapters/</code></td><td><code>fs-repo-scanner</code> walks the repo. <code>raven-ecosystem</code>, <code>raven-auth</code> and <code>raven-parse</code> are the Raven MCP client, OAuth and result parser. <code>fake-ecosystem</code> loads fixtures.</td></tr>
            <tr><th scope="row">cli</th><td><code>src/cli.ts</code>, <code>src/cli/commands.ts</code></td><td>Commands, flags, report formatting and exit codes. Wires adapters to the core.</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Flow of one run</h2>
      <ol>
        <li>The scanner produces <em>repo facts</em>: Rust and JavaScript dependencies plus manifest errors.</li>
        <li>An <code>EcosystemPort</code> (Raven, or the fake from a fixture) produces a snapshot.</li>
        <li><code>diagnose(facts, snapshot)</code> returns findings and a summary.</li>
        <li>The CLI prints them and computes the exit code.</li>
      </ol>

      <h2>Tests</h2>
      <p>Tests sit next to the code as <code>*.test.ts</code> and run with Vitest (<code>npm test</code>). Development is test-first: write the failing test, then the rule.</p>

      <h2>Adding a rule</h2>
      <ol>
        <li>Write a failing test in <code>src/core/diagnose.test.ts</code> with the facts and snapshot that should trigger it.</li>
        <li>Add the logic to <code>src/core/diagnose.ts</code>, returning a finding with a severity, code, message, file and evidence that cites the snapshot source.</li>
        <li>If the rule needs a new input, extend the parser in <code>src/core/repo-facts.ts</code> first, with tests.</li>
        <li>Document the code on the <Link href="/docs/findings">Findings</Link> page.</li>
      </ol>
      <PrevNext href="/docs/architecture" />
    </>
  );
}
