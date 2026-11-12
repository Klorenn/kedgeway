import type { Metadata } from "next";
import CodeBlock from "@/components/CodeBlock";
import Faq from "@/components/Faq";
import DitherClouds from "@/components/DitherClouds";
import HeroPlate from "@/components/landing/HeroPlate";
import HeroReady from "@/components/landing/HeroReady";
import AsciiBlock from "@/components/ui/AsciiBlock";
import AsciiRule from "@/components/ui/AsciiRule";
import Button from "@/components/ui/Button";
import { CardStat, CardStep, CardWay } from "@/components/ui/Cards";
import LazyDesignFigure from "@/components/ui/LazyDesignFigure";
import {
  findingsDesktop,
  findingsMobile,
  gallopDesktop,
  gallopDesktopLead,
  gallopMobile,
  gallopMobileLead,
  statsDesktop,
  statsMobile,
  terminalDesktop,
  terminalMobile,
} from "@/generated/ascii.generated";
import styles from "./page.module.css";

export const metadata: Metadata = { alternates: { canonical: "/" } };

const STATS_ROWS = [
  ["deprecated", "1,285", "22.0%"],
  ["current", "197", "3.4%"],
  ["supported", "4,330", "73.9%"],
  ["unknown", "51", "0.9%"],
] as const;

const FINDINGS = [
  ["SDK_DEPRECATED", "critical", "soroban-sdk is on a deprecated major, or more than one major behind."],
  ["JS_LEGACY_PACKAGE", "critical", "soroban-client or the unscoped stellar-sdk is still in package.json."],
  ["SDK_BEHIND", "warning", "soroban-sdk is exactly one major behind the current one."],
  ["MANIFEST_UNPARSEABLE", "warning", "A Cargo.toml, package.json, or directory could not be read, so it was not checked."],
  ["DATA_DEGRADED", "warning", "A data source failed. The report says so instead of guessing."],
  ["NO_SDK_FOUND", "info", "No Stellar SDK dependency was found in the scanned path."],
] as const;

const WORKS_WITH = ["Cargo.toml", "package.json", "GitHub Actions", "Stellar Raven", "Soroban"];

const FAQ: [string, string][] = [
  ["Does my code leave my machine?", "No. kedgeway sends one fixed script to Stellar Raven, with nothing from your repo in it. The comparison runs on your machine."],
  ["Do I need an account?", "You sign in to Stellar Raven once with OAuth in your browser. The token is stored locally at ~/.config/kedgeway/auth.json."],
  ["Does it work offline?", "Yes. --offline reuses the cached Raven snapshot from your last live run, and --fixture uses a snapshot file. A first live run needs network access and a Raven sign-in."],
  ["Which SDKs are detected?", "soroban-sdk in Cargo.toml, and @stellar/stellar-sdk, @stellar/stellar-base and the legacy soroban-client and stellar-sdk in package.json."],
  ["Can it fail my CI?", "Yes. --fail-on exits with code 2 when a finding meets the threshold. For live data in CI set the KEDGEWAY_AUTH secret; or use a fixture."],
  ["How do I install it?", "npm install -g kedgeway. It needs Node 22.12 or newer."],
];

const WAYS = [
  ["TypeScript SDK", "Call diagnose and migrate from your own code.", "/docs/sdk"],
  ["MCP server", "kedgeway mcp lets AI assistants diagnose a repo.", "/docs/mcp"],
  ["GitHub Action", "Fail a pull request on drift, with a fixture or a Raven secret.", "/docs/github-action"],
  ["Migration mode", "Published version, protocol, and the lines to edit. Dry run by default.", "/docs/migrate"],
] as const;

const INSTALL = `# 1. Install
npm install -g kedgeway

# 2. Sign in to Raven (opens your browser)
kedgeway login

# 3. Diagnose
kedgeway diagnose ./my-contract --fail-on warning`;

