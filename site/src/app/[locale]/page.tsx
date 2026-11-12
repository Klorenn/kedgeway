import type { Metadata } from "next";
import { byLocale } from "@/i18n/config";
import { href } from "@/i18n/href";
import { localeOf } from "@/i18n/server";
import { pageMeta } from "@/lib/seo";
import { UI } from "@/content/ui";
import type { EcoStatus, LandingFaqId, LandingFindingCode, WayId } from "@/content/schema/landing";
import en from "@/content/en/landing";
import es from "@/content/es/landing";
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

const DICT = { en, es };

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const locale = await localeOf(params);
  const { title, description, ogTitle, ogDescription } = DICT[locale].meta;
  return pageMeta({ locale, path: "/", title, description, ogTitle, ogDescription, ogAlt: UI[locale].ogAlt });
}

// Data (numbers, codes, severities) is the same in every locale; prose comes from the dictionary.
const STATS_ROWS: readonly (readonly [EcoStatus, string, string])[] = [
  ["deprecated", "1,285", "22.0%"],
  ["current", "197", "3.4%"],
  ["supported", "4,330", "73.9%"],
  ["unknown", "51", "0.9%"],
];

const FINDINGS: readonly (readonly [LandingFindingCode, string])[] = [
  ["SDK_DEPRECATED", "critical"],
  ["JS_LEGACY_PACKAGE", "critical"],
  ["SDK_BEHIND", "warning"],
  ["MANIFEST_UNPARSEABLE", "warning"],
  ["DATA_DEGRADED", "warning"],
  ["NO_SDK_FOUND", "info"],
];

const WORKS_WITH = ["Cargo.toml", "package.json", "GitHub Actions", "Stellar Raven", "Soroban"];

const FAQ_ORDER: readonly LandingFaqId[] = ["privacy", "account", "offline", "sdks", "ci", "install"];

const WAYS: readonly (readonly [WayId, string])[] = [
  ["sdk", "/docs/sdk"],
  ["mcp", "/docs/mcp"],
  ["action", "/docs/github-action"],
  ["migrate", "/docs/migrate"],
];

const INSTALL = `# 1. Install
npm install -g kedgeway

# 2. Sign in to Raven (opens your browser)
kedgeway login

# 3. Diagnose
kedgeway diagnose ./my-contract --fail-on warning

# Or scan a remote repository
kedgeway diagnose https://github.com/o/r`;

