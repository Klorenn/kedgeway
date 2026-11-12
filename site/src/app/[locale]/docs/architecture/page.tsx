import PrevNext from "@/components/docs/PrevNext";
import { byLocale } from "@/i18n/config";
import { localeOf, metaFor } from "@/i18n/server";
import en from "@/content/en/docs/architecture";
import es from "@/content/es/docs/architecture";
import styles from "../docs.module.css";

const DICT = { en, es };

export const generateMetadata = ({ params }: PageProps<"/[locale]/docs/architecture">) => metaFor(params, "/docs/architecture", DICT);

export default async function Architecture({ params }: PageProps<"/[locale]/docs/architecture">) {
  const t = byLocale(await localeOf(params), DICT);
  return (
    <>
      <h1>{t.h1}</h1>
      <p className={styles.lede}>{t.lede}</p>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th scope="col">{t.cols.layer}</th><th scope="col">{t.cols.files}</th><th scope="col">{t.cols.role}</th></tr></thead>
          <tbody>
            <tr><th scope="row">core</th><td><code>src/core/diagnose.ts</code>, <code>src/core/repo-facts.ts</code></td><td>{t.layers.core}</td></tr>
            <tr><th scope="row">ports</th><td><code>src/ports/ecosystem.ts</code></td><td>{t.layers.ports}</td></tr>
            <tr><th scope="row">adapters</th><td><code>src/adapters/</code></td><td>{t.layers.adapters}</td></tr>
            <tr><th scope="row">cli</th><td><code>src/cli.ts</code>, <code>src/cli/commands.ts</code></td><td>{t.layers.cli}</td></tr>
          </tbody>
        </table>
      </div>

      <h2>{t.flowH}</h2>
      <ol>
        <li>{t.flow.scan}</li>
        <li>{t.flow.port}</li>
        <li>{t.flow.diagnose}</li>
        <li>{t.flow.print}</li>
      </ol>

      <h2>{t.testsH}</h2>
      <p>{t.tests}</p>

      <h2>{t.ruleH}</h2>
      <ol>
        <li>{t.rule.test}</li>
        <li>{t.rule.logic}</li>
        <li>{t.rule.parser}</li>
        <li>{t.rule.docs}</li>
      </ol>
      <PrevNext href="/docs/architecture" />
    </>
  );
}
