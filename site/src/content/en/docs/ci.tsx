import type { DocsCiDict } from "../../schema/docs-ci";
import { linkFor } from "@/i18n/Link";

const L = linkFor("en");

export default {
  meta: { title: "CI — kedgeway docs", description: "Fail a build on SDK drift with --fail-on, and run offline in CI with a fixture." },
  h1: "CI",
  lede: <>Use <code>--fail-on</code> to turn findings into a failing exit code.</>,
  exitH: "Exit codes",
  exit: {
    ok: <><code>0</code>: finished, nothing at or above the threshold.</>,
    error: <><code>1</code>: tool error. Treat it as an infrastructure failure.</>,
    drift: <><code>2</code>: a finding met the threshold. This is the drift signal.</>,
  },
  threshold: <>Pick the threshold by how strict you want to be: <code>--fail-on critical</code> fails on deprecated SDKs and legacy packages; <code>--fail-on warning</code> also fails on one-major-behind and on unknowns.</>,
  liveH: "Live data in CI",
  liveP: <>Export your stored Raven login once, on a machine where you are signed in, and store it as a repository secret:</>,
  secretP: <>Create a secret named <code>KEDGEWAY_AUTH</code> with that value (Settings, Secrets and variables, Actions). In the <L to="/docs/github-action">GitHub Action</L> pass it as <code>auth: ${"{{ secrets.KEDGEWAY_AUTH }}"}</code>. Outside the action, set the <code>KEDGEWAY_AUTH</code> environment variable yourself.</>,
  warning: <>The secret holds OAuth tokens: treat it like a password. kedgeway refreshes the token in memory only and never writes it to disk. If Raven rotates refresh tokens, the stored secret can go stale. Re-export it when runs start failing.</>,
  noSecret: <>Prefer no secret at all? Run offline against a saved snapshot with <code>--fixture</code> and refresh it by hand. See <L to="/docs/fixtures">Fixtures</L>. The action needs one of the two: <code>auth</code> or <code>fixture</code>.</>,
  exampleH: "GitHub Actions example",
  exampleP: <>Install the published CLI and check the repo against a committed fixture. For the maintained action, see <L to="/docs/github-action">GitHub Action</L>.</>,
  exampleAfter: <>The diagnose step exits 2 when a warning or critical finding exists, and 1 on a tool error. Commit <code>snapshot.json</code> next to the workflow, or drop <code>--fixture</code> and set <code>KEDGEWAY_AUTH</code> in the step environment for live data.</>,
} satisfies DocsCiDict;
