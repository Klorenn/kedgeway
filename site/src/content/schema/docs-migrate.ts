import type { PageMetaDict, Rich } from "./common";

export interface DocsMigrateDict {
  meta: PageMetaDict;
  h1: string;
  lede: Rich;
  guideH: string;
  guideIntro: Rich;
  guide: { where: Rich; steps: Rich; legacy: Rich; docs: Rich };
  runH: string;
  changesH: string;
  changes: { rust: Rich; js: Rich; legacy: Rich; aliases: Rich };
  refusesH: string;
  refuses: { base: Rich; noRun: Rich; git: Rich; manual: Rich; exact: Rich };
  lockfilesH: string;
  lockfiles: { resolved: Rich; refresh: Rich; reminder: Rich };
  exitH: string;
  exitCols: { code: string; meaning: string };
  exit: { ok: Rich; gate: Rich; error: Rich };
  warning: Rich;
}
