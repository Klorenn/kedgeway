import type { Metadata } from "next";
import Link from "next/link";
import EcosystemGrid from "@/components/EcosystemGrid";
import EngravingStrip from "@/components/EngravingStrip";
import HeroHorse from "@/components/HeroHorse";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "kedgeway: Stellar toolchain diagnosis",
  description:
    "kedgeway is a CLI that diagnoses how outdated a Stellar or Soroban repo's toolchain is, using live data from Stellar Raven.",
  alternates: { canonical: "/" },
  openGraph: { title: "kedgeway: Stellar toolchain diagnosis", description: "kedgeway is a CLI that diagnoses how outdated a Stellar or Soroban repo's toolchain is, using live data from Stellar Raven.", url: "/" },
};

const STEPS = [
  { name: "scan", lines: ["Cargo.toml", "package.json"] },
  { name: "ask raven", lines: ["Software Versions docs", "Scout toolchain index"] },
  { name: "diagnose", lines: ["findings by severity", "each with source + time"] },
] as const;

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
        <EngravingStrip variant="left" seed={3} />
        <EngravingStrip variant="right" seed={11} />
        <EngravingStrip variant="top" seed={7} />
        <div className={styles.heroInner}>
          <figure className={styles.horse}>
            <HeroHorse />
            <figcaption className={styles.plate}>Muybridge, pl. 626 — 1878</figcaption>
          </figure>
          <h1>Your Soroban SDK <em>is drifting.</em></h1>
          <p className={styles.sub}>kedgeway asks the live Stellar ecosystem what is current and tells you how far behind you are.</p>
          <div className={styles.cta}>
            <a className="btnPrimary" href="#install">kedgeway diagnose</a>
            <Link className="btnLink" href="/docs">Read the docs →</Link>
          </div>
          <p className={styles.caption}>open source · MIT · built on Stellar Raven</p>
        </div>
      </section>

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
          <ol className={styles.steps}>
            {STEPS.map((s) => (
              <li key={s.name} className={styles.step}>
                <h3>{s.name}</h3>
                {s.lines.map((l) => (
                  <p key={l}>{l}</p>
                ))}
              </li>
            ))}
          </ol>
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
        </div>
      </section>

      <section className={styles.section} id="install" aria-labelledby="install-h">
        <span className={styles.pageNo} aria-hidden="true">04/05</span>
        <div className="colWide">
          <div className={styles.head}>
            <p className="overline">04 — install</p>
            <h2 id="install-h">Install</h2>
            <p>kedgeway is not published to npm yet. Build it from source today.</p>
          </div>
          <div className={styles.install}>
            <div>
              <h3>From source</h3>
              <pre className="block">
                <code>{`git clone https://github.com/kedgeway/kedgeway.git
cd kedgeway
npm ci
npm run build
npm link`}</code>
              </pre>
            </div>
            <div>
              <h3>
                From npm <span className={styles.soon}>coming soon</span>
              </h3>
              <pre className={`block ${styles.dim}`}>
                <code>npm install -g kedgeway</code>
              </pre>
            </div>
            <div className={styles.installWide}>
              <h3>Then</h3>
              <pre className="block">
                <code>{`kedgeway login
kedgeway diagnose ./my-contract`}</code>
              </pre>
              <p className={styles.note}>
                <code>login</code> opens your browser for OAuth with Raven. The token is stored at <code>~/.config/kedgeway/auth.json</code> with mode 0600.
              </p>
            </div>
          </div>
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
