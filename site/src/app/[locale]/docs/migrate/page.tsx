import CodeBlock from "@/components/CodeBlock";
import Callout from "@/components/docs/Callout";
import PrevNext from "@/components/docs/PrevNext";
import { byLocale } from "@/i18n/config";
import { localeOf, metaFor } from "@/i18n/server";
import en from "@/content/en/docs/migrate";
import es from "@/content/es/docs/migrate";
import styles from "../docs.module.css";

const DICT = { en, es };

export const generateMetadata = ({ params }: PageProps<"/[locale]/docs/migrate">) => metaFor(params, "/docs/migrate", DICT);

export default async function Page({ params }: PageProps<"/[locale]/docs/migrate">) {
  const t = byLocale(await localeOf(params), DICT);
  return (
    <>
      <h1>{t.h1}</h1>
      <p className={styles.lede}>{t.lede}</p>

      <h2>{t.guideH}</h2>
      <p>{t.guideIntro}</p>
      <ul>
        <li>{t.guide.where}</li>
        <li>{t.guide.steps}</li>
        <li>{t.guide.legacy}</li>
        <li>{t.guide.docs}</li>
      </ul>

      <h2>{t.runH}</h2>
      <CodeBlock code={`kedgeway migrate [path]            # dry run (default): prints a guide and a diff, edits nothing
kedgeway migrate [path] --dry-run  # the same; cannot be combined with --write
kedgeway migrate [path] --write    # applies the edits
kedgeway migrate . --fixture snapshot.json
kedgeway migrate . --offline       # cached snapshot only (also --no-cache, --max-age)`} />

      <h2>{t.changesH}</h2>
      <ul>
        <li>{t.changes.rust}</li>
        <li>{t.changes.js}</li>
        <li>{t.changes.legacy}</li>
        <li>{t.changes.aliases}</li>
      </ul>

      <h2>{t.refusesH}</h2>
      <ul>
        <li>{t.refuses.base}</li>
        <li>{t.refuses.noRun}</li>
        <li>{t.refuses.git}</li>
        <li>{t.refuses.manual}</li>
        <li>{t.refuses.exact}</li>
      </ul>

      <h2>{t.lockfilesH}</h2>
      <ul>
        <li>{t.lockfiles.resolved}</li>
        <li>{t.lockfiles.refresh}</li>
        <li>{t.lockfiles.reminder}</li>
      </ul>

      <h2>{t.exitH}</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th scope="col">{t.exitCols.code}</th><th scope="col">{t.exitCols.meaning}</th></tr></thead>
          <tbody>
            <tr><th scope="row"><code>0</code></th><td>{t.exit.ok}</td></tr>
            <tr><th scope="row"><code>2</code></th><td>{t.exit.gate}</td></tr>
            <tr><th scope="row"><code>1</code></th><td>{t.exit.error}</td></tr>
          </tbody>
        </table>
      </div>
      <Callout kind="warning">
        <p>{t.warning}</p>
      </Callout>
      <PrevNext href="/docs/migrate" />
    </>
  );
}
