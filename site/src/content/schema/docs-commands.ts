import type { PageMetaDict, Rich } from "./common";

export type DiagnoseFlag = "ref" | "json" | "format" | "sarif" | "annotations" | "offline" | "noCache" | "maxAge" | "fixture" | "failOn";
export type DoctorCheck = "node" | "auth" | "cache" | "stellar" | "raven";

export interface DocsCommandsDict {
  meta: PageMetaDict;
  h1: string;
  lede: Rich;
  versionP: Rich;
  diagnoseP: Rich;
  diagnoseFlags: Record<DiagnoseFlag, Rich>;
  initP: Rich;
  initFlags: Record<"force" | "print", Rich>;
  initExit: Rich;
  loginP: Rich;
  loginNoBrowser: Rich;
  loginExport: Rich;
  logoutP: Rich;
  doctorP: Rich;
  doctorChecks: Record<DoctorCheck, Rich>;
  doctorExit: Rich;
  migrateP: Rich;
  migrateRemote: Rich;
  mcpP: Rich;
  exitH: string;
  exitHead: { code: string; meaning: string };
  exitRows: Record<"0" | "1" | "2", Rich>;
  exitAfter: Rich;
}
