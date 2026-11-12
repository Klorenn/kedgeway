/** Where `kedgeway init` writes the workflow, relative to the repository root. */
export const WORKFLOW_PATH = ".github/workflows/kedgeway.yml";

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/**
 * GitHub Actions workflow that runs the published composite action (see README, "GitHub Action").
 * The only interpolated value is `version`, validated against plain semver so it cannot inject YAML.
 */
export function renderWorkflow(opts: { version: string }): string {
  if (!SEMVER.test(opts.version)) throw new Error(`invalid version for the workflow action reference: ${JSON.stringify(opts.version)}`);
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
