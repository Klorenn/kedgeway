import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { diagnose, loadFixture } from "./index.js";

const root = resolve(import.meta.dirname, "..");

describe("committed ecosystem fixture", () => {
  it("loads and carries the 2026-11-11 values", async () => {
    const snap = await (await loadFixture(resolve(root, "fixtures/ecosystem-2026-11-11.json"))).fetchSnapshot();
    expect(snap.sorobanSdk.currentMajor).toBe(28);
    expect(snap.sorobanSdk.deprecatedVersions).toEqual(["21.0.0", "20.0.0", "22.0.1"]);
    expect(snap.jsSdk.currentVersion).toBe("17.2.1");
    expect(snap.protocolCurrent).toBe(29);
    expect(snap.degraded).toEqual([]);
  });

  it("lets the self-test pass: this repo has no finding at or above warning", async () => {
    const d = await diagnose({ path: root, fixture: resolve(root, "fixtures/ecosystem-2026-11-11.json") });
    expect(d.summary.critical + d.summary.warning).toBe(0);
  });
});

describe("action.yml", () => {
  it("declares the documented inputs, outputs and fail-fast message", async () => {
    const y = await readFile(resolve(root, "action.yml"), "utf8");
    for (const key of ["path:", "fail-on:", "fixture:", "json:", "summary:", "report-json:"]) {
      expect(y).toContain(key);
    }
    expect(y).toContain("using: composite");
    expect(y).toMatch(/OAuth in CI isn't supported yet/);
    expect(y).toContain("github.action_path");
    expect(y).toContain("RUNNER_TEMP");
  });
});
