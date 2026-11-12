/** Where `kedgeway init` writes the workflow, relative to the repository root. */
export const WORKFLOW_PATH = ".github/workflows/kedgeway.yml";
/** Where `kedgeway init --mode pr` writes the bot workflow. */
export const WORKFLOW_PR_PATH = ".github/workflows/kedgeway-pr.yml";

export type WorkflowMode = "diagnose" | "pr";

export function workflowPathFor(mode: WorkflowMode): string {
  return mode === "pr" ? WORKFLOW_PR_PATH : WORKFLOW_PATH;
}

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/**
 * GitHub Actions workflow that runs the published composite action (see README, "GitHub Action").
 * The only interpolated value is `version`, validated against plain semver so it cannot inject YAML.
 */
export function renderWorkflow(opts: { version: string; mode?: WorkflowMode }): string {
  if (!SEMVER.test(opts.version)) throw new Error(`invalid version for the workflow action reference: ${JSON.stringify(opts.version)}`);
  if (opts.mode === "pr") {
    return `name: kedgeway-pr

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
      - uses: Klorenn/kedgeway@v${opts.version}
        with:
          mode: pr
          auth: \${{ secrets.KEDGEWAY_AUTH }}
`;
  }
  return `name: kedgeway

on:
  push:
    branches: [main, master]
  pull_request:

permissions:
  contents: read

jobs:
  kedgeway:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: Klorenn/kedgeway@v${opts.version}
        with:
          path: .
          fail-on: warning
          auth: \${{ secrets.KEDGEWAY_AUTH }}
`;
}
