import type { Rich } from "./common";

export type EcoStatus = "deprecated" | "current" | "supported" | "unknown";
export type LandingFindingCode = "SDK_DEPRECATED" | "JS_LEGACY_PACKAGE" | "SDK_BEHIND" | "MANIFEST_UNPARSEABLE" | "DATA_DEGRADED" | "NO_SDK_FOUND";
export type LandingFaqId = "privacy" | "account" | "offline" | "sdks" | "ci" | "install";
export type WayId = "sdk" | "mcp" | "action" | "migrate";
export interface Figure { caption: string; description: string }

export interface LandingDict {
  meta: { title: string; description: string; ogTitle: string; ogDescription: string };
  hero: { overline: string; title: string; sub: string; cta: string; docs: string; proofStrong: string; proofRest: string };
  eco: {
    rule: string; h: string; h2: string; body: Rich; chartTitle: string; fig2: Figure;
    tableLabel: string; tableCaption: string; colStatus: string; colRepos: string; colShare: string;
    status: Record<EcoStatus, string>; source: string;
    stats: { scanned: string; deprecated: string; share: string; major: string };
  };
  how: {
    rule: string; h: string; h2: string; body: Rich; fig3: Figure;
    steps: { scan: [string, string]; ask: [string, string]; diagnose: [string, string] };
    worksWith: string;
  };
  report: {
    rule: string; h: string; h2: string; body: Rich; fig4: Figure; blockLabel: string;
    srIntro: string; srCritical1: string; srCritical2: string; srSummary: string;
  };
  findings: {
    rule: string; h: string; h2: string; body: string; fig5: Figure; blockLabel: string;
    tableCaption: string; colCode: string; colSeverity: string; colMeaning: string;
    rows: Record<LandingFindingCode, string>; all: string;
  };
  install: { rule: string; h: string; h2: string; body: string; note: Rich; fig6: Figure; codeLabel: string };
  faq: { rule: string; h: string; h2: string; fig7: Figure; items: Record<LandingFaqId, [string, string]> };
  ways: { rule: string; h: string; h2: string; fig8: Figure; cta: string; items: Record<WayId, [string, string]> };
  cta: { figCaption: string; h: string; h2: string; primary: string; docs: string; installLabel: string };
}
