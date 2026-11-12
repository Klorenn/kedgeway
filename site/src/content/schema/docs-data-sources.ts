import type { PageMetaDict, Rich } from "./common";

export interface DocsDataSourcesDict {
  meta: PageMetaDict;
  h1: string;
  lede: Rich;
  askH: string;
  askCols: { source: string; usedFor: string };
  ask: { docPage: { source: Rich; use: Rich }; scout: { source: Rich; use: Rich }; search: { source: Rich; use: Rich } };
  winsH: string;
  wins: { docs: Rich; scout: Rich; behind: Rich };
  provenanceH: string;
  provenance: Rich;
  degradedH: string;
  degradedIntro: Rich;
  degradedFallback: Rich;
  cacheH: string;
  cacheIntro: Rich;
  cacheCols: { situation: string; happens: string };
  cache: { fresh: { label: Rich; text: Rich }; stale: { label: Rich; text: Rich }; offline: Rich; noCache: Rich; maxAge: Rich };
  cacheNotes: { degraded: Rich; flags: Rich; global: Rich };
}
