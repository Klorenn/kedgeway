import type { PageMetaDict, Rich } from "./common";

export type McpTool = "diagnose" | "findings_reference" | "migrate" | "ecosystem_snapshot";

export interface DocsMcpDict {
  meta: PageMetaDict;
  h1: string;
  lede: Rich;
  toolsH: string;
  cols: { tool: string; input: string; returns: string };
  /** Shown in the Input column for tools that take no input. */
  none: string;
  returns: Record<McpTool, Rich>;
  remoteH: string;
  remote: Rich;
  remoteDry: Rich;
  configH: string;
  config: Rich;
  loginH: string;
  loginWarning: Rich;
  loginBody: Rich;
}
