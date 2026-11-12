import FooterBand from "./FooterBand";
import { LogoMark } from "./ui/Logo";
import NavLink from "./ui/NavLink";
import SocialButton from "./ui/SocialButton";
import styles from "./SiteFooter.module.css";

const REPO = "https://github.com/Klorenn/kedgeway";
const BLOB = `${REPO}/blob/main`;
const X = "https://x.com/kl0ren";
const GH = "https://github.com/Klorenn";
const BLURB = "Diagnose Stellar SDK drift against the live ecosystem. Open source, built on Stellar Raven.";

const COLUMNS: readonly { title: string; links: readonly (readonly [string, string])[] }[] = [
  {
    title: "Product",
    links: [
      ["Install", "/#install"],
      ["Docs", "/docs"],
      ["Findings", "/docs/findings"],
      ["SDK", "/docs/sdk"],
      ["MCP", "/docs/mcp"],
      ["Action", "/docs/github-action"],
      ["Migrate", "/docs/migrate"],
      ["Changelog", `${BLOB}/CHANGELOG.md`],
    ],
  },
  {
    title: "Project",
    links: [
      ["GitHub", REPO],
      ["License MIT", `${BLOB}/LICENSE`],
      ["Security", `${BLOB}/SECURITY.md`],
      ["Contributing", `${BLOB}/CONTRIBUTING.md`],
      ["Code of conduct", `${BLOB}/CODE_OF_CONDUCT.md`],
    ],
  },
  {
    title: "Resources",
    links: [
      ["Getting started", "/docs/getting-started"],
      ["Authentication", "/docs/authentication"],
      ["CI", "/docs/ci"],
      ["Fixtures", "/docs/fixtures"],
      ["FAQ", "/docs/faq"],
    ],
  },
  {
    title: "Author",
    links: [
      ["X", X],
      ["GitHub", GH],
    ],
  },
];

const MOBILE_LINKS: readonly (readonly [string, string])[] = [
  ["Install", "/#install"],
  ["Docs", "/docs"],
  ["Findings", "/docs/findings"],
  ["FAQ", "/docs/faq"],
  ["Changelog", `${BLOB}/CHANGELOG.md`],
  ["Security", `${BLOB}/SECURITY.md`],
  ["License MIT", `${BLOB}/LICENSE`],
];

function Social() {
  return (
    <div className={styles.social}>
      <SocialButton network="x" href={X} label="Kl0ren on X" />
      <SocialButton network="github" href={GH} label="Kl0ren on GitHub" />
    </div>
  );
}

function Legal() {
  return (
    <div className={styles.legal}>
      <p className="t-body-small">© 2026 kedgeway contributors. MIT licensed.</p>
      <p className="t-body-small">
        <NavLink href={X}>Made by Kl0ren</NavLink>
      </p>
    </div>
  );
}

/** Same footer on landing and docs. Desktop (>=1024): brand + 4 columns + signature + legal. Below: centered variant. */
export default function SiteFooter() {
  return (
    <footer className={styles.footer}>
      {/* Desktop */}
      <div className={`container ${styles.desktop}`}>
        <div className={styles.top}>
          <div className={styles.brandCol}>
            <p className="t-body-small">{BLURB}</p>
            <Social />
          </div>
          <div className={styles.cols}>
            {COLUMNS.map((c) => (
              <nav key={c.title} aria-labelledby={`f-${c.title}`}>
                <p id={`f-${c.title}`} className={`t-overline ${styles.colTitle}`}>{c.title}</p>
                <ul className={styles.list}>
                  {c.links.map(([label, href]) => (
                    <li key={label}><NavLink href={href}>{label}</NavLink></li>
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
        <Legal />
      </div>

      {/* Mobile and tablet */}
      <div className={`container ${styles.mobile}`}>
        <LogoMark height={64} />
        <p className="t-body-small">{BLURB}</p>
        <Social />
        <nav aria-label="Footer">
          <ul className={styles.row}>
            {MOBILE_LINKS.map(([label, href]) => (
              <li key={label}><NavLink href={href}>{label}</NavLink></li>
            ))}
          </ul>
        </nav>
        <div className={styles.wmBox} aria-hidden="true"><span className={styles.wmMobile}>kedgeway</span></div>
        <Legal />
      </div>

      <FooterBand />
    </footer>
  );
}
