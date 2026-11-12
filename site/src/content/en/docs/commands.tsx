import type { DocsCommandsDict } from "../../schema/docs-commands";
import { linkFor } from "@/i18n/Link";

const L = linkFor("en");

export default {
  meta: { title: "Commands — kedgeway docs", description: "Every kedgeway command, flag and exit code." },
  h1: "Commands",
  lede: <>Seven commands: <code>diagnose</code>, <code>init</code>, <code>login</code>, <code>logout</code>, <code>doctor</code>, <code>migrate</code> and <code>mcp</code>. Plus <code>--version</code>.</>,
  versionP: <>Prints the installed version, read from <code>package.json</code>, and exits with 0.</>,
  diagnoseP: <>Scans the repo at <code>path-or-url</code> (default: the current directory), fetches ecosystem data, and prints a report. Raven is used unless you pass <code>--fixture</code>. The source is a local path, a git URL (<code>https://</code>, <code>ssh://</code> or <code>git@host:owner/repo</code>) or the GitHub shorthand <code>owner/repo</code>. An existing local directory takes precedence over the shorthand. A remote source is shallow-cloned into a temporary directory and deleted afterwards. See <L to="/docs/what-it-scans#remote-repositories">Remote repositories</L>.</>,
  diagnoseFlags: {
    ref: <>Branch or tag to scan when the source is a remote repository. It may repeat the <code>/tree/&lt;ref&gt;</code> of the URL but not contradict it. With a local path it is an error and exits with 1. Also on <code>migrate</code>.</>,
    json: <>Print the diagnosis as JSON instead of text. The object has <code>findings</code> (each with <code>severity</code>, <code>code</code>, <code>message</code>, <code>file</code>, <code>evidence</code>) and <code>summary</code> (<code>critical</code>, <code>warning</code>, <code>info</code>).</>,
    format: <>Choose the stdout format. <code>--json</code> is the same as <code>--format json</code>; using both exits with 1. <code>annotations</code> prints one GitHub workflow command per finding (<code>::error</code>, <code>::warning</code>, <code>::notice</code>, with the manifest file and line), then the normal text report.</>,
    sarif: <>Also write a SARIF 2.1.0 log to <code>file</code>. Stdout still follows <code>--format</code>.</>,
    annotations: <>Also write the GitHub annotations to <code>file</code>. Stdout still follows <code>--format</code>. The line is a best-effort scan of the manifest. See <L to="/docs/github-action">GitHub Action</L>.</>,
    offline: <>Use the cached ecosystem snapshot only and never call Raven. Exits 1 if there is no cache; contradicts <code>--no-cache</code>; ignored with a warning when <code>--fixture</code> is set. Also on <code>migrate</code>. On <code>doctor</code> the same flag only skips the Raven reachability check.</>,
    noCache: <>Ignore the cached snapshot and fetch live. The result is still written to the cache. Also on <code>migrate</code>.</>,
    maxAge: <>How old a cached snapshot may be before it is refetched: <code>30s</code>, <code>15m</code>, <code>24h</code>, <code>2d</code>. Default <code>24h</code>. Also on <code>migrate</code>. See <L to="/docs/data-sources">Data sources</L>.</>,
    fixture: <>Read the ecosystem snapshot from a JSON file instead of calling Raven. No login needed. See <L to="/docs/fixtures">Fixtures</L>.</>,
    failOn: <>Exit with code 2 if any finding is at or above <code>critical</code>, <code>warning</code> or <code>info</code>. Any other value is an error and exits with 1.</>,
  },
  initP: <>Writes <code>.github/workflows/kedgeway.yml</code> under <code>path</code> (default: the current directory). The workflow runs on pushes to <code>main</code> or <code>master</code> and on pull requests, and uses <code>Klorenn/kedgeway@v&lt;installed version&gt;</code> with <code>path: .</code>, <code>fail-on: warning</code> and <code>auth: $&#123;&#123; secrets.KEDGEWAY_AUTH &#125;&#125;</code>. Afterwards, create the <code>KEDGEWAY_AUTH</code> repository secret from the output of <code>kedgeway login --export</code>. See <L to="/docs/github-action#quick-start">GitHub Action</L>.</>,
  initFlags: {
    force: <>Overwrite an existing workflow file. Without it, an existing file is left as is and the command exits with 1.</>,
    print: <>Print the workflow YAML to stdout and write nothing.</>,
  },
  initExit: <>Exit 0 on success. Exit 1 if the file exists and <code>--force</code> is not set, or if the write fails.</>,
  loginP: <>Starts a fresh OAuth authorization with Stellar Raven and stores the token. Prints <code>Logged in to Stellar Raven.</code> on success. See <L to="/docs/authentication">Authentication</L>.</>,
  loginNoBrowser: <><code>login --no-browser</code> is for machines without a browser. It prints the authorization URL instead of opening it. Open the URL anywhere, sign in, then paste the redirect URL (or just its <code>code</code>) back into the terminal. A pasted URL is checked against the login attempt&apos;s OAuth state; a bare code carries none. Or forward the callback port with <code>ssh -L</code> and let the redirect land on kedgeway directly. It combines with <code>--export</code>. See <L to="/docs/authentication#headless">Headless login</L>.</>,
  loginExport: <><code>login --export</code> prints your stored credentials as a base64 secret for CI and removes nothing. It logs in first only when nothing is stored, and it opens a browser unless you also pass <code>--no-browser</code>. Stdout is the secret; stderr warns that it is one. If <code>KEDGEWAY_AUTH</code> is already set in the environment, that value is ignored and the stored login is what gets exported. Put the output in a <code>KEDGEWAY_AUTH</code> secret. See <L to="/docs/ci">CI</L>.</>,
  logoutP: <>Deletes the stored credentials. It prints whether anything was removed and exits with 0 either way.</>,
  doctorP: <>A self-check that changes nothing. It prints one line per check, <code>ok</code>, <code>warn</code>, <code>fail</code> or <code>skip</code>:</>,
  doctorChecks: {
    node: <>Node version (22.12 or newer).</>,
    auth: <>Auth: a valid <code>KEDGEWAY_AUTH</code> in the environment, an <code>auth.json</code> with tokens, or none.</>,
    cache: <>Snapshot cache: path and age.</>,
    stellar: <>Stellar CLI: runs <code>stellar --version</code> without a shell (5 second timeout). Not installed is <code>warn</code>, since it is optional (<a href="https://developers.stellar.org/docs/tools/cli/install-cli">install guide</a>). With a cached snapshot, the current major or newer is <code>ok</code>, one major behind is <code>warn</code>, and two or more is <code>fail</code>. With <code>--offline</code> or no snapshot it is <code>ok</code> and only reports the installed version.</>,
    raven: <>Raven reachability: one cheap <code>search</code> call with a 10 second timeout. <code>--offline</code> skips it. It uses a read-only copy of your credentials, so a token refresh cannot modify <code>auth.json</code>.</>,
  },
  doctorExit: <>Exit 0 when nothing failed (warnings do not fail it), 1 when any check failed.</>,
  migrateP: <>Prints a migration guide and a unified diff of SDK version bumps. The default is a dry run, and <code>--dry-run</code> is that same mode made explicit. <code>--write</code> applies the manifest edits. Passing both <code>--dry-run</code> and <code>--write</code> exits 1. <code>--offline</code>, <code>--no-cache</code> and <code>--max-age</code> behave as they do on <code>diagnose</code>. Exit 0 for nothing to do, a manual-only dry run, or edits applied; 2 for a dry run with at least one automatic edit, or a write where some step was skipped; 1 on error, including a refused write. It edits manifests only and notes any lockfile it leaves stale, with a manual step to refresh it. See <L to="/docs/migrate">Migration guide</L>.</>,
  migrateRemote: <><code>path-or-url</code> accepts the same sources as <code>diagnose</code>. Migrating a remote source is a dry run only: <code>--write</code> exits with 2 and prints <code>remote sources are dry-run only; clone it and run migrate locally</code>.</>,
  mcpP: <>Runs an MCP server over stdio. It never starts OAuth: log in first. <code>--allow-write</code> lets the migrate tool edit files; without it, <code>write: true</code> returns an error and dry runs still work. See <L to="/docs/mcp">MCP server</L>.</>,
  exitH: "Exit codes",
  exitHead: { code: "Code", meaning: "Meaning" },
  exitRows: {
    "0": <><code>diagnose</code>: finished, and no <code>--fail-on</code> threshold was hit. <code>migrate</code>: nothing to do, only manual steps, or the edits were applied. <code>init</code>: the workflow was written, or printed with <code>--print</code>. <code>doctor</code> and <code>logout</code>: finished. A <code>warn</code> from <code>doctor</code> still exits 0.</>,
    "1": <>Tool error: an invalid flag (including <code>--fail-on</code>, <code>--format</code> or <code>--max-age</code>), <code>--json</code> combined with <code>--format</code>, <code>--offline</code> with <code>--no-cache</code>, a login failure, a failed <code>doctor</code> check, <code>init</code> finding an existing workflow without <code>--force</code> or failing to write it, or a scan or network failure.</>,
    "2": <><code>diagnose</code>: a finding met <code>--fail-on</code>. <code>migrate</code>: a dry run has an automatic edit, <code>--write</code> skipped a step, or <code>--write</code> was passed with a remote source. <code>doctor</code> never exits 2.</>,
  },
  exitAfter: <><code>logout</code> exits 0 whether or not a credentials file was deleted. <code>--help</code> exits 0. An unknown command or flag exits 1.</>,
} satisfies DocsCommandsDict;
