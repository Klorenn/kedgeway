import type { Metadata } from "next";
import PrevNext from "@/components/docs/PrevNext";
import styles from "../docs.module.css";

export const metadata: Metadata = {
  title: "FAQ — kedgeway docs",
  description: "Short answers to common questions about kedgeway.",
  alternates: { canonical: "/docs/faq" },
  openGraph: { title: "FAQ — kedgeway docs", description: "Short answers to common questions about kedgeway.", url: "/docs/faq", images: [{ url: "/docs/opengraph-image", width: 1200, height: 630 }] },
};

const QA: [string, string][] = [
  ["Does kedgeway send my code anywhere?", "No. It sends one fixed script to Stellar Raven, with nothing from your repo in it. The comparison happens on your machine."],
  ["Why do I have to log in?", "Live ecosystem data comes from the Stellar Raven MCP server, which requires OAuth. You log in once; the token is stored at ~/.config/kedgeway/auth.json."],
  ["Does it change my repo?", "diagnose never does. kedgeway migrate is a dry run unless you pass --write, and it refuses to write over uncommitted git changes."],
  ["Can I run it offline?", "Yes, with --fixture and a saved snapshot. See Fixtures."],
  ["Why do I get SDK_UNKNOWN?", "Either the version in your manifest cannot be read as a single major (for example an upper bound or a compound range), or the current major was unavailable. See What it scans and DATA_DEGRADED."],
  ["Does it read my lockfile?", "No. It reads the versions declared in Cargo.toml and package.json."],
  ["Which --fail-on should I use in CI?", "critical fails on deprecated SDKs and legacy packages. warning also fails on one-major-behind and unknowns. See CI."],
  ["Is it on npm?", "Not yet. npm install -g kedgeway is coming soon. Install from source for now."],
];

export default function Faq() {
  return (
    <>
      <h1>FAQ</h1>
      <dl className={styles.defs}>
        {QA.map(([q, a]) => (
          <div key={q}>
            <dt>{q}</dt>
            <dd>{a}</dd>
          </div>
        ))}
      </dl>
      <PrevNext href="/docs/faq" />
    </>
  );
}
