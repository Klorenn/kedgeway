import type { PageMetaDict, Rich } from "./common";

export type FaqId = "privacy" | "login" | "changes" | "headless" | "offline" | "unknown" | "lockfile" | "failOn" | "npm";

export interface DocsFaqDict {
  meta: PageMetaDict;
  h1: string;
  items: Record<FaqId, { q: string; a: Rich }>;
}
