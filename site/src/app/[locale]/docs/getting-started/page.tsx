import CodeBlock from "@/components/CodeBlock";
import PrevNext from "@/components/docs/PrevNext";
import { byLocale } from "@/i18n/config";
import { localeOf, metaFor } from "@/i18n/server";
import en from "@/content/en/docs/getting-started";
import es from "@/content/es/docs/getting-started";
import styles from "../docs.module.css";

const DICT = { en, es };

export const generateMetadata = ({ params }: PageProps<"/[locale]/docs/getting-started">) => metaFor(params, "/docs/getting-started", DICT);

export default async function GettingStarted({ params }: PageProps<"/[locale]/docs/getting-started">) {
  const t = byLocale(await localeOf(params), DICT);
  return (
    <>
      <h1>{t.h1}</h1>
      <p className={styles.lede}>{t.lede}</p>

      <h2>{t.installH}</h2>
      <p>{t.installP}</p>
      <CodeBlock code={"npm install -g kedgeway"} />
      <p>{t.hack}</p>
      <p>{t.check}</p>
      <CodeBlock code={"kedgeway --help"} />

      <h2>{t.loginH}</h2>
      <CodeBlock code={"kedgeway login"} />
      <p>{t.loginP}</p>

      <h2>{t.runH}</h2>
      <CodeBlock code={"kedgeway diagnose ./my-contract"} />
      <p>{t.runP}</p>

      <h2>{t.readH}</h2>
      <CodeBlock copy={false} code={`kedgeway: ./my-contract
Ecosystem: soroban-sdk current major 28, observed 2026-11-11T22:00:57Z

[CRITICAL] SDK_DEPRECATED  contracts/hello/Cargo.toml
  soroban-sdk 21.0.0 is on a major listed as deprecated (current: 28). Upgrade.
  evidence: major 21 < current major 28 and appears in the Scout deprecated sample (source: <source>, observed <time>).
[CRITICAL] JS_LEGACY_PACKAGE  package.json
  soroban-client 1.0.0 is a legacy package; replace it with @stellar/stellar-sdk.
  evidence: Legacy package name detected in manifest; reference: <source>, observed <time>.

Summary: 2 critical, 0 warning, 0 info`} />
      <dl className={styles.defs}>
        {(["header", "finding", "summary"] as const).map((k) => (
          <div key={k}><dt>{t.defs[k].dt}</dt><dd>{t.defs[k].dd}</dd></div>
        ))}
      </dl>
      <p>{t.codes}</p>
      <p className={styles.note}>{t.note}</p>
      <PrevNext href="/docs/getting-started" />
    </>
  );
}
