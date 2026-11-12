import type { Metadata } from "next";
import { docsMeta } from "@/lib/seo";
import Link from "next/link";
import CodeBlock from "@/components/CodeBlock";
import Callout from "@/components/docs/Callout";
import PrevNext from "@/components/docs/PrevNext";
import styles from "../docs.module.css";

export const metadata: Metadata = docsMeta("CI — kedgeway docs", "Fail a build on SDK drift with --fail-on, and run offline in CI with a fixture.", "/docs/ci");

export default function Ci() {
  return (
    <>
      <h1>CI</h1>
      <p className={styles.lede}>Use <code>--fail-on</code> to turn findings into a failing exit code.</p>

      <h2>Exit codes</h2>
      <ul>
        <li><code>0</code>: finished, nothing at or above the threshold.</li>
        <li><code>1</code>: tool error. Treat it as an infrastructure failure.</li>
        <li><code>2</code>: a finding met the threshold. This is the drift signal.</li>
      </ul>
      <p>Pick the threshold by how strict you want to be: <code>--fail-on critical</code> fails on deprecated SDKs and legacy packages; <code>--fail-on warning</code> also fails on one-major-behind and on unknowns.</p>

      <h2>Live data in CI</h2>
      <p>Export your stored Raven login once, on a machine where you are signed in, and store it as a repository secret:</p>
      <CodeBlock code={`kedgeway login --export | pbcopy   # macOS; use xclip or wl-copy elsewhere`} />
      <p>Create a secret named <code>KEDGEWAY_AUTH</code> with that value (Settings, Secrets and variables, Actions). In the <Link href="/docs/github-action">GitHub Action</Link> pass it as <code>auth: ${"{{ secrets.KEDGEWAY_AUTH }}"}</code>. Outside the action, set the <code>KEDGEWAY_AUTH</code> environment variable yourself.</p>
      <Callout kind="warning">
        <p>The secret holds OAuth tokens: treat it like a password. kedgeway refreshes the token in memory only and never writes it to disk. If Raven rotates refresh tokens, the stored secret can go stale. Re-export it when runs start failing.</p>
      </Callout>
      <p>Prefer no secret at all? Run offline against a saved snapshot with <code>--fixture</code> and refresh it by hand. See <Link href="/docs/fixtures">Fixtures</Link>. The action needs one of the two: <code>auth</code> or <code>fixture</code>.</p>

      <h2>GitHub Actions example</h2>
      <p>kedgeway is not on npm. This job clones <code>Klorenn/kedgeway</code>, builds it, and checks the repo against a committed fixture. For the maintained action, see <Link href="/docs/github-action">GitHub Action</Link>.</p>
      <CodeBlock label="yaml" code={`name: kedgeway
on: [push, pull_request]
jobs:
  diagnose:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: |
          git clone https://github.com/Klorenn/kedgeway /tmp/kedgeway
          (cd /tmp/kedgeway && npm ci && npm run build && npm link)
      - run: kedgeway diagnose . --fail-on warning --fixture snapshot.json`} />
      <p>The diagnose step exits 2 when a warning or critical finding exists, and 1 on a tool error. Commit <code>snapshot.json</code> next to the workflow, or drop <code>--fixture</code> and set <code>KEDGEWAY_AUTH</code> in the step environment for live data.</p>
      <PrevNext href="/docs/ci" />
    </>
  );
}
