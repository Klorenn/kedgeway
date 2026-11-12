import type { Metadata } from "next";
import Link from "next/link";
import PrevNext from "@/components/docs/PrevNext";
import { DOCS_FLAT } from "@/data/docs-nav";
import styles from "./docs.module.css";

export const metadata: Metadata = {
  title: "Overview — kedgeway docs",
  description: "What kedgeway is and is not, how it thinks, and where to read next.",
  alternates: { canonical: "/docs" },
  openGraph: { title: "Overview — kedgeway docs", description: "What kedgeway is and is not, how it thinks, and where to read next.", url: "/docs", images: [{ url: "/docs/opengraph-image", width: 1200, height: 630 }] },
};

export default function Overview() {
  return (
    <>
      <h1>Overview</h1>
      <p className={styles.lede}>
        kedgeway is a command-line tool that tells you how outdated a Stellar or Soroban repo&apos;s toolchain is. It reads your manifests, asks the live ecosystem what is current, and reports the gap with its sources.
      </p>

      <h2>What it is</h2>
      <ul>
        <li>A CLI that scans <code>Cargo.toml</code> (<code>soroban-sdk</code>) and <code>package.json</code> (<code>@stellar/stellar-sdk</code>, <code>@stellar/stellar-base</code>, and the legacy <code>soroban-client</code> and <code>stellar-sdk</code>).</li>
        <li>Grounded in live data from the Stellar Raven MCP server: the official Software Versions page and the Scout ecosystem toolchain index.</li>
        <li>Evidence-first. Every finding cites its source and the time it was observed.</li>
        <li>Honest about failure. If a source cannot be reached, the report says <code>DATA_DEGRADED</code> instead of guessing.</li>
      </ul>

      <h2>What it is not</h2>
      <ul>
        <li>Not a rewriter. <code>diagnose</code> never changes your repo. <Link href="/docs/migrate">Migration mode</Link> is experimental, bumps versions only, and never runs <code>cargo</code> or <code>npm</code>.</li>
        <li>Not a lockfile auditor. It reads the versions you declare in manifests, not what a lockfile resolved.</li>
        <li>Not a security or contract audit. It only measures SDK version drift.</li>
        <li>Not a service. Your repo contents never leave your machine. See <Link href="/docs/authentication">Authentication</Link>.</li>
      </ul>

      <h2>How it thinks</h2>
      <ol>
        <li><strong>Scan.</strong> Walk the repo and collect SDK dependencies from manifests.</li>
        <li><strong>Ask Raven.</strong> Fetch the current versions and the deprecated sample once per run.</li>
        <li><strong>Diagnose.</strong> Compare each dependency with the ecosystem and print findings by severity.</li>
      </ol>

      <h2>Where to read next</h2>
      <dl className={styles.defs}>
        {DOCS_FLAT.filter((p) => p.href !== "/docs").map((p) => (
          <div key={p.href}>
            <dt><Link href={p.href}>{p.title}</Link></dt>
            <dd>{p.summary}</dd>
          </div>
        ))}
      </dl>
      <PrevNext href="/docs" />
    </>
  );
}
