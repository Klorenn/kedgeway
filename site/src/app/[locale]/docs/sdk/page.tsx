import CodeBlock from "@/components/CodeBlock";
import Callout from "@/components/docs/Callout";
import PrevNext from "@/components/docs/PrevNext";
import { byLocale } from "@/i18n/config";
import { localeOf, metaFor } from "@/i18n/server";
import type { SdkExport } from "@/content/schema/docs-sdk";
import en from "@/content/en/docs/sdk";
import es from "@/content/es/docs/sdk";
import styles from "../docs.module.css";

const DICT = { en, es };

export const generateMetadata = ({ params }: PageProps<"/[locale]/docs/sdk">) => metaFor(params, "/docs/sdk", DICT);

/** Export key → its signature as shown in the table (code). */
const EXPORTS: readonly (readonly [SdkExport, React.ReactNode])[] = [
  ["diagnose", <code key="c">{"diagnose(opts: { path; ecosystem?; fixture? })"}</code>],
  ["diagnoseDetailed", <code key="c">diagnoseDetailed(opts)</code>],
  ["scanRepo", <code key="c">scanRepo(path)</code>],
  ["diagnoseRepo", <code key="c">diagnoseRepo(facts, snapshot)</code>],
  ["createRavenEcosystem", <code key="c">createRavenEcosystem(opts?)</code>],
  ["fixtures", <><code>loadFixture(file)</code>, <code>FakeEcosystem</code></>],
  ["planMigration", <code key="c">planMigration(facts, snapshot)</code>],
  ["buildGuide", <code key="c">buildGuide(plan, snapshot, hits)</code>],
  ["findImportHits", <code key="c">findImportHits(files, names)</code>],
  ["applyMigration", <code key="c">applyMigration(plan, {"{ write }"})</code>],
  ["migrate", <code key="c">migrate(opts)</code>],
  ["toSarif", <code key="c">{"toSarif(detailed, { cwd? })"}</code>],
  ["toAnnotations", <code key="c">{"toAnnotations(detailed, { cwd? })"}</code>],
];

const EXAMPLE = `import { diagnose } from "kedgeway";

const diagnosis = await diagnose({
  path: ".",
  fixture: "snapshot.json", // see the Fixtures page for the shape
});

console.log(diagnosis.summary); // { critical, warning, info }
for (const f of diagnosis.findings) {
  console.log(f.severity, f.code, f.file);
}
process.exitCode = diagnosis.summary.critical > 0 ? 2 : 0;`;

export default async function Page({ params }: PageProps<"/[locale]/docs/sdk">) {
  const t = byLocale(await localeOf(params), DICT);
  return (
    <>
      <h1>{t.h1}</h1>
      <p className={styles.lede}>{t.lede}</p>

      <h2>{t.installH}</h2>
      <p>{t.install}</p>
      <Callout kind="warning">
        <p>{t.esmWarning}</p>
      </Callout>

      <h2>{t.apiH}</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th scope="col">{t.cols.export}</th><th scope="col">{t.cols.does}</th></tr></thead>
          <tbody>
            {EXPORTS.map(([key, sig]) => (
              <tr key={key}><th scope="row">{sig}</th><td>{t.api[key]}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>{t.types}</p>

      <h2>{t.exampleH}</h2>
      <CodeBlock code={EXAMPLE} />
      <p>{t.live}</p>
      <PrevNext href="/docs/sdk" />
    </>
  );
}
