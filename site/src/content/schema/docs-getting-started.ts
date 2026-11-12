import type { PageMetaDict, Rich } from "./common";

export interface DocsGettingStartedDict {
  meta: PageMetaDict;
  h1: string;
  lede: Rich;
  installH: string;
  installP: Rich;
  hack: Rich;
  check: Rich;
  loginH: string;
  loginP: Rich;
  runH: string;
  runP: Rich;
  readH: string;
  defs: Record<"header" | "finding" | "summary", { dt: string; dd: Rich }>;
  codes: Rich;
  note: Rich;
}
