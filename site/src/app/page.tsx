import type { Metadata } from "next";
import Link from "next/link";
import CodeBlock from "@/components/CodeBlock";
import FlowDiagram from "@/components/FlowDiagram";
import HatchGroup from "@/components/HatchGroup";
import PixelIcon, { type PixelIconName } from "@/components/icons/pixel";
import Typewriter from "@/components/Typewriter";
import EcosystemGrid from "@/components/EcosystemGrid";
import HeroHorse from "@/components/HeroHorse";
import MeasureBackdrop from "@/components/MeasureBackdrop";
import { HORSE_STANDING } from "@/data/horse-hatch";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "kedgeway: Stellar toolchain diagnosis",
  description:
    "kedgeway is a CLI that diagnoses how outdated a Stellar or Soroban repo's toolchain is, using live data from Stellar Raven.",
  alternates: { canonical: "/" },
  openGraph: { title: "kedgeway: Stellar toolchain diagnosis", description: "kedgeway is a CLI that diagnoses how outdated a Stellar or Soroban repo's toolchain is, using live data from Stellar Raven.", url: "/" },
};

const CATCHES: { code: string; icon: PixelIconName; text: string }[] = [
  { code: "SDK_DEPRECATED", icon: "warning", text: "soroban-sdk is on a deprecated major, or more than one major behind." },
  { code: "JS_LEGACY_PACKAGE", icon: "file", text: "soroban-client or the unscoped stellar-sdk is still in package.json." },
  { code: "SDK_BEHIND", icon: "clock", text: "soroban-sdk is exactly one major behind the current one." },
  { code: "MANIFEST_UNPARSEABLE", icon: "file", text: "A Cargo.toml or package.json could not be parsed, so it was not checked." },
  { code: "DATA_DEGRADED", icon: "raven", text: "A data source failed. The report says so instead of guessing." },
  { code: "NO_SDK_FOUND", icon: "check", text: "No Stellar SDK dependency was found in the scanned path." },
];

const WORKS_WITH: { label: string; icon: PixelIconName }[] = [
  { label: "Cargo.toml", icon: "crate" },
  { label: "package.json", icon: "npm-cube" },
  { label: "GitHub Actions", icon: "actions" },
  { label: "Stellar Raven", icon: "stellar-star" },
  { label: "Soroban", icon: "soroban-hex" },
];

const FAQ: [string, string][] = [
  ["Does my code leave my machine?", "No. kedgeway sends one fixed script to Stellar Raven, with nothing from your repo in it. The comparison runs on your machine."],
  ["Do I need an account?", "You sign in to Stellar Raven once with OAuth in your browser. The token is stored locally at ~/.config/kedgeway/auth.json."],
  ["Does it work offline?", "Yes, with --fixture and a saved snapshot. A live run needs network access and a Raven sign-in."],
  ["Which SDKs are detected?", "soroban-sdk in Cargo.toml, and @stellar/stellar-sdk, @stellar/stellar-base and the legacy soroban-client and stellar-sdk in package.json."],
  ["Can it fail my CI?", "Yes. --fail-on exits with code 2 when a finding meets the threshold. Live data in CI is not supported yet, so use a fixture."],
  ["When will it be on npm?", "Not yet. npm install -g kedgeway is coming soon; build from source today."],
];

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
        <div className={styles.textBlock}>
          <h1 className={styles.title}>Your Soroban SDK is drifting.</h1>
          <p className={styles.sub}>kedgeway asks the live Stellar ecosystem what is current and tells you how far behind you are.</p>
          <div className={styles.cta}>
            <Link className="btnPrimary" href="#install">Get started</Link>
            <Link className="btnLink" href="/docs">Read the docs →</Link>
          </div>
        </div>
        <figure className={styles.horseBlock}>
          <HeroHorse />
          <span className={styles.baseline} aria-hidden="true" />
          <figcaption className={styles.plate}>Muybridge, pl. 626 — 1878</figcaption>
        </figure>
      </section>

      <section className={`${styles.section} ${styles.anchor}`} aria-labelledby="eco-h">
        <div className="colWide">
          <div className={styles.ecoHead}>
            <p className={styles.big} aria-hidden="true">22%</p>
            <div className={styles.ecoBody}>
              <p className="overline">01 — the ecosystem</p>
              <h2 id="eco-h" className={styles.ecoTitle}>One in five Soroban repos is on a deprecated SDK.</h2>
              <p className={styles.ecoText}>
                Scout scanned 5,863 repos on 2026-11-11. 1,285 of them (22%) use a deprecated <code>soroban-sdk</code>. Nothing in their build tells them.
              </p>
              <EcosystemGrid />
            </div>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.light}`} aria-labelledby="how-h">
        <div className="colWide">
          <div className={styles.head}>
            <h2 id="how-h">It checks the live ecosystem, not a stale list.</h2>
            <p>
              kedgeway scans <code>Cargo.toml</code> for <code>soroban-sdk</code>, including workspace dependencies and <code>package =</code> renames, and <code>package.json</code> for <code>@stellar/stellar-sdk</code>, <code>@stellar/stellar-base</code>, and the legacy <code>soroban-client</code> and <code>stellar-sdk</code>. Then it asks Stellar Raven. If a source fails, the report says <code>DATA_DEGRADED</code> instead of guessing.
            </p>
          </div>
          <FlowDiagram />
          <ul className={styles.works} aria-label="Works with">
            {WORKS_WITH.map((w) => (
              <li key={w.label}>
                <PixelIcon name={w.icon} size={32} />
                <span>{w.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={`${styles.section} ${styles.anchor}`} aria-labelledby="report-h">
        <div className="colWide">
          <div className={styles.head}>
            <p className="overline">02 — the report</p>
            <h2 id="report-h">A report you can act on.</h2>
            <p>
              Findings are sorted by severity, point at the file, and say what to do. Every finding cites its source and observation time. Use <code>--json</code> for machines and <code>--fail-on</code> for CI.
            </p>
          </div>
          <Typewriter>
            <pre className={styles.term} aria-label="Example kedgeway report">
              <code>
                <span className={styles.strong}>$ kedgeway diagnose ./my-contract</span>
                {`
