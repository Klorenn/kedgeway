import FooterBand from "./FooterBand";
import { LogoMark } from "./ui/Logo";
import NavLink from "./ui/NavLink";
import SocialButton from "./ui/SocialButton";
import styles from "./SiteFooter.module.css";
import type { Locale } from "@/i18n/config";
import { href } from "@/i18n/href";
import { UI } from "@/content/ui";
import type { UiDict } from "@/content/schema/ui";

const REPO = "https://github.com/Klorenn/kedgeway";
const BLOB = `${REPO}/blob/main`;
const X = "https://x.com/kl0ren";
const GH = "https://github.com/Klorenn";
type Links = readonly (readonly [string, string])[];

function columns(locale: Locale, t: UiDict["footer"]): readonly { id: string; title: string; links: Links }[] {
  const to = (path: string): string => href(locale, path);
  return [
    {
      id: "product",
      title: t.product,
      links: [
        [t.install, to("/#install")],
        [t.docs, to("/docs")],
        [t.findings, to("/docs/findings")],
        [t.sdk, to("/docs/sdk")],
        [t.mcp, to("/docs/mcp")],
        [t.action, to("/docs/github-action")],
        [t.migrate, to("/docs/migrate")],
        [t.changelog, `${BLOB}/CHANGELOG.md`],
      ],
    },
    {
      id: "project",
      title: t.project,
      links: [
        [t.github, REPO],
        [t.license, `${BLOB}/LICENSE`],
        [t.security, `${BLOB}/SECURITY.md`],
        [t.contributing, `${BLOB}/CONTRIBUTING.md`],
        [t.conduct, `${BLOB}/CODE_OF_CONDUCT.md`],
      ],
    },
    {
      id: "resources",
      title: t.resources,
      links: [
        [t.gettingStarted, to("/docs/getting-started")],
        [t.authentication, to("/docs/authentication")],
        [t.ci, to("/docs/ci")],
        [t.fixtures, to("/docs/fixtures")],
        [t.faq, to("/docs/faq")],
      ],
    },
    {
      id: "author",
      title: t.author,
      links: [
        [t.x, X],
        [t.github, GH],
      ],
    },
  ];
}

function mobileLinks(locale: Locale, t: UiDict["footer"]): Links {
  return [
    [t.install, href(locale, "/#install")],
    [t.docs, href(locale, "/docs")],
    [t.findings, href(locale, "/docs/findings")],
    [t.faq, href(locale, "/docs/faq")],
    [t.changelog, `${BLOB}/CHANGELOG.md`],
    [t.security, `${BLOB}/SECURITY.md`],
    [t.license, `${BLOB}/LICENSE`],
  ];
}

function Social({ t }: { t: UiDict["footer"] }) {
  return (
    <div className={styles.social}>
      <SocialButton network="x" href={X} label={t.xLabel} />
      <SocialButton network="github" href={GH} label={t.githubLabel} />
    </div>
  );
}

function Legal({ t }: { t: UiDict["footer"] }) {
  return (
    <div className={styles.legal}>
      <p className="t-body-small">{t.legal}</p>
      <p className="t-body-small">
        <NavLink href={X}>{t.madeBy}</NavLink>
      </p>
    </div>
  );
}

/** Same footer on landing and docs. Desktop (>=1024): brand + 4 columns + signature + legal. Below: centered variant. */
export default function SiteFooter({ locale }: { locale: Locale }) {
  const t = UI[locale].footer;
  return (
    <footer className={styles.footer}>
      {/* Desktop */}
      <div className={`container ${styles.desktop}`}>
        <div className={styles.top}>
          <div className={styles.brandCol}>
            <p className="t-body-small">{t.blurb}</p>
            <Social t={t} />
          </div>
          <div className={styles.cols}>
            {columns(locale, t).map((c) => (
              <nav key={c.id} aria-labelledby={`f-${c.id}`}>
                <p id={`f-${c.id}`} className={`t-overline ${styles.colTitle}`}>{c.title}</p>
                <ul className={styles.list}>
                  {c.links.map(([label, url]) => (
                    <li key={url}><NavLink href={url}>{label}</NavLink></li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
        <div className={styles.signature} aria-hidden="true">
          <LogoMark height={160} />
          <div className={styles.wmBox}><span className={styles.wm}>kedgeway</span></div>
        </div>
        <Legal t={t} />
      </div>

      {/* Mobile and tablet */}
      <div className={`container ${styles.mobile}`}>
        <LogoMark height={64} />
        <p className="t-body-small">{t.blurb}</p>
        <Social t={t} />
        <nav aria-label={t.nav}>
          <ul className={styles.row}>
            {mobileLinks(locale, t).map(([label, url]) => (
              <li key={url}><NavLink href={url}>{label}</NavLink></li>
            ))}
          </ul>
        </nav>
        <div className={styles.wmBox} aria-hidden="true"><span className={styles.wmMobile}>kedgeway</span></div>
        <Legal t={t} />
      </div>

      <FooterBand />
    </footer>
  );
}
