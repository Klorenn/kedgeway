import type { PageMetaDict, Rich } from "./common";

export type FixtureField =
  | "observedAt"
  | "currentMajor"
  | "deprecatedVersions"
  | "sorobanSource"
  | "currentVersion"
  | "jsSource"
  | "protocolCurrent"
  | "notes"
  | "degraded";

export interface DocsFixturesDict {
  meta: PageMetaDict;
  h1: string;
  lede: Rich;
  shapeH: string;
  cols: { field: string; type: string; notes: string };
  /** Type column (prose types like "integer or null") and notes, per field. */
  fields: Record<FixtureField, { type: string; notes: Rich }>;
  exampleH: string;
  after: Rich;
}
