import type { PageMetaDict, Rich } from "./common";

export type LimitationId = "lockfile" | "annotations" | "deviceCode" | "sample" | "docsPage" | "raven" | "migration" | "versions" | "scan" | "platforms";

export interface DocsLimitationsDict {
  meta: PageMetaDict;
  h1: string;
  lede: Rich;
  note: Rich;
  items: Record<LimitationId, { term: string; detail: Rich }>;
}
