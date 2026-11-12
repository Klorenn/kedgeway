import CodeBlock from "@/components/CodeBlock";
import Callout from "@/components/docs/Callout";
import PrevNext from "@/components/docs/PrevNext";
import { byLocale } from "@/i18n/config";
import { localeOf, metaFor } from "@/i18n/server";
import type { ActionInput } from "@/content/schema/docs-github-action";
import en from "@/content/en/docs/github-action";
import es from "@/content/es/docs/github-action";
import styles from "../docs.module.css";

const DICT = { en, es };

export const generateMetadata = ({ params }: PageProps<"/[locale]/docs/github-action">) => metaFor(params, "/docs/github-action", DICT);

const INPUTS: readonly ActionInput[] = ["mode", "path", "repo", "fail-on", "fixture", "auth", "json", "sarif", "version", "annotations", "pr-base", "pr-branch", "pr-draft", "refresh-lockfiles", "token"];

const USE = `- uses: actions/checkout@v4
- uses: Klorenn/kedgeway@v0.1.0
  with:
    path: .
    fail-on: warning
    auth: \${{ secrets.KEDGEWAY_AUTH }}   # live Raven data; or use fixture: for offline`;

const PR = `name: kedgeway-pr

on:
  schedule:
    - cron: "0 9 * * 1"
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write

concurrency:
  group: kedgeway-pr
  cancel-in-progress: false

jobs:
  kedgeway-pr:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          persist-credentials: false
      - uses: Klorenn/kedgeway@v0.3.0
        with:
          mode: pr
          auth: \${{ secrets.KEDGEWAY_AUTH }}`;

const SARIF = `permissions:
  contents: read
  security-events: write
steps:
  - uses: actions/checkout@v4
  - id: kedgeway
    uses: Klorenn/kedgeway@v0.1.0
    with:
      auth: \${{ secrets.KEDGEWAY_AUTH }}
      sarif: "true"
      fail-on: ""            # let the upload step report instead of failing here
  - uses: github/codeql-action/upload-sarif@v3
    if: always()
    with:
      sarif_file: \${{ steps.kedgeway.outputs.sarif }}`;

export default async function Page({ params }: PageProps<"/[locale]/docs/github-action">) {
  const t = byLocale(await localeOf(params), DICT);
  return (
    <>
      <h1>{t.h1}</h1>
      <p className={styles.lede}>{t.lede}</p>

      <h2 id="quick-start">{t.quickH}</h2>
      <CodeBlock code={"kedgeway init"} />
      <p>{t.quick}</p>

      <h2 id="use-it">{t.useH}</h2>
      <CodeBlock code={USE} />
      <p>{t.pin}</p>

      <h2 id="inputs-and-outputs">{t.ioH}</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th scope="col">{t.cols.input}</th><th scope="col">{t.cols.default}</th><th scope="col">{t.cols.meaning}</th></tr></thead>
          <tbody>
            {INPUTS.map((key) => (
              <tr key={key}><th scope="row"><code>{key}</code></th><td>{t.inputs[key].def}</td><td>{t.inputs[key].meaning}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>{t.outputs}</p>

      <h2 id="auth-or-a-fixture-is-required">{t.requiredH}</h2>
      <p>{t.required}</p>
      <ul>
        <li>{t.requiredItems.auth}</li>
        <li>{t.requiredItems.fixture}</li>
      </ul>
      <Callout kind="warning">
        <p>{t.staleWarning}</p>
      </Callout>

      <h2 id="annotations">{t.annotationsH}</h2>
      <p>{t.annotations}</p>
      <ul>
        <li>{t.annotationItems.caps}</li>
        <li>{t.annotationItems.noFile}</li>
        <li>{t.annotationItems.line}</li>
        <li>{t.annotationItems.sanitised}</li>
      </ul>
      <p>{t.annotationsOutside}</p>

      <h2 id="open-a-migration-pr">{t.prH}</h2>
      <p>{t.pr}</p>
      <CodeBlock code={"kedgeway init --mode pr"} />
      <CodeBlock code={PR} />
      <p>{t.prExample}</p>
      <p>{t.prRequirementsP}</p>
      <ul>
        <li>{t.prRequirements.permissions}</li>
        <li>{t.prRequirements.checkout}</li>
        <li>{t.prRequirements.credentials}</li>
        <li>{t.prRequirements.concurrency}</li>
        <li>{t.prRequirements.host}</li>
        <li>{t.prRequirements.lockfiles}</li>
        <li>{t.prRequirements.setting}</li>
      </ul>
      <p>{t.prOutputs}</p>

      <h2 id="sarif-and-code-scanning">{t.sarifH}</h2>
      <CodeBlock code={SARIF} />
      <p>{t.sarif}</p>

      <h2 id="exit-codes-and-speed">{t.exitH}</h2>
      <p>{t.exit}</p>
      <p>{t.exitPr}</p>
      <PrevNext href="/docs/github-action" />
    </>
  );
}
