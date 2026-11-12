import type { PageMetaDict, Rich } from "./common";

export type SdkExport =
  | "diagnose"
  | "diagnoseDetailed"
  | "scanRepo"
  | "diagnoseRepo"
  | "createRavenEcosystem"
  | "fixtures"
  | "planMigration"
  | "buildGuide"
  | "findImportHits"
  | "applyMigration"
  | "migrate"
  | "toSarif"
  | "toAnnotations";

export interface DocsSdkDict {
  meta: PageMetaDict;
  h1: string;
  lede: Rich;
  installH: string;
  install: Rich;
  esmWarning: Rich;
  apiH: string;
  cols: { export: string; does: string };
  api: Record<SdkExport, Rich>;
  types: Rich;
  exampleH: string;
  live: Rich;
}