export default function Home() {
  return (
    <>
      {/* Hero stage: clipped, full bleed. The sky sits behind it (Phase C moves the clouds in here). */}
      <section className={styles.stage} aria-labelledby="hero-h">
        <HeroReady />
        <DitherClouds />
        <div className={`container ${styles.hero}`}>
          <div className={styles.copy}>
            <p className={`t-overline ${styles.rise}`} style={{ ["--i" as string]: 0 }}>Stellar toolchain diagnosis</p>
            <h1 id="hero-h" className={`t-hero ${styles.title} ${styles.rise}`} style={{ ["--i" as string]: 1 }}>Your Soroban SDK is drifting.</h1>
            <p className={`t-body ${styles.sub} ${styles.rise}`} style={{ ["--i" as string]: 2 }}>kedgeway asks the live Stellar ecosystem what is current and tells you how far behind you are.</p>
            <div className={`${styles.actions} ${styles.rise}`} style={{ ["--i" as string]: 3 }}>
              <Button variant="primary" href="#install">Get started</Button>
              <Button variant="link" href="/docs">Read the docs →</Button>
            </div>
            <p className={`t-body-small ${styles.proof} ${styles.rise}`} style={{ ["--i" as string]: 4 }}>
              <b>1,285 Soroban repos</b> are on a deprecated SDK today. Scout via Raven, 2026-11-11.
            </p>
          </div>
        </div>
        <div className={styles.rise} style={{ ["--i" as string]: 5 }}>
          <HeroPlate />
        </div>
      </section>

      <section className={`section ${styles.solid}`} aria-labelledby="eco-h">
        <div className={`container section-stack`}>
          <AsciiRule label="01 — The ecosystem" as="p" />
          <div className={`grid ${styles.eco}`}>
            <div className={styles.block}>
              <h2 id="eco-h" className="t-heading">One in five Soroban repos <span className="line2">runs a deprecated SDK.</span></h2>
              <p className="t-body">
                Scout scanned 5,863 repos on 2026-11-11. 1,285 of them (22%) use a deprecated <code>soroban-sdk</code>. Nothing in their build tells them.
              </p>
            </div>
            <div className={styles.distribution}>
              <p className={`t-mono-label ${styles.chartTitle}`}>5,863 Soroban repos by soroban-sdk status</p>
              <LazyDesignFigure name="fig2" fig="fig. 2" caption="one cell ≈ 15 repos · 391 cells" description="A dot-matrix field of about 391 cells, each roughly 15 repos. Deprecated cells are dense, current cells lighter, supported cells sparse." />
              <AsciiBlock label="Ecosystem status table" desktop={statsDesktop} mobile={statsMobile} desktopMin={588} emphasis={/(#+|\bdeprecated\b(?= +\| +1,285))/.source}>
                <table>
                  <caption>soroban-sdk status of 5,863 repos</caption>
                  <thead><tr><th>status</th><th>repos</th><th>share</th></tr></thead>
                  <tbody>
                    {STATS_ROWS.map(([s, n, p]) => (
                      <tr key={s}><th scope="row">{s}</th><td>{n}</td><td>{p}</td></tr>
                    ))}
                  </tbody>
                </table>
              </AsciiBlock>
              <p className={`t-mono-label ${styles.source}`}>Source: Stellar Raven / Scout · 2026-11-11</p>
            </div>
          </div>
          <dl className={styles.stats}>
            <CardStat value="5,863" label="repos scanned" />
            <CardStat value="1,285" label="deprecated" />
            <CardStat value="22%" label="of the ecosystem" />
            <CardStat value="28" label="current soroban-sdk major" />
          </dl>
        </div>
      </section>

      <section className={`section band`} aria-labelledby="how-h">
        <div className="container section-stack">
          <AsciiRule label="02 — How it works" as="p" />
          <div className={`grid ${styles.how}`}>
            <div className={styles.block}>
              <h2 id="how-h" className="t-heading">Checked against the live ecosystem. <span className="line2">Never a stale list.</span></h2>
              <p className="t-body">
                kedgeway scans <code>Cargo.toml</code> for <code>soroban-sdk</code>, including workspace dependencies and <code>package =</code> renames, and <code>package.json</code> for <code>@stellar/stellar-sdk</code>, <code>@stellar/stellar-base</code>, and the legacy <code>soroban-client</code> and <code>stellar-sdk</code>. Then it asks Stellar Raven. If a source fails, the report says <code>DATA_DEGRADED</code> instead of guessing.
              </p>
            </div>
            <LazyDesignFigure name="fig3" fig="fig. 3" caption="manifests → kedgeway → Stellar Raven → report" description="Four steps left to right: manifests, kedgeway, Stellar Raven, report." />
          </div>
          <div className={styles.steps}>
            <CardStep step={1} title="scan">Cargo.toml / package.json</CardStep>
            <CardStep step={2} title="ask raven">Software Versions + Scout</CardStep>
            <CardStep step={3} title="diagnose">report · source + time</CardStep>
          </div>
          <div className={styles.works}>
            <p className="t-overline">Works with</p>
            <ul className={`t-mono-label ${styles.worksList}`} aria-label="Works with">
              {WORKS_WITH.map((w) => <li key={w}>{w}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <section className={`section ${styles.solid}`} aria-labelledby="report-h">
        <div className="container section-stack">
          <AsciiRule label="03 — The report" as="p" />
          <div className={`grid ${styles.report}`}>
            <div className={styles.reportLeft}>
              <div className={styles.block}>
                <h2 id="report-h" className="t-heading">A report you can act on. <span className="line2">Every line cites its source.</span></h2>
                <p className="t-body">
                  Findings are sorted by severity, point at the file, and say what to do. Every finding cites its source and observation time. Use <code>--json</code> for machines and <code>--fail-on</code> for CI.
                </p>
              </div>
              <LazyDesignFigure name="fig4" fig="fig. 4" caption="one finding, read left to right" description="One finding annotated left to right: severity, code, file, source." className={styles.figPad} />
            </div>
            <AsciiBlock
              label="Example report"
              panel
              desktop={terminalDesktop}
              mobile={terminalMobile}
              desktopMin={687}
              emphasis={/(\[CRITICAL\]|\[WARNING\]|\[INFO\]|\b[A-Z]{2,}(?:_[A-Z]+)+\b|#+)/.source}
            >
              <p>Example report for ./my-contract. Ecosystem: soroban-sdk current major 28, observed 2026-11-11T22:00:57Z, source Stellar Raven and Scout.</p>
              <ul>
                <li>Critical, SDK_DEPRECATED, contracts/hello/Cargo.toml: soroban-sdk 21.0.0 is on a major listed as deprecated (current: 28). Upgrade.</li>
                <li>Critical, JS_LEGACY_PACKAGE, package.json: soroban-client 1.0.0 is a legacy package; replace it with @stellar/stellar-sdk.</li>
              </ul>
              <p>Summary: 2 critical, 0 warning, 0 info.</p>
            </AsciiBlock>
          </div>
        </div>
      </section>

      <section className={`section band`} aria-labelledby="findings-h">
        <div className="container section-stack">
          <AsciiRule label="04 — Findings" as="p" />
          <div className={`grid ${styles.findings}`}>
            <div className={styles.block}>
              <h2 id="findings-h" className="t-heading">What it catches. <span className="line2">Twelve codes, three severities.</span></h2>
              <p className="t-body">Each finding names the file, cites its source and the time it was observed, and says what to do.</p>
            </div>
            <LazyDesignFigure name="fig5" fig="fig. 5" caption="hatch density = severity" description="Three severities from critical to info, drawn with decreasing hatch density." />
          </div>
          <AsciiBlock
            label="Findings table"
            desktop={findingsDesktop}
            mobile={findingsMobile}
            desktopMin={1193}
            emphasis={/(\b[A-Z]{2,}(?:_[A-Z]+)+\b|\b(?:critical|warning|info)\b(?= +\|))/.source}
          >
            <table>
              <caption>Six of the twelve finding codes</caption>
              <thead><tr><th>code</th><th>severity</th><th>what it means</th></tr></thead>
              <tbody>
                {FINDINGS.map(([code, sev, text]) => (
                  <tr key={code}><th scope="row">{code}</th><td>{sev}</td><td>{text}</td></tr>
                ))}
              </tbody>
            </table>
          </AsciiBlock>
          <div>
            <Button variant="link" href="/docs/findings">All 12 finding codes →</Button>
          </div>
        </div>
      </section>

      <section className={`section ${styles.solid}`} id="install" aria-labelledby="install-h">
        <div className="container section-stack">
          <AsciiRule label="05 — Install" as="p" />
          <div className={`grid ${styles.install}`}>
            <div className={styles.reportLeft}>
              <div className={styles.block}>
                <h2 id="install-h" className="t-heading">Install in a minute. <span className="line2">Then sign in to Raven.</span></h2>
                <p className="t-body">Node 22.12 or newer. Install the CLI, sign in to Raven, then diagnose a repo.</p>
                <p className="t-body-small">
                  The token is stored at <code>~/.config/kedgeway/auth.json</code> with mode 0600. <code>--fail-on warning</code> exits with code 2 if any finding is a warning or worse.
                </p>
              </div>
              <LazyDesignFigure name="fig6" fig="fig. 6" caption="install, sign in, diagnose" description="Three commands in order: npm install, login, diagnose." className={styles.figPad} />
            </div>
            <div className={styles.codeCol}>
              <CodeBlock label="Terminal" code={INSTALL} />
            </div>
          </div>
        </div>
      </section>

      <section className={`section ${styles.solid}`} id="faq" aria-labelledby="faq-h">
        <div className="container section-stack">
          <AsciiRule label="06 — FAQ" as="p" />
          <div className={`grid ${styles.faq}`}>
            <div className={styles.reportLeft}>
              <h2 id="faq-h" className="t-heading">Questions, answered. <span className="line2">Short, no marketing.</span></h2>
              <LazyDesignFigure name="fig7" fig="fig. 7" caption="cumulus, 4×4 ordered dither" description="A study of dithered cumulus cloud." className={styles.figPadLg} />
            </div>
            <Faq items={FAQ} />
          </div>
        </div>
      </section>

      <section className={`section ${styles.solid}`} aria-labelledby="ways-h">
        <div className="container section-stack">
          <AsciiRule label="07 — Integrations" as="p" />
          <div className={`grid ${styles.ways}`}>
            <h2 id="ways-h" className="t-heading">Not a roadmap anymore. <span className="line2">Four ways to run it.</span></h2>
            <LazyDesignFigure name="fig8" fig="fig. 8" caption="one core, four ways to run it" description="One core feeding four ways to run it: SDK, MCP, Action, Migrate." />
          </div>
          <div className={styles.wayCards}>
            {WAYS.map(([title, text, href]) => (
              <CardWay key={title} href={href} title={title}>{text}</CardWay>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.cta} ${styles.solid}`} aria-labelledby="cta-h">
        <div className={`container ${styles.ctaInner}`}>
          <div className={styles.gallop}>
            <AsciiBlock decorative className={styles.gallopBlock} art desktop={gallopDesktop} mobile={gallopMobile} desktopLead={gallopDesktopLead} mobileLead={gallopMobileLead} desktopMin={479} emphasis={/([#%@]+)/.source} />
            <p className={`t-mono-label ${styles.gallopCaption}`}><span>fig. 9</span><span>frame 05, set in type</span></p>
          </div>
          <h2 id="cta-h" className={`t-hero ${styles.ctaTitle}`}>Stop drifting. <span className="line2">Diagnose, then migrate.</span></h2>
          <div className={styles.actions}>
            <Button variant="primary" href="#install">Get started</Button>
            <Button variant="link" href="/docs">Read the docs →</Button>
          </div>
          <div className={styles.clone}>
            <CodeBlock label="Install" code="npm install -g kedgeway" />
          </div>
        </div>
      </section>
    </>
  );
}
