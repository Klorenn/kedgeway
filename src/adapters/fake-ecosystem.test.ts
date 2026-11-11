import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FakeEcosystem, loadFixture } from "./fake-ecosystem.js";
import type { EcosystemSnapshot } from "../ports/ecosystem.js";

const snap: EcosystemSnapshot = {
  observedAt: "2026-01-01T00:00:00.000Z",
  sorobanSdk: { currentMajor: 23, deprecatedVersions: [], source: "fixture" },
  jsSdk: { currentVersion: null, source: "fixture" },
  protocolCurrent: null,
  degraded: [],
  notes: [],
};

describe("FakeEcosystem", () => {
  it("returns the snapshot", async () => {
    expect(await new FakeEcosystem(snap).fetchSnapshot()).toEqual(snap);
  });

  it("defaults protocolCurrent and degraded when a fixture omits them", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sd-fx-"));
    try {
      const f = join(dir, "min.json");
      const { protocolCurrent: _p, degraded: _d, ...min } = snap;
      await writeFile(f, JSON.stringify(min));
      const out = await (await loadFixture(f)).fetchSnapshot();
      expect(out.protocolCurrent).toBeNull();
      expect(out.degraded).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("loads and validates a JSON fixture", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sd-fx-"));
    try {
      const good = join(dir, "good.json");
      const bad = join(dir, "bad.json");
      await writeFile(good, JSON.stringify(snap));
      await writeFile(bad, JSON.stringify({ observedAt: 1 }));
      expect((await loadFixture(good)).fetchSnapshot).toBeTypeOf("function");
      await expect(loadFixture(bad)).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
