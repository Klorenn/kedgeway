import type { Metadata } from "next";
import { docsMeta } from "@/lib/seo";
import PrevNext from "@/components/docs/PrevNext";
import styles from "../docs.module.css";

export const metadata: Metadata = docsMeta("Data sources — kedgeway docs", "Where kedgeway gets ground truth, how conflicts are settled, and what DATA_DEGRADED means.", "/docs/data-sources");

export default function DataSources() {
  return (
    <>
      <h1>Data sources</h1>
      <p className={styles.lede}>
        kedgeway does not ship a list of versions. Each run asks the Stellar Raven MCP server (<code>https://raven.stellar.org/mcp</code>) in a single call.
      </p>

      <h2>What it asks for</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th scope="col">Source</th><th scope="col">Used for</th></tr></thead>
          <tbody>
            <tr><th scope="row"><code>stellarDocs.get_doc_page</code> on <code>/docs/networks/software-versions</code></th><td>The official Software Versions page: the current soroban-sdk, the current JavaScript SDK and the protocol version.</td></tr>
            <tr><th scope="row"><code>scout.analyzeEcosystem</code> (toolchain)</th><td>The Scout ecosystem toolchain index: a sample of repos on deprecated soroban-sdk versions.</td></tr>
            <tr><th scope="row"><code>stellarDocs.search_docs</code></th><td>Upgrade and migration notes. The top five hits (title, URL, a short snippet) are collected into the snapshot. <code>diagnose</code> does not print them. <code>migrate</code> cites a hit only when its title or url is a migration document.</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Which source wins</h2>
      <ul>
        <li>The official docs page is the authority for what is current.</li>
        <li>Scout&apos;s deprecated list is a <strong>sample, capped at 50</strong>. A Scout entry only counts when it is below the current major from the docs.</li>
        <li>A dependency more than one major behind is treated as deprecated even if Scout does not list it.</li>
      </ul>

      <h2>Provenance on every finding</h2>
      <p>Every finding cites its source and the time it was observed. The report header shows the current soroban-sdk major and the observation time, an ISO 8601 UTC timestamp taken when the run asked Raven.</p>

      <h2>DATA_DEGRADED</h2>
      <p>If a source fails or returns something kedgeway cannot read, the run does not stop and does not guess. It records a note, and each note becomes a DATA_DEGRADED finding. Notes name the source, for example:</p>
      <ul>
        <li><code>stellarDocs.get_doc_page: &lt;error&gt;</code></li>
        <li><code>software-versions: rust sdk row not found</code></li>
        <li><code>scout.analyzeEcosystem: &lt;error&gt;</code></li>
        <li><code>stellarDocs.search_docs: &lt;error&gt;</code></li>
      </ul>
      <p>When the current soroban-sdk major is missing, repo findings fall back to SDK_UNKNOWN and no deprecation claim is made.</p>
      <h2>Snapshot cache</h2>
      <p>After every successful Raven fetch, kedgeway writes the ecosystem snapshot to <code>$XDG_CACHE_HOME/kedgeway/snapshot.json</code> (by default <code>~/.cache/kedgeway/</code>, file mode 0600, folder 0700). Later runs reuse it.</p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th scope="col">Situation</th><th scope="col">What happens</th></tr></thead>
          <tbody>
            <tr><th scope="row">Fresh cache</th><td>Younger than <code>--max-age</code> (default <code>24h</code>) and not dated in the future: used without calling Raven.</td></tr>
            <tr><th scope="row">Stale cache</th><td>Refetched. If Raven then fails, the stale cache is used and a <code>DATA_DEGRADED</code> finding says <code>using cached snapshot from &lt;observedAt&gt;</code>.</td></tr>
            <tr><th scope="row"><code>--offline</code></th><td>Never calls Raven. Exits 1 if there is no cache. A stale cache is used with a <code>DATA_DEGRADED</code> finding such as <code>snapshot is N hours old</code>.</td></tr>
            <tr><th scope="row"><code>--no-cache</code></th><td>Skips reading the cache and the failure fallback, but still writes the fresh snapshot.</td></tr>
            <tr><th scope="row"><code>--max-age &lt;duration&gt;</code></th><td>How old a cached snapshot may be: <code>30s</code>, <code>15m</code>, <code>24h</code> or <code>2d</code>.</td></tr>
          </tbody>
        </table>
      </div>
      <ul>
        <li>A snapshot that carries <code>DATA_DEGRADED</code> notes is never written to the cache, and a cached one that carries notes counts as stale.</li>
        <li><code>--offline</code> with <code>--no-cache</code> is rejected (exit 1). <code>--offline</code> is ignored, with a warning, when <code>--fixture</code> is set. <code>--fixture</code> bypasses the cache entirely.</li>
        <li>The cache is a single global file. <code>--max-age</code> applies to its <code>observedAt</code>.</li>
      </ul>

      <PrevNext href="/docs/data-sources" />
    </>
  );
}
