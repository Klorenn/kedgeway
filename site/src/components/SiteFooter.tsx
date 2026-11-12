import Link from "next/link";
import FooterLandscape from "./FooterLandscape";
import HorseMark from "./HorseMark";
import PixelIcon from "./icons/pixel";
import styles from "./SiteFooter.module.css";

const REPO = "https://github.com/Klorenn/kedgeway";
const BLOB = `${REPO}/blob/main`;

// Official simple-icons paths (24x24 viewBox).
const X_PATH = "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z";
const GITHUB_PATH =
  "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.29 0 .319.21.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12";

export default function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`colWide ${styles.inner}`}>
        <div className={styles.row1}>
          <div className={styles.brandCol}>
            <Link href="/" className={styles.lockup} aria-label="kedgeway, home">
              <HorseMark size={40} />
              <span>kedgeway</span>
            </Link>
            <p className={styles.blurb}>Diagnose Stellar SDK drift against the live ecosystem. Open source, built on Stellar Raven.</p>
            <div className={styles.social}>
              <a className={styles.iconBtn} href="https://x.com/kl0ren" aria-label="Kl0ren on X">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={X_PATH} /></svg>
              </a>
              <a className={styles.iconBtn} href="https://github.com/Klorenn" aria-label="Kl0ren on GitHub">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={GITHUB_PATH} /></svg>
              </a>
              <a className={styles.iconBtn} href="https://www.npmjs.com/package/kedgeway" aria-label="kedgeway on npm (not published yet)">
                <PixelIcon name="crate" size={18} />
              </a>
            </div>
          </div>
          <div className={styles.cols}>
            <nav className={styles.col} aria-label="Product">
              <h3>Product</h3>
              <ul>
                <li><Link href="/#install">Install</Link></li>
                <li><Link href="/docs">Docs</Link></li>
                <li><Link href="/docs/findings">Findings</Link></li>
                <li><Link href="/docs/sdk">SDK</Link></li>
                <li><Link href="/docs/mcp">MCP</Link></li>
                <li><Link href="/docs/github-action">Action</Link></li>
                <li><Link href="/docs/migrate">Migrate</Link></li>
                <li><a href={`${BLOB}/CHANGELOG.md`}>Changelog</a></li>
              </ul>
            </nav>
            <nav className={styles.col} aria-label="Project">
              <h3>Project</h3>
              <ul>
                <li><a href={REPO}>GitHub</a></li>
                <li><a href={`${BLOB}/LICENSE`}>License MIT</a></li>
                <li><a href={`${BLOB}/SECURITY.md`}>Security</a></li>
                <li><a href={`${BLOB}/CONTRIBUTING.md`}>Contributing</a></li>
                <li><a href={`${BLOB}/CODE_OF_CONDUCT.md`}>Code of conduct</a></li>
              </ul>
            </nav>
            <nav className={styles.col} aria-label="Resources">
              <h3>Resources</h3>
              <ul>
                <li><Link href="/docs/getting-started">Getting started</Link></li>
                <li><Link href="/docs/authentication">Authentication</Link></li>
                <li><Link href="/docs/ci">CI</Link></li>
                <li><Link href="/docs/fixtures">Fixtures</Link></li>
                <li><Link href="/docs/faq">FAQ</Link></li>
              </ul>
            </nav>
            <nav className={styles.col} aria-label="Author">
              <h3>Author</h3>
              <ul>
                <li className={styles.plain}>Made by Kl0ren</li>
                <li><a href="https://x.com/kl0ren">X</a></li>
                <li><a href="https://github.com/Klorenn">GitHub</a></li>
              </ul>
            </nav>
          </div>
        </div>
        <div className={styles.legal}>
          <p>© 2026 kedgeway contributors. MIT licensed.</p>
          <p>
            Made by <a href="https://x.com/kl0ren">Kl0ren</a>
          </p>
        </div>
      </div>
      <FooterLandscape />
    </footer>
  );
}
