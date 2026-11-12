import type { PageMetaDict, Rich } from "./common";

export type FindingCode =
  | "SDK_DEPRECATED"
  | "SDK_BEHIND"
  | "SDK_CURRENT"
  | "SDK_UNKNOWN"
  | "JS_SDK_DEPRECATED"
  | "JS_SDK_BEHIND"
  | "JS_SDK_CURRENT"
  | "JS_SDK_UNKNOWN"
  | "JS_LEGACY_PACKAGE"
  | "MANIFEST_UNPARSEABLE"
  | "DATA_DEGRADED"
  | "NO_SDK_FOUND"
  | "CLI_DEPRECATED"
  | "CLI_BEHIND"
  | "CLI_CURRENT"
  | "CLI_UNKNOWN"
  | "RUST_TARGET_LEGACY"
  | "RUST_TOOLCHAIN_OLD";

export interface DocsFindingsDict {
  meta: PageMetaDict;
  h1: string;
  lede: Rich;
  lockfile: Rich;
  js: Rich;
  labels: { meaning: string; evidence: string; todo: string };
  /** One entry per finding code. Evidence strings in <code> are CLI output and stay English. */
  findings: Record<FindingCode, { meaning: Rich; evidence: Rich; todo: Rich }>;
}
