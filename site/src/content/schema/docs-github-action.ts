import type { PageMetaDict, Rich } from "./common";

export type ActionInput = "mode" | "path" | "repo" | "fail-on" | "fixture" | "auth" | "json" | "sarif" | "version" | "annotations" | "pr-base" | "pr-branch" | "pr-draft" | "refresh-lockfiles" | "token";

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
  prH: string;
  pr: Rich;
  prRequirementsP: Rich;
  prRequirements: Record<"permissions" | "checkout" | "credentials" | "concurrency" | "host" | "lockfiles" | "setting", Rich>;
  prExample: Rich;
  prOutputs: Rich;
  sarifH: string;
  sarif: Rich;
  exitH: string;
  exit: Rich;
  exitPr: Rich;
}
