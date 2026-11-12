import PrevNext from "@/components/docs/PrevNext";
import { byLocale } from "@/i18n/config";
import { localeOf, metaFor } from "@/i18n/server";
import en from "@/content/en/docs/data-sources";
import es from "@/content/es/docs/data-sources";
import styles from "../docs.module.css";

const DICT = { en, es };

export const generateMetadata = ({ params }: PageProps<"/[locale]/docs/data-sources">) => metaFor(params, "/docs/data-sources", DICT);

export default async function DataSources({ params }: PageProps<"/[locale]/docs/data-sources">) {
  const t = byLocale(await localeOf(params), DICT);
  return (
    <>
      <h1>{t.h1}</h1>
      <p className={styles.lede}>{t.lede}</p>

      <h2>{t.askH}</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th scope="col">{t.askCols.source}</th><th scope="col">{t.askCols.usedFor}</th></tr></thead>
          <tbody>
            <tr><th scope="row">{t.ask.docPage.source}</th><td>{t.ask.docPage.use}</td></tr>
            <tr><th scope="row">{t.ask.scout.source}</th><td>{t.ask.scout.use}</td></tr>
            <tr><th scope="row">{t.ask.search.source}</th><td>{t.ask.search.use}</td></tr>
          </tbody>
        </table>
      </div>

      <h2>{t.winsH}</h2>
      <ul>
        <li>{t.wins.docs}</li>
        <li>{t.wins.scout}</li>
        <li>{t.wins.behind}</li>
      </ul>

      <h2>{t.provenanceH}</h2>
      <p>{t.provenance}</p>

      <h2>{t.degradedH}</h2>
      <p>{t.degradedIntro}</p>
      <ul>
        <li><code>stellarDocs.get_doc_page: &lt;error&gt;</code></li>
        <li><code>software-versions: rust sdk row not found</code></li>
        <li><code>scout.analyzeEcosystem: &lt;error&gt;</code></li>
        <li><code>stellarDocs.search_docs: &lt;error&gt;</code></li>
      </ul>
      <p>{t.degradedFallback}</p>
      <h2>{t.cacheH}</h2>
      <p>{t.cacheIntro}</p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th scope="col">{t.cacheCols.situation}</th><th scope="col">{t.cacheCols.happens}</th></tr></thead>
          <tbody>
            <tr><th scope="row">{t.cache.fresh.label}</th><td>{t.cache.fresh.text}</td></tr>
            <tr><th scope="row">{t.cache.stale.label}</th><td>{t.cache.stale.text}</td></tr>
            <tr><th scope="row"><code>--offline</code></th><td>{t.cache.offline}</td></tr>
            <tr><th scope="row"><code>--no-cache</code></th><td>{t.cache.noCache}</td></tr>
            <tr><th scope="row"><code>--max-age &lt;duration&gt;</code></th><td>{t.cache.maxAge}</td></tr>
          </tbody>
        </table>
      </div>
      <ul>
        <li>{t.cacheNotes.degraded}</li>
        <li>{t.cacheNotes.flags}</li>
        <li>{t.cacheNotes.global}</li>
      </ul>

      <PrevNext href="/docs/data-sources" />
    </>
  );
}
