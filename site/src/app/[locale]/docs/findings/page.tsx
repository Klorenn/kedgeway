import PrevNext from "@/components/docs/PrevNext";
import { byLocale } from "@/i18n/config";
import { localeOf, metaFor } from "@/i18n/server";
import type { FindingCode } from "@/content/schema/docs-findings";
import en from "@/content/en/docs/findings";
import es from "@/content/es/docs/findings";
import styles from "../docs.module.css";

const DICT = { en, es };

export const generateMetadata = ({ params }: PageProps<"/[locale]/docs/findings">) => metaFor(params, "/docs/findings", DICT);

type Severity = "critical" | "warning" | "info";

/** Finding codes in page order with their severity (both are CLI values and stay English). Ids are the lowercased code. */
const FINDINGS: readonly (readonly [FindingCode, Severity])[] = [
  ["SDK_DEPRECATED", "critical"],
  ["SDK_BEHIND", "warning"],
  ["SDK_CURRENT", "info"],
  ["SDK_UNKNOWN", "warning"],
  ["JS_SDK_DEPRECATED", "critical"],
  ["JS_SDK_BEHIND", "warning"],
  ["JS_SDK_CURRENT", "info"],
  ["JS_SDK_UNKNOWN", "warning"],
  ["JS_LEGACY_PACKAGE", "critical"],
  ["MANIFEST_UNPARSEABLE", "warning"],
  ["DATA_DEGRADED", "warning"],
  ["NO_SDK_FOUND", "info"],
  ["CLI_DEPRECATED", "critical"],
  ["CLI_BEHIND", "warning"],
  ["CLI_CURRENT", "info"],
  ["CLI_UNKNOWN", "warning"],
  ["RUST_TARGET_LEGACY", "warning"],
  ["RUST_TOOLCHAIN_OLD", "warning"],
];

/** The severity summary list keeps its own order (it groups codes, not page order). */
const BY_SEVERITY: Record<Severity, readonly FindingCode[]> = {
  critical: ["SDK_DEPRECATED", "JS_SDK_DEPRECATED", "JS_LEGACY_PACKAGE", "CLI_DEPRECATED"],
  warning: ["SDK_BEHIND", "JS_SDK_BEHIND", "SDK_UNKNOWN", "JS_SDK_UNKNOWN", "MANIFEST_UNPARSEABLE", "DATA_DEGRADED", "CLI_BEHIND", "CLI_UNKNOWN", "RUST_TARGET_LEGACY", "RUST_TOOLCHAIN_OLD"],
  info: ["SDK_CURRENT", "JS_SDK_CURRENT", "NO_SDK_FOUND", "CLI_CURRENT"],
};

export default async function Findings({ params }: PageProps<"/[locale]/docs/findings">) {
  const t = byLocale(await localeOf(params), DICT);
  return (
    <>
      <h1>{t.h1}</h1>
      <p className={styles.lede}>{t.lede}</p>
      <ul>
        {(Object.keys(BY_SEVERITY) as Severity[]).map((sev) => (
          <li key={sev}><strong>{sev}:</strong> {BY_SEVERITY[sev].join(", ")}</li>
        ))}
      </ul>
      <p>{t.lockfile}</p>
      <p>{t.js}</p>
      {FINDINGS.map(([code, sev]) => {
        const id = code.toLowerCase();
        const f = t.findings[code];
        return (
          <section key={code} className={styles.finding} aria-labelledby={id}>
            <h2 id={id}>{code}</h2>
            <p className={styles.sev}>{sev}</p>
            <dl className={styles.defs}>
              <dt>{t.labels.meaning}</dt><dd>{f.meaning}</dd>
              <dt>{t.labels.evidence}</dt><dd>{f.evidence}</dd>
              <dt>{t.labels.todo}</dt><dd>{f.todo}</dd>
            </dl>
          </section>
        );
      })}
      <PrevNext href="/docs/findings" />
    </>
  );
}
