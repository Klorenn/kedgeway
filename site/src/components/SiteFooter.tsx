import Link from "next/link";
import HorseMark from "./HorseMark";
import styles from "./SiteFooter.module.css";

const REPO = "https://github.com/kedgeway/kedgeway";
const BLOB = `${REPO}/blob/main`;

// Official simple-icons paths (24x24 viewBox).
const X_PATH = "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z";
const GITHUB_PATH =
  "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.29 0 .319.21.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12";

export default function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className="wrap">
        <div className={styles.brandRow}>
          <HorseMark size={64} />
          <p className={styles.word}>kedgeway</p>
        </div>
        <div className={styles.cols}>
          <div>
            <p className={styles.h}>Product</p>
            <p><Link href="/#install">Install</Link></p>
            <p><Link href="/docs">Docs</Link></p>
            <p><Link href="/docs/roadmap">Roadmap</Link></p>
            <p><a href={`${BLOB}/CHANGELOG.md`}>Changelog</a></p>
          </div>
          <div>
            <p className={styles.h}>Project</p>
            <p><a href={REPO}>GitHub</a></p>
            <p><a href={`${BLOB}/LICENSE`}>License MIT</a></p>
            <p><a href={`${BLOB}/SECURITY.md`}>Security</a></p>
            <p><a href={`${BLOB}/CONTRIBUTING.md`}>Contributing</a></p>
          </div>
          <div>
            <p className={styles.h}>Source</p>
            <p className={styles.plain}>Built on Stellar Raven</p>
            <p className={styles.plain}>Muybridge pl. 626 — 1878</p>
          </div>
          <div>
            <p className={styles.h}>Author</p>
            <p className={styles.made}>Made by Kl0ren</p>
            <div className={styles.icons}>
              <a href="https://x.com/kl0ren" aria-label="Kl0ren on X">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={X_PATH} /></svg>
              </a>
              <a href="https://github.com/Klorenn" aria-label="Kl0ren on GitHub">
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={GITHUB_PATH} /></svg>
              </a>
            </div>
          </div>
        </div>
        <div className={styles.legal}>
          <span>© 2026 kedgeway contributors</span>
          <span>kedgeway.xyz</span>
        </div>
      </div>
    </footer>
  );
}
