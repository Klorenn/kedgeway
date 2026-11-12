import type { Metadata } from "next";
import Link from "next/link";
import CodeBlock from "@/components/CodeBlock";
import PrevNext from "@/components/docs/PrevNext";
import styles from "../docs.module.css";

export const metadata: Metadata = {
  title: "CI — kedgeway docs",
  description: "Fail a build on SDK drift with --fail-on, and run offline in CI with a fixture.",
  alternates: { canonical: "/docs/ci" },
  openGraph: { title: "CI — kedgeway docs", description: "Fail a build on SDK drift with --fail-on, and run offline in CI with a fixture.", url: "/docs/ci", images: [{ url: "/docs/opengraph-image", width: 1200, height: 630 }] },
};

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

      <h2>Live data is not supported in CI yet</h2>
      <p className={styles.note}>
        Raven sign-in needs a browser. Storing <code>~/.config/kedgeway/auth.json</code> as a CI secret is <strong>not supported</strong> yet. A GitHub Action is on the <Link href="/docs/roadmap">roadmap</Link>, not shipped.
      </p>
      <p>Until then, run offline in CI against a saved snapshot with <code>--fixture</code>. Refresh the snapshot by hand when the ecosystem moves. See <Link href="/docs/fixtures">Fixtures</Link>.</p>

      <h2>GitHub Actions example</h2>
      <p>This is an untested sketch. It builds kedgeway from source (it is not on npm yet), then checks the repo against a committed fixture. Adjust the checkout of kedgeway to wherever you host it.</p>
      <CodeBlock label="yaml" code={`name: kedgeway
on: [pull_request]

jobs:
  drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/checkout@v4
        with:
          repository: kedgeway/kedgeway
          path: .kedgeway

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Build kedgeway
        working-directory: .kedgeway
        run: |
          npm ci
          npm run build
          npm link

      - name: Diagnose
        run: |
          kedgeway diagnose . --fixture ci/ecosystem.json --fail-on warning --json > kedgeway-report.json

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: kedgeway-report
          path: kedgeway-report.json`} />
      <p>The step fails with exit code 2 when a warning or critical finding exists, and with exit code 1 on a tool error. The <code>if: always()</code> keeps the JSON report even when the step fails.</p>
      <PrevNext href="/docs/ci" />
    </>
  );
}
