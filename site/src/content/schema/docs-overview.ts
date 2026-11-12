import type { PageMetaDict, Rich } from "./common";

export interface DocsOverviewDict {
  meta: PageMetaDict;
  h1: string;
  lede: Rich;
  isH: string;
  is: { cli: Rich; grounded: Rich; evidence: Rich; honest: Rich };
  isNotH: string;
  isNot: { rewriter: Rich; lockfile: Rich; audit: Rich; service: Rich };
  thinksH: string;
  thinks: { scan: Rich; ask: Rich; diagnose: Rich };
  nextH: string;
}
