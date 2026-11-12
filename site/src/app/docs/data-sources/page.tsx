import type { Metadata } from "next";
import PrevNext from "@/components/docs/PrevNext";
import styles from "../docs.module.css";

export const metadata: Metadata = {
  title: "Data sources — kedgeway docs",
  description: "Where kedgeway gets ground truth, how conflicts are settled, and what DATA_DEGRADED means.",
  alternates: { canonical: "/docs/data-sources" },
  openGraph: { title: "Data sources — kedgeway docs", description: "Where kedgeway gets ground truth, how conflicts are settled, and what DATA_DEGRADED means.", url: "/docs/data-sources", images: [{ url: "/docs/opengraph-image", width: 1200, height: 630 }] },
};

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
            <tr><th scope="row"><code>stellarDocs.search_docs</code></th><td>Upgrade and migration notes. The top five hits (title, URL, a short snippet) are collected into the snapshot. The current report does not print them.</td></tr>
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
      <PrevNext href="/docs/data-sources" />
    </>
  );
}
