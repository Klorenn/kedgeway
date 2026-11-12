import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as sdk from "./index.js";
import type { Diagnosis, EcosystemSnapshot, Finding, RepoFacts, Severity } from "./index.js";

const snapshot: EcosystemSnapshot = {
  observedAt: "2026-11-11T00:00:00.000Z",
  sorobanSdk: { currentMajor: 28, currentVersion: "28.0.0", deprecatedVersions: [], source: "fake" },
  jsSdk: { currentVersion: "17.2.1", source: "fake" },
  stellarCli: { currentVersion: "28.1.0", source: "fake" },
  protocolCurrent: 29,
  degraded: [],
  notes: [],
};

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "kw-sdk-"));
  await mkdir(join(dir, "c"));
  await writeFile(join(dir, "c/Cargo.toml"), `[dependencies]\nsoroban-sdk = "21.0.0"\n`);
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("public API", () => {
  it("exports the documented runtime surface", () => {
    for (const name of [
      "diagnose",
      "diagnoseDetailed",
      "scanRepo",
      "diagnoseRepo",
      "createRavenEcosystem",
      "FakeEcosystem",
      "loadFixture",
      "planMigration",
      "applyMigration",
      "migrate",
      "buildGuide",
      "formatGuide",
      "migrationDocs",
      "findImportHits",
    ]) {
      expect(sdk).toHaveProperty(name);
      expect((sdk as Record<string, unknown>)[name]).toBeTypeOf("function");
    }
  });

  it("diagnose with a FakeEcosystem returns findings for a repo", async () => {
    const d: Diagnosis = await sdk.diagnose({ path: dir, ecosystem: new sdk.FakeEcosystem(snapshot) });
    const f: Finding | undefined = d.findings[0];
    const sev: Severity | undefined = f?.severity;
    expect(f?.code).toBe("SDK_DEPRECATED");
    expect(sev).toBe("critical");
    expect(d.summary.critical).toBe(1);
  });

  it("diagnose prefers a fixture file over the ecosystem port", async () => {
    const fx = join(dir, "fx.json");
    await writeFile(fx, JSON.stringify({ ...snapshot, sorobanSdk: { ...snapshot.sorobanSdk, currentMajor: 21 } }));
    const boom = { fetchSnapshot: () => Promise.reject(new Error("must not be called")) };
    const d = await sdk.diagnose({ path: dir, fixture: fx, ecosystem: boom });
    expect(d.findings[0]?.code).toBe("SDK_CURRENT");
  });

  it("diagnoseDetailed also returns facts and snapshot", async () => {
    const r = await sdk.diagnoseDetailed({ path: dir, ecosystem: new sdk.FakeEcosystem(snapshot) });
    const facts: RepoFacts = r.facts;
    expect(facts.rustDeps).toHaveLength(1);
    expect(r.snapshot).toEqual(snapshot);
    expect(r.diagnosis.findings).toHaveLength(1);
  });

  it("scanRepo and diagnoseRepo compose purely", async () => {
    const facts = await sdk.scanRepo(dir);
    expect(sdk.diagnoseRepo(facts, snapshot).summary.critical).toBe(1);
  });

  it("createRavenEcosystem returns an EcosystemPort without connecting", () => {
    expect(sdk.createRavenEcosystem().fetchSnapshot).toBeTypeOf("function");
  });

  it("migrate plans and (dry-run) applies without writing; write mode edits the file", async () => {
    const eco = new sdk.FakeEcosystem(snapshot);
    const dry = await sdk.migrate({ path: dir, ecosystem: eco });
    expect(dry.plan.steps[0]).toMatchObject({ kind: "bump-rust-dep", to: "28.0.0" });
    expect(dry.result.written).toBe(false);
    expect(await readFile(join(dir, "c/Cargo.toml"), "utf8")).toContain('"21.0.0"');
    const wet = await sdk.migrate({ path: dir, ecosystem: eco, write: true });
    expect(wet.result.written).toBe(true);
    expect(await readFile(join(dir, "c/Cargo.toml"), "utf8")).toContain('"28.0.0"');
  });

  it("exports the phase 3 surface", () => {
    expect(sdk.toSarif).toBeTypeOf("function");
    expect(sdk.buildSarif).toBeTypeOf("function");
    expect(sdk.CachingEcosystem).toBeTypeOf("function");
    expect(sdk.SnapshotCache).toBeTypeOf("function");
  });
});
