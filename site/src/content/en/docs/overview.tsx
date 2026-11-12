import type { DocsOverviewDict } from "../../schema/docs-overview";
import { linkFor } from "@/i18n/Link";

const L = linkFor("en");

export default {
  meta: { title: "Overview — kedgeway docs", description: "What kedgeway is and is not, how it thinks, and where to read next." },
  h1: "Overview",
  lede: <>kedgeway is a command-line tool that tells you how outdated a Stellar or Soroban repo&apos;s toolchain is. It reads your manifests, asks the live ecosystem what is current, and reports the gap with its sources.</>,
  isH: "What it is",
  is: {
    cli: <>A CLI that scans <code>Cargo.toml</code> (<code>soroban-sdk</code>) and <code>package.json</code> (<code>@stellar/stellar-sdk</code>, <code>@stellar/stellar-base</code>, and the legacy <code>soroban-client</code> and <code>stellar-sdk</code>).</>,
    grounded: <>Grounded in live data from the Stellar Raven MCP server: the official Software Versions page and the Scout ecosystem toolchain index.</>,
    evidence: <>Evidence-first. Every finding cites its source and the time it was observed.</>,
    honest: <>Honest about failure. If a source cannot be reached, the report says <code>DATA_DEGRADED</code> instead of guessing.</>,
  },
  isNotH: "What it is not",
  isNot: {
    rewriter: <>Not a rewriter. <code>diagnose</code> never changes your repo. <L to="/docs/migrate">Migration</L> prints a guide and bumps version strings. It never runs <code>cargo</code> or <code>npm</code>.</>,
    lockfile: <>Not a full lockfile auditor. It uses the resolved version of the direct dependency when a supported lockfile has one verdict, and falls back to the manifest otherwise.</>,
    audit: <>Not a security or contract audit. It only measures SDK version drift.</>,
    service: <>Not a service. Your repo contents never leave your machine. See <L to="/docs/authentication">Authentication</L>.</>,
  },
  thinksH: "How it thinks",
  thinks: {
    scan: <><strong>Scan.</strong> Walk the repo and collect SDK dependencies from manifests.</>,
    ask: <><strong>Ask Raven.</strong> Fetch the current versions and the deprecated sample once per run.</>,
    diagnose: <><strong>Diagnose.</strong> Compare each dependency with the ecosystem and print findings by severity.</>,
  },
  nextH: "Where to read next",
} satisfies DocsOverviewDict;
