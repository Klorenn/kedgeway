import type { Metadata } from "next";
import Link from "next/link";
import CodeBlock from "@/components/CodeBlock";
import FlowDiagram from "@/components/FlowDiagram";
import Typewriter from "@/components/Typewriter";
import EcosystemGrid from "@/components/EcosystemGrid";
import EngravingStrip from "@/components/EngravingStrip";
import HeroHorse from "@/components/HeroHorse";
import MeasureBackdrop from "@/components/MeasureBackdrop";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "kedgeway: Stellar toolchain diagnosis",
  description:
    "kedgeway is a CLI that diagnoses how outdated a Stellar or Soroban repo's toolchain is, using live data from Stellar Raven.",
  alternates: { canonical: "/" },
  openGraph: { title: "kedgeway: Stellar toolchain diagnosis", description: "kedgeway is a CLI that diagnoses how outdated a Stellar or Soroban repo's toolchain is, using live data from Stellar Raven.", url: "/" },
};

const ROADMAP = [
  ["MCP server", "Lets coding agents call diagnose directly."],
  ["TypeScript SDK", "Run diagnoses from your own tooling."],
  ["Migration mode", "Opens a PR with the upgrade already applied."],
  ["GitHub Action", "Checks every pull request for drift."],
] as const;

export default function Home() {
  return (
    <>
      <section className={styles.hero}>
        <MeasureBackdrop anchor="[data-hero-horse]" />
        <EngravingStrip variant="left" seed={3} />
        <EngravingStrip variant="right" seed={11} />
        <div className={styles.textBlock}>
          <h1 className={styles.title}>Your Soroban SDK is drifting.</h1>
          <p className={styles.sub}>kedgeway asks the live Stellar ecosystem what is current and tells you how far behind you are.</p>
          <div className={styles.cta}>
            <Link className="btnPrimary" href="#install">kedgeway diagnose</Link>
            <Link className="btnLink" href="/docs">Read the docs →</Link>
          </div>
          <p className={styles.caption}>open source · MIT · built on Stellar Raven</p>
        </div>
        <figure className={styles.horseBlock}>
          <figcaption className={styles.plate}>Muybridge, pl. 626 — 1878</figcaption>
          <HeroHorse />
        </figure>
      </section>

      <div className={styles.ticker} role="note" aria-label="Key figures">
        <span>5,863 repos scanned</span>
        <span aria-hidden="true">·</span>
        <span>1,285 deprecated (22%)</span>
        <span aria-hidden="true">·</span>
        <span>current soroban-sdk 28</span>
        <span aria-hidden="true">·</span>
        <span>observed 2026-11-11</span>
      </div>

      <section className={styles.section} aria-labelledby="eco-h">
        <span className={styles.pageNo} aria-hidden="true">01/05</span>
        <div className="colWide">
          <div className={styles.ecoHead}>
            <p className={styles.big} aria-hidden="true">22%</p>
            <div className={styles.text}>
              <p className="overline">01 — the ecosystem</p>
              <h2 id="eco-h">One in five Soroban repos <em>is on a deprecated SDK.</em></h2>
              <p>
                Scout scanned 5,863 repos on 2026-11-11. 1,285 of them (22%) use a deprecated <code>soroban-sdk</code>. Nothing in their build tells them.
              </p>
            </div>
          </div>
          <EcosystemGrid />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="how-h">
        <span className={styles.pageNo} aria-hidden="true">02/05</span>
        <div className="colWide">
          <div className={styles.head}>
            <p className="overline">02 — how it works</p>
            <h2 id="how-h">It checks the <em>live</em> ecosystem, not a stale list.</h2>
            <p>
              kedgeway scans <code>Cargo.toml</code> for <code>soroban-sdk</code>, including workspace dependencies and <code>package =</code> renames, and <code>package.json</code> for <code>@stellar/stellar-sdk</code>, <code>@stellar/stellar-base</code>, and the legacy <code>soroban-client</code> and <code>stellar-sdk</code>. Then it asks Stellar Raven. If a source fails, the report says <code>DATA_DEGRADED</code> instead of guessing.
            </p>
          </div>
          <FlowDiagram />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="report-h">
        <span className={styles.pageNo} aria-hidden="true">03/05</span>
        <div className="col">
          <div className={styles.head}>
            <p className="overline">03 — the report</p>
            <h2 id="report-h">A report you can <em>act on.</em></h2>
            <p>
              Findings are sorted by severity, point at the file, and say what to do. Every finding cites its source and observation time. Use <code>--json</code> for machines and <code>--fail-on</code> for CI.
            </p>
          </div>
          <Typewriter>
          <pre className={styles.term} aria-label="Example kedgeway report">
            <code>
              <span className={styles.tag}>$ kedgeway diagnose ./my-contract</span>
              {`
kedgeway: ./my-contract
Ecosystem: soroban-sdk current major 28, observed 2026-11-11T22:00:57Z

`}
              <span className={styles.tag}>[CRITICAL]</span>
              {` SDK_DEPRECATED  contracts/hello/Cargo.toml
  soroban-sdk 21.0.0 is on a major listed as deprecated (current: 28). Upgrade.
`}
              <span className={styles.tag}>[CRITICAL]</span>
              {` JS_LEGACY_PACKAGE  package.json
  soroban-client 1.0.0 is a legacy package; replace it with @stellar/stellar-sdk.

Summary: 2 critical, 0 warning, 0 info`}
            </code>
          </pre>
          </Typewriter>
        </div>
      </section>

      <section className={styles.section} id="install" aria-labelledby="install-h">
        <span className={styles.pageNo} aria-hidden="true">04/05</span>
        <div className="col">
          <div className={styles.head}>
            <p className="overline">04 — install</p>
            <h2 id="install-h">Install</h2>
            <p>Build kedgeway from source, sign in to Raven, then diagnose a repo.</p>
          </div>
          <ol className={styles.steps4}>
            <li>
              <p className="overline">01 — Build from source</p>
              <CodeBlock code={`git clone https://github.com/Klorenn/kedgeway
cd kedgeway
npm ci
npm run build
npm link`} />
            </li>
            <li>
              <p className="overline">02 — Sign in to Raven</p>
              <CodeBlock code="kedgeway login" />
              <p className={styles.stepNote}>
                <code>login</code> opens your browser for OAuth with Raven. The token is stored at <code>~/.config/kedgeway/auth.json</code> with mode 0600.
              </p>
            </li>
            <li>
              <p className="overline">03 — Diagnose</p>
              <CodeBlock code="kedgeway diagnose ./my-contract --fail-on warning" />
              <p className={styles.stepNote}>Exits with code 2 if any finding is a warning or worse.</p>
            </li>
          </ol>
          <p className={styles.npmSoon}>From npm — coming soon</p>
          <p className={styles.npmLine} aria-label="Not available yet">npm install -g kedgeway</p>
          <p className={styles.kedge}>
            A kedge is a small anchor carried out from a drifting ship and hauled in to pull it back on course. kedgeway pulls a repo&apos;s SDK versions back on course.
          </p>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="road-h">
        <span className={styles.pageNo} aria-hidden="true">05/05</span>
        <div className="col">
          <div className={styles.head}>
            <p className="overline">05 — roadmap</p>
            <h2 id="road-h">Roadmap</h2>
            <p>None of this has shipped. It is what we intend to build.</p>
          </div>
          <ul className={styles.road}>
            {ROADMAP.map(([name, what]) => (
              <li key={name}>
                <h3>{name}</h3>
                <p>{what}</p>
                <span className={styles.status}>roadmap</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
