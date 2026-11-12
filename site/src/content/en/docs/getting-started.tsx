import type { DocsGettingStartedDict } from "../../schema/docs-getting-started";
import { linkFor } from "@/i18n/Link";

const L = linkFor("en");

export default {
  meta: { title: "Getting started — kedgeway docs", description: "Install kedgeway from npm, log in, and run your first diagnosis." },
  h1: "Getting started",
  lede: <>Five minutes from install to your first report. You need Node.js 22.12 or newer.</>,
  installH: "Install",
  installP: <>Install the CLI. It needs Node.js 22.12 or newer.</>,
  hack: <>To hack on it, clone <a href="https://github.com/Klorenn/kedgeway">Klorenn/kedgeway</a>, then <code>npm ci</code>, <code>npm run build</code> and <code>npm link</code>.</>,
  check: <>Check it worked:</>,
  loginH: "Log in",
  loginP: <>This opens your browser to authorize kedgeway with Stellar Raven. The authorization URL is also printed to the terminal, in case the browser does not open. You only do this once; the token is stored locally. Details are in <L to="/docs/authentication">Authentication</L>.</>,
  runH: "Run your first diagnosis",
  runP: <>The path is optional and defaults to the current directory. kedgeway walks the repo, fetches live ecosystem data, and prints a report.</>,
  readH: "Read the output",
  defs: {
    header: { dt: "Header", dd: <>The root that was scanned, and the current soroban-sdk major with the time it was observed.</> },
    finding: { dt: "Each finding", dd: <>Severity, code and file on the first line, then what it means, then the evidence and its source.</> },
    summary: { dt: "Summary", dd: <>Counts by severity.</> },
  },
  codes: <>Every code is explained in <L to="/docs/findings">Findings</L>. In the example, <code>&lt;source&gt;</code> and <code>&lt;time&gt;</code> stand in for the real source string and timestamp.</>,
  note: <>Use <code>--json</code> for machine-readable output and <code>--fail-on</code> to turn findings into an exit code. See <L to="/docs/commands">Commands</L>.</>,
} satisfies DocsGettingStartedDict;
