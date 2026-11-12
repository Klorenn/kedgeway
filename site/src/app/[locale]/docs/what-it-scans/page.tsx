import CodeBlock from "@/components/CodeBlock";
import PrevNext from "@/components/docs/PrevNext";
import { byLocale } from "@/i18n/config";
import { localeOf, metaFor } from "@/i18n/server";
import en from "@/content/en/docs/what-it-scans";
import es from "@/content/es/docs/what-it-scans";
import styles from "../docs.module.css";

const DICT = { en, es };

export const generateMetadata = ({ params }: PageProps<"/[locale]/docs/what-it-scans">) => metaFor(params, "/docs/what-it-scans", DICT);

export default async function WhatItScans({ params }: PageProps<"/[locale]/docs/what-it-scans">) {
  const t = byLocale(await localeOf(params), DICT);
  return (
    <>
      <h1>{t.h1}</h1>
      <p className={styles.lede}>{t.lede}</p>

      <h2 id="cargo-toml">Cargo.toml</h2>
      <p>{t.cargoIntro}</p>
      <CodeBlock label="toml" code={`# string
soroban-sdk = "21.0.0"

# table
soroban-sdk = { version = "21.0.0", features = ["testutils"] }

# renamed
sdk = { package = "soroban-sdk", version = "21.0.0" }

# workspace
[workspace.dependencies]
soroban-sdk = "21.0.0"

[dependencies]
soroban-sdk = { workspace = true }`} />
      <ul>
        <li>{t.cargo.tables}</li>
        <li>{t.cargo.renames}</li>
        <li>{t.cargo.workspaces}</li>
        <li>{t.cargo.duplicates}</li>
      </ul>

      <h2 id="package-json">package.json</h2>
      <p>{t.pkgIntro}</p>
      <ul>
        <li><code>@stellar/stellar-sdk</code></li>
        <li><code>@stellar/stellar-base</code></li>
        <li><code>soroban-client</code> {t.pkgLegacy}</li>
        <li><code>stellar-sdk</code> {t.pkgLegacyUnscoped}</li>
      </ul>
      <p>{t.pkgPeer}</p>
      <h3>{t.aliasesH}</h3>
      <p>{t.aliasesIntro}</p>
      <CodeBlock label="package.json" code={`"stellar-sdk": "npm:@stellar/stellar-sdk@17.4.0"`} />
      <p>{t.aliasesVersion}</p>

      <h2>{t.whereH}</h2>
      <ul>
        <li>{t.where.walk}</li>
        <li>{t.where.skips}</li>
        <li>{t.where.unreadable}</li>
      </ul>

      <h2>{t.versionsH}</h2>
      <p>{t.versionsIntro}</p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th scope="col">{t.versionCols.declared}</th><th scope="col">{t.versionCols.readAs}</th></tr></thead>
          <tbody>
            <tr><th scope="row"><code>21.0.0</code>, <code>^21.0.0</code>, <code>~21.0</code></th><td>{t.versionRows.plain}</td></tr>
            <tr><th scope="row"><code>{">=21.0.0"}</code></th><td>{t.versionRows.gte}</td></tr>
            <tr><th scope="row"><code>21.x</code></th><td>{t.versionRows.x}</td></tr>
            <tr><th scope="row"><code>{"<22"}</code>, <code>{"<=21.0.0"}</code></th><td>{t.versionRows.upper}</td></tr>
            <tr><th scope="row"><code>{">=20 || ^21"}</code></th><td>{t.versionRows.compound}</td></tr>
            <tr><th scope="row">{t.versionRows.emptyLabel}</th><td>{t.versionRows.empty}</td></tr>
          </tbody>
        </table>
      </div>
      <p>{t.versionsUnknown}</p>
      <p>{t.versionsLockfile}</p>
      <h2 id="lockfiles">{t.lockfilesH}</h2>
      <p>{t.lockfilesIntro}</p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th scope="col">{t.lockCols.lockfile}</th><th scope="col">{t.lockCols.how}</th></tr></thead>
          <tbody>
            <tr><th scope="row"><code>Cargo.lock</code></th><td>{t.lockRows.cargo}</td></tr>
            <tr><th scope="row"><code>package-lock.json</code></th><td>{t.lockRows.npm}</td></tr>
            <tr><th scope="row"><code>pnpm-lock.yaml</code></th><td>{t.lockRows.pnpm}</td></tr>
            <tr><th scope="row"><code>yarn.lock</code></th><td>{t.lockRows.yarn}</td></tr>
          </tbody>
        </table>
      </div>
      <ul>
        <li>{t.lockNotes.ambiguous}</li>
        <li>{t.lockNotes.where}</li>
        <li>{t.lockNotes.ranges}</li>
        <li>{t.lockNotes.limits}</li>
        <li>{t.lockNotes.tested}</li>
      </ul>

      <h2 id="remote-repositories">{t.remoteH}</h2>
      <p>{t.remoteIntro}</p>
      <ul>
        <li>{t.remote.fetch}</li>
        <li>{t.remote.private}</li>
        <li>{t.remote.noGit}</li>
        <li>{t.remote.rejected}</li>
        <li>{t.remote.output}</li>
        <li>{t.remote.migrate}</li>
      </ul>
      <CodeBlock code={`kedgeway diagnose https://github.com/o/r
kedgeway diagnose o/r --ref v1.2.0`} />

      <h2>{t.toolchainH}</h2>
      <p>{t.toolchainIntro}</p>
      <ul>
        <li>{t.toolchain.cli}</li>
        <li>{t.toolchain.target}</li>
        <li>{t.toolchain.rust}</li>
      </ul>

      <PrevNext href="/docs/what-it-scans" />
    </>
  );
}