export default async function Home({ params }: PageProps<"/[locale]">) {
  const locale = await localeOf(params);
  const t = byLocale(locale, DICT);
  const to = (path: string): string => href(locale, path);
  return (
    <>
      {/* Hero stage: clipped, full bleed. The sky sits behind it (Phase C moves the clouds in here). */}
      <section className={styles.stage} aria-labelledby="hero-h">
        <HeroReady />
        <DitherClouds />
        <div className={`container ${styles.hero}`}>
          <div className={styles.copy}>
            <p className={`t-overline ${styles.rise}`} style={{ ["--i" as string]: 0 }}>{t.hero.overline}</p>
            <h1 id="hero-h" className={`t-hero ${styles.title} ${styles.rise}`} style={{ ["--i" as string]: 1 }}>{t.hero.title}</h1>
            <p className={`t-body ${styles.sub} ${styles.rise}`} style={{ ["--i" as string]: 2 }}>{t.hero.sub}</p>
            <div className={`${styles.actions} ${styles.rise}`} style={{ ["--i" as string]: 3 }}>
              <Button variant="primary" href="#install">{t.hero.cta}</Button>
              <Button variant="link" href={to("/docs")}>{t.hero.docs}</Button>
            </div>
            <p className={`t-body-small ${styles.proof} ${styles.rise}`} style={{ ["--i" as string]: 4 }}>
              <b>{t.hero.proofStrong}</b>{t.hero.proofRest}
            </p>
          </div>
        </div>
        <div className={styles.rise} style={{ ["--i" as string]: 5 }}>
          <HeroPlate />
        </div>
      </section>

      <section className={`section ${styles.solid}`} aria-labelledby="eco-h">
        <div className={`container section-stack`}>
          <AsciiRule label={t.eco.rule} as="p" />
          <div className={`grid ${styles.eco}`}>
            <div className={styles.block}>
              <h2 id="eco-h" className="t-heading">{t.eco.h} <span className="line2">{t.eco.h2}</span></h2>
              <p className="t-body">{t.eco.body}</p>
            </div>
            <div className={styles.distribution}>
              <p className={`t-mono-label ${styles.chartTitle}`}>{t.eco.chartTitle}</p>
              <LazyDesignFigure name="fig2" fig="fig. 2" caption={t.eco.fig2.caption} description={t.eco.fig2.description} />
              <AsciiBlock label={t.eco.tableLabel} desktop={statsDesktop} mobile={statsMobile} desktopMin={588} emphasis={/(#+|\bdeprecated\b(?= +\| +1,285))/.source}>
                <table>
                  <caption>{t.eco.tableCaption}</caption>
                  <thead><tr><th>{t.eco.colStatus}</th><th>{t.eco.colRepos}</th><th>{t.eco.colShare}</th></tr></thead>
                  <tbody>
                    {STATS_ROWS.map(([s, n, p]) => (
                      <tr key={s}><th scope="row">{t.eco.status[s]}</th><td>{n}</td><td>{p}</td></tr>
                    ))}
                  </tbody>
                </table>
              </AsciiBlock>
              <p className={`t-mono-label ${styles.source}`}>{t.eco.source}</p>
            </div>
          </div>
          <dl className={styles.stats}>
            <CardStat value="5,863" label={t.eco.stats.scanned} />
            <CardStat value="1,285" label={t.eco.stats.deprecated} />
            <CardStat value="22%" label={t.eco.stats.share} />
            <CardStat value="28" label={t.eco.stats.major} />
          </dl>
        </div>
      </section>

      <section className={`section band`} aria-labelledby="how-h">
        <div className="container section-stack">
          <AsciiRule label={t.how.rule} as="p" />
          <div className={`grid ${styles.how}`}>
            <div className={styles.block}>
              <h2 id="how-h" className="t-heading">{t.how.h} <span className="line2">{t.how.h2}</span></h2>
              <p className="t-body">{t.how.body}</p>
            </div>
            <LazyDesignFigure name="fig3" fig="fig. 3" caption={t.how.fig3.caption} description={t.how.fig3.description} />
          </div>
          <div className={styles.steps}>
            <CardStep step={1} title={t.how.steps.scan[0]}>{t.how.steps.scan[1]}</CardStep>
            <CardStep step={2} title={t.how.steps.ask[0]}>{t.how.steps.ask[1]}</CardStep>
            <CardStep step={3} title={t.how.steps.diagnose[0]}>{t.how.steps.diagnose[1]}</CardStep>
          </div>
          <div className={styles.works}>
            <p className="t-overline">{t.how.worksWith}</p>
            <ul className={`t-mono-label ${styles.worksList}`} aria-label={t.how.worksWith}>
              {WORKS_WITH.map((w) => <li key={w}>{w}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <section className={`section ${styles.solid}`} aria-labelledby="report-h">
        <div className="container section-stack">
          <AsciiRule label={t.report.rule} as="p" />
          <div className={`grid ${styles.report}`}>
            <div className={styles.reportLeft}>
              <div className={styles.block}>
                <h2 id="report-h" className="t-heading">{t.report.h} <span className="line2">{t.report.h2}</span></h2>
                <p className="t-body">{t.report.body}</p>
              </div>
              <LazyDesignFigure name="fig4" fig="fig. 4" caption={t.report.fig4.caption} description={t.report.fig4.description} className={styles.figPad} />
            </div>
            <AsciiBlock
              label={t.report.blockLabel}
              panel
              desktop={terminalDesktop}
              mobile={terminalMobile}
              desktopMin={687}
              emphasis={/(\[CRITICAL\]|\[WARNING\]|\[INFO\]|\b[A-Z]{2,}(?:_[A-Z]+)+\b|#+)/.source}
            >
              <p>{t.report.srIntro}</p>
              <ul>
                <li>{t.report.srCritical1}</li>
                <li>{t.report.srCritical2}</li>
              </ul>
              <p>{t.report.srSummary}</p>
            </AsciiBlock>
          </div>
        </div>
      </section>

      <section className={`section band`} aria-labelledby="findings-h">
        <div className="container section-stack">
          <AsciiRule label={t.findings.rule} as="p" />
          <div className={`grid ${styles.findings}`}>
            <div className={styles.block}>
              <h2 id="findings-h" className="t-heading">{t.findings.h} <span className="line2">{t.findings.h2}</span></h2>
              <p className="t-body">{t.findings.body}</p>
            </div>
            <LazyDesignFigure name="fig5" fig="fig. 5" caption={t.findings.fig5.caption} description={t.findings.fig5.description} />
          </div>
          <AsciiBlock
            label={t.findings.blockLabel}
            desktop={findingsDesktop}
            mobile={findingsMobile}
            desktopMin={1193}
            emphasis={/(\b[A-Z]{2,}(?:_[A-Z]+)+\b|\b(?:critical|warning|info)\b(?= +\|))/.source}
          >
            <table>
              <caption>{t.findings.tableCaption}</caption>
              <thead><tr><th>{t.findings.colCode}</th><th>{t.findings.colSeverity}</th><th>{t.findings.colMeaning}</th></tr></thead>
              <tbody>
                {FINDINGS.map(([code, sev]) => (
                  <tr key={code}><th scope="row">{code}</th><td>{sev}</td><td>{t.findings.rows[code]}</td></tr>
                ))}
              </tbody>
            </table>
          </AsciiBlock>
          <div>
            <Button variant="link" href={to("/docs/findings")}>{t.findings.all}</Button>
          </div>
        </div>
      </section>

      <section className={`section ${styles.solid}`} id="install" aria-labelledby="install-h">
        <div className="container section-stack">
          <AsciiRule label={t.install.rule} as="p" />
          <div className={`grid ${styles.install}`}>
            <div className={styles.reportLeft}>
              <div className={styles.block}>
                <h2 id="install-h" className="t-heading">{t.install.h} <span className="line2">{t.install.h2}</span></h2>
                <p className="t-body">{t.install.body}</p>
                <p className="t-body-small">{t.install.note}</p>
              </div>
              <LazyDesignFigure name="fig6" fig="fig. 6" caption={t.install.fig6.caption} description={t.install.fig6.description} className={styles.figPad} />
            </div>
            <div className={styles.codeCol}>
              <CodeBlock label={t.install.codeLabel} code={INSTALL} />
            </div>
          </div>
        </div>
      </section>

      <section className={`section ${styles.solid}`} id="faq" aria-labelledby="faq-h">
        <div className="container section-stack">
          <AsciiRule label={t.faq.rule} as="p" />
          <div className={`grid ${styles.faq}`}>
            <div className={styles.reportLeft}>
              <h2 id="faq-h" className="t-heading">{t.faq.h} <span className="line2">{t.faq.h2}</span></h2>
              <LazyDesignFigure name="fig7" fig="fig. 7" caption={t.faq.fig7.caption} description={t.faq.fig7.description} className={styles.figPadLg} />
            </div>
            <Faq items={FAQ_ORDER.map((id) => t.faq.items[id])} />
          </div>
        </div>
      </section>

      <section className={`section ${styles.solid}`} aria-labelledby="ways-h">
        <div className="container section-stack">
          <AsciiRule label={t.ways.rule} as="p" />
          <div className={`grid ${styles.ways}`}>
            <h2 id="ways-h" className="t-heading">{t.ways.h} <span className="line2">{t.ways.h2}</span></h2>
            <LazyDesignFigure name="fig8" fig="fig. 8" caption={t.ways.fig8.caption} description={t.ways.fig8.description} />
          </div>
          <div className={styles.wayCards}>
            {WAYS.map(([id, path]) => (
              <CardWay key={id} href={to(path)} title={t.ways.items[id][0]} cta={t.ways.cta}>{t.ways.items[id][1]}</CardWay>
            ))}
          </div>
        </div>
      </section>

      <section className={`${styles.cta} ${styles.solid}`} aria-labelledby="cta-h">
        <div className={`container ${styles.ctaInner}`}>
          <div className={styles.gallop}>
            <AsciiBlock decorative className={styles.gallopBlock} art desktop={gallopDesktop} mobile={gallopMobile} desktopLead={gallopDesktopLead} mobileLead={gallopMobileLead} desktopMin={479} emphasis={/([#%@]+)/.source} />
            <p className={`t-mono-label ${styles.gallopCaption}`}><span>fig. 9</span><span>{t.cta.figCaption}</span></p>
          </div>
          <h2 id="cta-h" className={`t-hero ${styles.ctaTitle}`}>{t.cta.h} <span className="line2">{t.cta.h2}</span></h2>
          <div className={styles.actions}>
            <Button variant="primary" href="#install">{t.cta.primary}</Button>
            <Button variant="link" href={to("/docs")}>{t.cta.docs}</Button>
          </div>
          <div className={styles.clone}>
            <CodeBlock label={t.cta.installLabel} code="npm install -g kedgeway" />
          </div>
        </div>
      </section>
    </>
  );
}
