import type { DocsGithubActionDict } from "../../schema/docs-github-action";
import { linkFor } from "@/i18n/Link";

const L = linkFor("en");

export default {
  meta: { title: "GitHub Action — kedgeway docs", description: "Run kedgeway in GitHub Actions and fail a build on SDK drift." },
  h1: "GitHub Action",
  lede: <>Run kedgeway on every pull request and fail the build when a finding meets your threshold.</>,
  quickH: "Quick start",
  quick: <>This writes <code>.github/workflows/kedgeway.yml</code>, pinned to the installed version. Then add the secret: run <code>kedgeway login --export</code> and save its output as a repository secret named <code>KEDGEWAY_AUTH</code>. Use <code>--print</code> to preview the YAML and <code>--force</code> to overwrite an existing file. See <L to="/docs/commands#init">Commands</L>.</>,
  useH: "Use it",
  pin: <>Pin a release tag as above. <code>@main</code> is unpinned and can change under you.</>,
  ioH: "Inputs and outputs",
  cols: { input: "Input", default: "Default", meaning: "Meaning" },
  inputs: {
    path: { def: <code>.</code>, meaning: <>Directory to scan.</> },
    repo: { def: "none", meaning: <>Repository URL or <code>owner/repo</code> to scan instead of <code>path</code>. It is shallow-cloned and deleted afterwards. Annotations are not emitted for it, because its paths are not in the checkout.</> },
    "fail-on": { def: <code>warning</code>, meaning: <>Fail on any finding at or above this severity. Empty disables.</> },
    fixture: { def: "none", meaning: <>Ecosystem snapshot JSON (offline). Set this <strong>or</strong> <code>auth</code>.</> },
    auth: { def: "none", meaning: <>Raven credentials from <code>kedgeway login --export</code>, as a secret. Set this <strong>or</strong> <code>fixture</code>.</> },
    json: { def: <code>false</code>, meaning: <>Print JSON instead of text.</> },
    sarif: { def: <code>false</code>, meaning: <>Also write SARIF 2.1.0 to <code>$RUNNER_TEMP/kedgeway.sarif</code>.</> },
    version: { def: "the pinned tag", meaning: <>kedgeway version to run. Accepts a semver such as <code>1.2.3</code>, or <code>source</code> to force the source build.</> },
    annotations: { def: "on in Actions", meaning: <>Emit a GitHub annotation, with file and line, for each finding. Set <code>&quot;false&quot;</code> to disable.</> },
  },
  outputs: <>Outputs: <code>summary</code> (for example <code>critical=0 warning=1 info=2</code>) <code>report-json</code> (the path of the JSON report under <code>RUNNER_TEMP</code>) and <code>sarif</code> (the SARIF file path, only when <code>sarif</code> is on).</>,
  requiredH: "Auth or a fixture is required",
  required: <>The action needs one of two inputs, and names both if neither is set.</>,
  requiredItems: {
    auth: <><code>auth</code>: your <code>KEDGEWAY_AUTH</code> secret, for live Raven data. Export it with <code>kedgeway login --export</code>.</>,
    fixture: <><code>fixture</code>: a committed snapshot (see <L to="/docs/fixtures">Fixtures</L>). Offline and deterministic; you refresh it.</>,
  },
  staleWarning: <>The secret refreshes in memory only. If Raven rotates refresh tokens, the secret can go stale and must be re-exported when runs start failing. Treat it like a password.</>,
  annotationsH: "Annotations",
  annotations: <>With <code>annotations</code> on, which is the default when the action runs on GitHub, each finding becomes a workflow command pointing at the dependency&apos;s line in its manifest. Critical is <code>::error</code>, warning is <code>::warning</code>, info is <code>::notice</code>. On a pull request they show on the changed files in the diff. No extra permission or step is needed.</>,
  annotationItems: {
    caps: <>GitHub caps annotations at 10 per type (error, warning, notice) per step and 50 per job. A large repo shows only the first ones; the full report is still printed in the log.</>,
    noFile: <>Findings that are not about a file, such as <code>DATA_DEGRADED</code> and <code>NO_SDK_FOUND</code>, have no file and show on the run instead.</>,
    line: <>The line comes from a plain scan of the manifest (the first matching key), so it is best effort. Paths are relative to the directory the action runs from.</>,
    sanitised: <>Finding text is sanitised before it is printed, so a manifest cannot inject workflow commands.</>,
  },
  annotationsOutside: <>Outside Actions, use <code>kedgeway diagnose --format annotations</code> or <code>--annotations &lt;file&gt;</code>. See <L to="/docs/commands">Commands</L>. SARIF below is separate and stays: it feeds code scanning, annotations feed the diff.</>,
  sarifH: "SARIF and code scanning",
  sarif: <>The log has one run for the tool <code>kedgeway</code>, a rule per finding code (18), and one result per finding with the repo-relative manifest path. Critical is an error, warning is a warning, info is a note. Findings that are not about a file, such as <code>DATA_DEGRADED</code> and <code>NO_SDK_FOUND</code>, have no location.</>,
  exitH: "Exit codes and speed",
  exit: <>The action runs <code>diagnose</code> once, always writes its outputs, then exits with the CLI&apos;s code: 0 when nothing met the threshold, 2 when a finding did, 1 on a tool error. Pinning a release tag (<code>uses: Klorenn/kedgeway@v1.2.3</code>) installs exactly that version from npm with no build step, and fails with a clear error if the version is not published. Any other ref (<code>@main</code>, a commit SHA, a branch) builds the checked-out source with <code>npm ci &amp;&amp; npm run build</code>, which is slower, and <code>@main</code> is unpinned. The npm install path applies to tags cut after this change; <code>v0.1.0</code> still builds from source.</>,
} satisfies DocsGithubActionDict;
