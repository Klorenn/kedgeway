import type { PageMetaDict, Rich } from "./common";

export type ActionInput = "path" | "repo" | "fail-on" | "fixture" | "auth" | "json" | "sarif" | "version" | "annotations";

export interface DocsGithubActionDict {
  meta: PageMetaDict;
  h1: string;
  lede: Rich;
  quickH: string;
  quick: Rich;
  useH: string;
  pin: Rich;
  ioH: string;
  cols: { input: string; default: string; meaning: string };
  /** Default column (code values or prose like "none") and meaning, per input. */
  inputs: Record<ActionInput, { def: Rich; meaning: Rich }>;
  outputs: Rich;
  requiredH: string;
  required: Rich;
  requiredItems: { auth: Rich; fixture: Rich };
  staleWarning: Rich;
  annotationsH: string;
  annotations: Rich;
  annotationItems: { caps: Rich; noFile: Rich; line: Rich; sanitised: Rich };
  annotationsOutside: Rich;
  sarifH: string;
  sarif: Rich;
  exitH: string;
  exit: Rich;
}