kedgeway: ./my-contract
Ecosystem: soroban-sdk current major 28, observed 2026-11-11T22:00:57Z

`}
                <span className={styles.strong}>[CRITICAL]</span>
                {` SDK_DEPRECATED  `}
                <span className={styles.strong}>contracts/hello/Cargo.toml</span>
                {`
  soroban-sdk 21.0.0 is on a major listed as deprecated (current: 28). Upgrade.
`}
                <span className={styles.strong}>[CRITICAL]</span>
                {` JS_LEGACY_PACKAGE  `}
                <span className={styles.strong}>package.json</span>
                {`
  soroban-client 1.0.0 is a legacy package; replace it with @stellar/stellar-sdk.

Summary: 2 critical, 0 warning, 0 info`}
              </code>
            </pre>
          </Typewriter>
        </div>
      </section>

      <section className={`${styles.section} ${styles.light}`} aria-labelledby="catch-h">
        <div className="colWide">
          <div className={styles.head}>
            <h2 id="catch-h">Six things it tells you, with evidence.</h2>
            <p>Each finding names the file, cites its source and the time it was observed, and says what to do.</p>
          </div>
          <ul className={styles.catches}>
            {CATCHES.map((c) => (
              <li key={c.code} className={styles.catchItem}>
                <PixelIcon name={c.icon} size={24} />
                <code className={styles.catchCode}>{c.code}</code>
                <p>{c.text}</p>
              </li>
            ))}
          </ul>
          <p className={styles.moreLink}>
            <Link href="/docs/findings">All 12 finding codes →</Link>
          </p>
        </div>
      </section>

      <section className={`${styles.section} ${styles.anchor}`} id="install" aria-labelledby="install-h">
        <div className="colWide">
          <div className={styles.head}>
            <p className="overline">03 — install</p>
            <h2 id="install-h">Install</h2>
            <p>kedgeway is not published to npm yet. Build it from source, sign in to Raven, then diagnose a repo.</p>
          </div>
          <div className={styles.installBlock}>
            <CodeBlock
              code={`# 1. Build from source
git clone https://github.com/Klorenn/kedgeway
cd kedgeway
npm ci
npm run build
npm link

# 2. Sign in to Raven (opens your browser)
kedgeway login

# 3. Diagnose
kedgeway diagnose ./my-contract --fail-on warning`}
            />
            <p className={styles.stepNote}>
              The token is stored at <code>~/.config/kedgeway/auth.json</code> with mode 0600. <code>--fail-on warning</code> exits with code 2 if any finding is a warning or worse.
            </p>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.light}`} aria-labelledby="faq-h">
        <div className="colWide">
          <div className={styles.head}>
            <h2 id="faq-h">Questions people ask first.</h2>
          </div>
          <div className={styles.faq}>
            {FAQ.map(([q, a]) => (
              <details key={q} className={styles.faqItem}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.light}`} aria-labelledby="road-h">
        <div className="colWide">
          <div className={styles.head}>
            <h2 id="road-h">Roadmap</h2>
            <p>None of this has shipped. It is what we intend to build.</p>
          </div>
          <ul className={styles.road}>
            {ROADMAP.map(([name, what]) => (
              <li key={name}>
                <h3>{name}</h3>
                <p>{what}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.cta2} aria-labelledby="cta-h">
        <div className="col">
          <svg width="160" height="95" viewBox="-6 6 160 95" role="img" aria-label="A horse standing still" className={styles.ctaHorse}>
            <HatchGroup frame={0} rows={HORSE_STANDING} color="var(--ink)" trails={false} />
          </svg>
          <h2 id="cta-h" className={styles.ctaTitle}>Stop drifting.</h2>
          <p className={styles.ctaSub}>Diagnose your repo in under a minute.</p>
          <div className={styles.cta}>
            <Link className="btnPrimary" href="#install">Get started</Link>
            <Link className="btnLink" href="/docs">Read the docs →</Link>
          </div>
          <div className={styles.ctaCode}>
            <CodeBlock code="git clone https://github.com/Klorenn/kedgeway" />
          </div>
        </div>
      </section>
    </>
  );
}
