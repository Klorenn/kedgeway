import { describe, expect, it } from "vitest";
import { WORKFLOW_PATH, WORKFLOW_PR_PATH, renderWorkflow, workflowPathFor } from "./workflow-template.js";

describe("renderWorkflow", () => {
  const yaml = renderWorkflow({ version: "0.1.0" });

  it("targets the conventional workflow path", () => {
    expect(WORKFLOW_PATH).toBe(".github/workflows/kedgeway.yml");
  });

  it("has the top-level workflow shape", () => {
    expect(yaml).toMatch(/^name: kedgeway$/m);
    expect(yaml).toMatch(/^on:$/m);
    expect(yaml).toMatch(/^permissions:\n {2}contents: read$/m);
    expect(yaml).toMatch(/^jobs:\n {2}kedgeway:\n {4}runs-on: ubuntu-latest\n {4}steps:$/m);
    expect(yaml).not.toContain("\t");
    expect(yaml.endsWith("\n")).toBe(true);
  });

  it("uses the published action pinned to the release tag, after checkout", () => {
    expect(yaml).toContain("- uses: actions/checkout@v4");
    expect(yaml).toContain("- uses: Klorenn/kedgeway@v0.1.0");
    expect(yaml.indexOf("actions/checkout")).toBeLessThan(yaml.indexOf("Klorenn/kedgeway@"));
  });

  it("passes the documented inputs with the documented defaults", () => {
    expect(yaml).toContain("path: .");
    expect(yaml).toContain("fail-on: warning");
    expect(yaml).toContain("auth: ${{ secrets.KEDGEWAY_AUTH }}");
  });

  it("rejects a version that is not plain semver (no YAML injection)", () => {
    for (const v of ["", "1.0\nuses: evil/x@v1", "v1.0.0", "1.0.0 # x", "../x"]) {
      expect(() => renderWorkflow({ version: v }), v).toThrow(/version/);
    }
    expect(renderWorkflow({ version: "1.2.3-rc.1" })).toContain("@v1.2.3-rc.1");
  });
});

describe("renderWorkflow mode", () => {
  it("keeps the default output byte-identical", () => {
    expect(renderWorkflow({ version: "0.1.0", mode: "diagnose" })).toBe(renderWorkflow({ version: "0.1.0" }));
    expect(renderWorkflow({ version: "0.1.0" })).toBe(`name: kedgeway

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
      - uses: Klorenn/kedgeway@v0.1.0
        with:
          path: .
          fail-on: warning
          auth: \${{ secrets.KEDGEWAY_AUTH }}
`);
  });

  it("pr mode writes the weekly bot workflow", () => {
    const y = renderWorkflow({ version: "0.3.0", mode: "pr" });
    expect(WORKFLOW_PR_PATH).toBe(".github/workflows/kedgeway-pr.yml");
    expect(workflowPathFor("pr")).toBe(WORKFLOW_PR_PATH);
    expect(workflowPathFor("diagnose")).toBe(WORKFLOW_PATH);
    expect(y).toMatch(/^name: kedgeway-pr$/m);
    expect(y).toContain('schedule:\n    - cron: "0 9 * * 1"');
    expect(y).toContain("workflow_dispatch:");
    expect(y).toMatch(/^permissions:\n {2}contents: write\n {2}pull-requests: write$/m);
    expect(y).toContain("- uses: actions/checkout@v4\n        with:\n          fetch-depth: 0\n          persist-credentials: false");
    expect(y).toContain("concurrency:\n  group: kedgeway-pr\n  cancel-in-progress: false");
    expect(y).toContain("- uses: Klorenn/kedgeway@v0.3.0");
    expect(y).toContain("mode: pr");
    expect(y).toContain("auth: ${{ secrets.KEDGEWAY_AUTH }}");
    expect(y).not.toContain("\t");
    expect(y.endsWith("\n")).toBe(true);
  });

  it("validates the version in pr mode too", () => {
    expect(() => renderWorkflow({ version: "1.0\nx", mode: "pr" })).toThrow(/version/);
  });
});
