import type { PageMetaDict, Rich } from "./common";

export interface DocsArchitectureDict {
  meta: PageMetaDict;
  h1: string;
  lede: Rich;
  cols: { layer: string; files: string; role: string };
  layers: { core: Rich; ports: Rich; adapters: Rich; cli: Rich };
  flowH: string;
  flow: { scan: Rich; port: Rich; diagnose: Rich; print: Rich };
  testsH: string;
  tests: Rich;
  ruleH: string;
  rule: { test: Rich; logic: Rich; parser: Rich; docs: Rich };
}
