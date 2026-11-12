import CodeBlock from "@/components/CodeBlock";
import PrevNext from "@/components/docs/PrevNext";
import { byLocale } from "@/i18n/config";
import { localeOf, metaFor } from "@/i18n/server";
import type { FixtureField } from "@/content/schema/docs-fixtures";
import en from "@/content/en/docs/fixtures";
import es from "@/content/es/docs/fixtures";
import styles from "../docs.module.css";

const DICT = { en, es };

export const generateMetadata = ({ params }: PageProps<"/[locale]/docs/fixtures">) => metaFor(params, "/docs/fixtures", DICT);

const EXAMPLE = `{
  "observedAt": "2026-11-11T22:00:57Z",
  "sorobanSdk": {
    "currentMajor": 28,
    "deprecatedVersions": ["21.0.0", "20.5.0"],
    "source": "snapshot saved from Software Versions page"
  },
  "jsSdk": {
    "currentVersion": "<current @stellar/stellar-sdk version>",
    "source": "snapshot saved from Software Versions page"
  },
  "protocolCurrent": null,
  "notes": [
    { "title": "Upgrade notes", "url": "https://example.com/notes", "snippet": "Short excerpt." }
  ],
  "degraded": []
}`;

/** Field key in the dictionary → the JSON path shown in the table (code, not prose). */
const FIELDS: readonly (readonly [FixtureField, string])[] = [
  ["observedAt", "observedAt"],
  ["currentMajor", "sorobanSdk.currentMajor"],
  ["deprecatedVersions", "sorobanSdk.deprecatedVersions"],
  ["sorobanSource", "sorobanSdk.source"],
  ["currentVersion", "jsSdk.currentVersion"],
  ["jsSource", "jsSdk.source"],
  ["protocolCurrent", "protocolCurrent"],
  ["notes", "notes"],
  ["degraded", "degraded"],
];

export default async function Fixtures({ params }: PageProps<"/[locale]/docs/fixtures">) {
  const t = byLocale(await localeOf(params), DICT);
  return (
    <>
      <h1>{t.h1}</h1>
      <p className={styles.lede}>{t.lede}</p>

      <CodeBlock code={"kedgeway diagnose ./my-contract --fixture snapshot.json"} />

      <h2>{t.shapeH}</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th scope="col">{t.cols.field}</th><th scope="col">{t.cols.type}</th><th scope="col">{t.cols.notes}</th></tr></thead>
          <tbody>
            {FIELDS.map(([key, path]) => (
              <tr key={key}><th scope="row"><code>{path}</code></th><td>{t.fields[key].type}</td><td>{t.fields[key].notes}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>{t.exampleH}</h2>
      <CodeBlock code={EXAMPLE} />
      <p>{t.after}</p>
      <PrevNext href="/docs/fixtures" />
    </>
  );
}
