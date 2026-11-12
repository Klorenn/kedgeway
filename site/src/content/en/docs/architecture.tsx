import type { DocsArchitectureDict } from "../../schema/docs-architecture";
import { linkFor } from "@/i18n/Link";

const L = linkFor("en");

export default {
  meta: { title: "Architecture — kedgeway docs", description: "How kedgeway is organized: pure core, ports, adapters and the CLI." },
  h1: "Architecture",
  lede: <>kedgeway is hexagonal: the rules are pure, and everything that touches the outside world sits behind a port.</>,
  cols: { layer: "Layer", files: "Files", role: "Role" },
  layers: {
    core: <>Pure functions. <code>repo-facts</code> parses manifests and versions; <code>diagnose</code> turns facts and a snapshot into findings. No I/O.</>,
    ports: <><code>EcosystemPort</code>: one method, <code>fetchSnapshot()</code>, returning an ecosystem snapshot.</>,
    adapters: <><code>fs-repo-scanner</code> walks the repo. <code>raven-ecosystem</code>, <code>raven-auth</code> and <code>raven-parse</code> are the Raven MCP client, OAuth and result parser. <code>fake-ecosystem</code> loads fixtures.</>,
    cli: <>Commands, flags, report formatting and exit codes. Wires adapters to the core.</>,
  },
  flowH: "Flow of one run",
  flow: {
    scan: <>The scanner produces <em>repo facts</em>: Rust and JavaScript dependencies plus manifest errors.</>,
    port: <>An <code>EcosystemPort</code> (Raven, or the fake from a fixture) produces a snapshot.</>,
    diagnose: <><code>diagnose(facts, snapshot)</code> returns findings and a summary.</>,
    print: <>The CLI prints them and computes the exit code.</>,
  },
  testsH: "Tests",
  tests: <>Tests sit next to the code as <code>*.test.ts</code> and run with Vitest (<code>npm test</code>). Development is test-first: write the failing test, then the rule.</>,
  ruleH: "Adding a rule",
  rule: {
    test: <>Write a failing test in <code>src/core/diagnose.test.ts</code> with the facts and snapshot that should trigger it.</>,
    logic: <>Add the logic to <code>src/core/diagnose.ts</code>, returning a finding with a severity, code, message, file and evidence that cites the snapshot source.</>,
    parser: <>If the rule needs a new input, extend the parser in <code>src/core/repo-facts.ts</code> first, with tests.</>,
    docs: <>Document the code on the <L to="/docs/findings">Findings</L> page.</>,
  },
} satisfies DocsArchitectureDict;
