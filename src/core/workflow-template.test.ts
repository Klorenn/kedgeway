import { describe, expect, it } from "vitest";
import { WORKFLOW_PATH, renderWorkflow } from "./workflow-template.js";

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
