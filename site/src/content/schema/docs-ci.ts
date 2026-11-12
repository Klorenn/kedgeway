import type { PageMetaDict, Rich } from "./common";

export interface DocsCiDict {
  meta: PageMetaDict;
  h1: string;
  lede: Rich;
  exitH: string;
  exit: Record<"ok" | "error" | "drift", Rich>;
  threshold: Rich;
  liveH: string;
  liveP: Rich;
  secretP: Rich;
  warning: Rich;
  noSecret: Rich;
  exampleH: string;
  exampleP: Rich;
  exampleAfter: Rich;
}
