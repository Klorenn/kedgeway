import type { DocsDataSourcesDict } from "../../schema/docs-data-sources";

export default {
  meta: { title: "Data sources — kedgeway docs", description: "Where kedgeway gets ground truth, how conflicts are settled, and what DATA_DEGRADED means." },
  h1: "Data sources",
  lede: <>kedgeway does not ship a list of versions. Each run asks the Stellar Raven MCP server (<code>https://raven.stellar.org/mcp</code>) in a single call.</>,
  askH: "What it asks for",
  askCols: { source: "Source", usedFor: "Used for" },
  ask: {
    docPage: { source: <><code>stellarDocs.get_doc_page</code> on <code>/docs/networks/software-versions</code></>, use: <>The official Software Versions page: the current soroban-sdk, the current JavaScript SDK and the protocol version.</> },
    scout: { source: <><code>scout.analyzeEcosystem</code> (toolchain)</>, use: <>The Scout ecosystem toolchain index: a sample of repos on deprecated soroban-sdk versions.</> },
    search: { source: <><code>stellarDocs.search_docs</code></>, use: <>Upgrade and migration notes. The top five hits (title, URL, a short snippet) are collected into the snapshot. <code>diagnose</code> does not print them. <code>migrate</code> cites a hit only when its title or url is a migration document.</> },
  },
  winsH: "Which source wins",
  wins: {
    docs: <>The official docs page is the authority for what is current.</>,
    scout: <>Scout&apos;s deprecated list is a <strong>sample, capped at 50</strong>. A Scout entry only counts when it is below the current major from the docs.</>,
    behind: <>A dependency more than one major behind is treated as deprecated even if Scout does not list it.</>,
  },
  provenanceH: "Provenance on every finding",
  provenance: <>Every finding cites its source and the time it was observed. The report header shows the current soroban-sdk major and the observation time, an ISO 8601 UTC timestamp taken when the run asked Raven.</>,
  degradedH: "DATA_DEGRADED",
  degradedIntro: <>If a source fails or returns something kedgeway cannot read, the run does not stop and does not guess. It records a note, and each note becomes a DATA_DEGRADED finding. Notes name the source, for example:</>,
  degradedFallback: <>When the current soroban-sdk major is missing, repo findings fall back to SDK_UNKNOWN and no deprecation claim is made.</>,
  cacheH: "Snapshot cache",
  cacheIntro: <>After every successful Raven fetch, kedgeway writes the ecosystem snapshot to <code>$XDG_CACHE_HOME/kedgeway/snapshot.json</code> (by default <code>~/.cache/kedgeway/</code>, file mode 0600, folder 0700). Later runs reuse it.</>,
  cacheCols: { situation: "Situation", happens: "What happens" },
  cache: {
    fresh: { label: <>Fresh cache</>, text: <>Younger than <code>--max-age</code> (default <code>24h</code>) and not dated in the future: used without calling Raven.</> },
    stale: { label: <>Stale cache</>, text: <>Refetched. If Raven then fails, the stale cache is used and a <code>DATA_DEGRADED</code> finding says <code>using cached snapshot from &lt;observedAt&gt;</code>.</> },
    offline: <>Never calls Raven. Exits 1 if there is no cache. A stale cache is used with a <code>DATA_DEGRADED</code> finding such as <code>snapshot is N hours old</code>.</>,
    noCache: <>Skips reading the cache and the failure fallback, but still writes the fresh snapshot.</>,
    maxAge: <>How old a cached snapshot may be: <code>30s</code>, <code>15m</code>, <code>24h</code> or <code>2d</code>.</>,
  },
  cacheNotes: {
    degraded: <>A snapshot that carries <code>DATA_DEGRADED</code> notes is never written to the cache, and a cached one that carries notes counts as stale.</>,
    flags: <><code>--offline</code> with <code>--no-cache</code> is rejected (exit 1). <code>--offline</code> is ignored, with a warning, when <code>--fixture</code> is set. <code>--fixture</code> bypasses the cache entirely.</>,
    global: <>The cache is a single global file. <code>--max-age</code> applies to its <code>observedAt</code>.</>,
  },
} satisfies DocsDataSourcesDict;
