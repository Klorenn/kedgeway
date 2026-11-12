import type { DocsFaqDict } from "../../schema/docs-faq";
import { linkFor } from "@/i18n/Link";

const L = linkFor("en");

export default {
  meta: { title: "FAQ — kedgeway docs", description: "Short answers to common questions about kedgeway." },
  h1: "FAQ",
  items: {
    privacy: { q: "Does kedgeway send my code anywhere?", a: "No. It sends one fixed script to Stellar Raven, with nothing from your repo in it. The comparison happens on your machine." },
    login: { q: "Why do I have to log in?", a: "Live ecosystem data comes from the Stellar Raven MCP server, which requires OAuth. You log in once; the token is stored at ~/.config/kedgeway/auth.json." },
    changes: { q: "Does it change my repo?", a: "diagnose never does. kedgeway migrate is a dry run unless you pass --write, and it refuses to write over uncommitted git changes." },
    headless: { q: "Can I log in on a server without a browser?", a: <>Yes. <code>kedgeway login --no-browser</code> prints the URL; sign in anywhere and paste the redirect URL or code back, or forward the callback port with <code>ssh -L</code>. See <L to="/docs/authentication#headless">Authentication</L>.</> },
    offline: { q: "Can I run it offline?", a: <>Yes. <code>--offline</code> reuses the cached Raven snapshot from your last live run, and <code>--fixture</code> uses a snapshot file. See <L to="/docs/data-sources">Data sources</L> and <L to="/docs/fixtures">Fixtures</L>.</> },
    unknown: { q: "Why do I get SDK_UNKNOWN?", a: <>Either the version in your manifest cannot be read as a single major (for example an upper bound or a compound range), or the current major was unavailable. See <L to="/docs/what-it-scans">What it scans</L> and <L to="/docs/findings#data_degraded">DATA_DEGRADED</L>.</> },
    lockfile: { q: "Does it read my lockfile?", a: <>Yes, when one is present. <code>Cargo.lock</code>, <code>package-lock.json</code>, <code>pnpm-lock.yaml</code> and <code>yarn.lock</code> supply the resolved version of each direct dependency, and that version is what the comparison uses. If the lockfile is missing or ambiguous, kedgeway falls back to the manifest and says so. See <L to="/docs/what-it-scans">What it scans</L>.</> },
    failOn: { q: "Which --fail-on should I use in CI?", a: <><code>critical</code> fails on deprecated SDKs and legacy packages. <code>warning</code> also fails on one-major-behind and unknowns. See <L to="/docs/ci">CI</L>.</> },
    npm: { q: "Is it on npm?", a: "Yes. npm install -g kedgeway. It needs Node 22.12 or newer." },
  },
} satisfies DocsFaqDict;
