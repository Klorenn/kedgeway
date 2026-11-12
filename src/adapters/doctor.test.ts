import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { EcosystemSnapshot } from "../ports/ecosystem.js";
import { runDoctor, type DoctorDeps } from "./doctor.js";
import { encodeAuth } from "./raven-auth.js";
import { SnapshotCache } from "./snapshot-cache.js";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "kw-doctor-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const NOW = Date.parse("2026-11-11T12:00:00.000Z");
const snap = (hoursAgo: number, degraded: string[] = []): EcosystemSnapshot => ({
  observedAt: new Date(NOW - hoursAgo * 3_600_000).toISOString(),
  sorobanSdk: { currentMajor: 28, currentVersion: "28.0.0", deprecatedVersions: [], source: "s" },
  jsSdk: { currentVersion: "17.0.0", source: "j" },
  protocolCurrent: 29,
  degraded,
  notes: [],
});
const tokens = { access_token: "A", token_type: "Bearer", refresh_token: "R" };

function deps(over: Partial<DoctorDeps> = {}): DoctorDeps {
  return {
    nodeVersion: "22.13.0",
    env: {},
    authPath: join(dir, "auth.json"),
    cache: new SnapshotCache(join(dir, "cache")),
    now: () => NOW,
    ping: () => Promise.resolve(),
    ...over,
  };
}
const byName = (checks: { name: string; status: string; detail: string }[], name: string) => checks.find((c) => c.name === name);

describe("runDoctor", () => {
  it("reports node, auth, cache and raven for a healthy setup", async () => {
    await writeFile(join(dir, "auth.json"), JSON.stringify({ tokens }));
    const cache = new SnapshotCache(join(dir, "cache"));
    await cache.write(snap(3));
    const checks = await runDoctor(deps({ cache }), {});
    expect(byName(checks, "node")).toMatchObject({ status: "ok", detail: expect.stringContaining("22.13.0") });
    expect(byName(checks, "auth")).toMatchObject({ status: "ok", detail: expect.stringContaining("auth.json") });
    expect(byName(checks, "cache")).toMatchObject({ status: "ok", detail: expect.stringMatching(/3 hours old.*snapshot\.json/) });
    expect(byName(checks, "raven")).toMatchObject({ status: "ok" });
  });

  it("fails on an unsupported Node", async () => {
    expect(byName(await runDoctor(deps({ nodeVersion: "20.0.0" }), {}), "node")?.status).toBe("fail");
  });

  it("reads auth from KEDGEWAY_AUTH (valid) or fails when it is malformed", async () => {
    const ok = await runDoctor(deps({ env: { KEDGEWAY_AUTH: encodeAuth({ tokens }) } }), {});
    expect(byName(ok, "auth")).toMatchObject({ status: "ok", detail: expect.stringContaining("KEDGEWAY_AUTH") });
    const bad = await runDoctor(deps({ env: { KEDGEWAY_AUTH: "%%%" } }), {});
    expect(byName(bad, "auth")).toMatchObject({ status: "fail", detail: expect.stringContaining("KEDGEWAY_AUTH is not valid") });
  });

  it("fails when the auth path exists but cannot be read, instead of claiming it is missing", async () => {
    await mkdir(join(dir, "auth.json"));
    const auth = byName(await runDoctor(deps(), {}), "auth");
    expect(auth?.status).toBe("fail");
    expect(auth?.detail).not.toMatch(/does not exist/);
  });

  it("warns when there is no auth, or the auth file has no tokens, without modifying the file", async () => {
    expect(byName(await runDoctor(deps(), {}), "auth")).toMatchObject({ status: "warn", detail: expect.stringContaining("kedgeway login") });
    await writeFile(join(dir, "auth.json"), JSON.stringify({ clientInformation: { client_id: "x" } }));
    expect(byName(await runDoctor(deps(), {}), "auth")?.status).toBe("warn");
    await writeFile(join(dir, "auth.json"), "{corrupt");
    expect(byName(await runDoctor(deps(), {}), "auth")?.status).toBe("warn");
  });

  it("warns for a missing, stale or degraded cache", async () => {
    expect(byName(await runDoctor(deps(), {}), "cache")).toMatchObject({ status: "warn", detail: expect.stringContaining("no cached snapshot") });
    const stale = new SnapshotCache(join(dir, "stale"));
    await stale.write(snap(30));
    expect(byName(await runDoctor(deps({ cache: stale }), {}), "cache")?.status).toBe("warn");
  });

  it("times out a hanging Raven call instead of hanging doctor", async () => {
    const hanging = deps({ ping: () => new Promise<void>(() => undefined), pingTimeoutMs: 20 });
    expect(byName(await runDoctor(hanging, {}), "raven")).toMatchObject({ status: "fail", detail: expect.stringMatching(/timed out/i) });
  });

  it("treats an unusable cache age (NaN) as stale", async () => {
    const cache = new SnapshotCache(join(dir, "cache"));
    await cache.write(snap(1));
    const c = byName(await runDoctor(deps({ cache, now: () => Number.NaN }), {}), "cache");
    expect(c?.status).toBe("warn");
    expect(c?.detail).toMatch(/stale/);
  });

  it("fails when Raven is unreachable, and skips the call with --offline", async () => {
    let calls = 0;
    const failing = deps({ ping: () => (calls++, Promise.reject(new Error("connect ECONNREFUSED"))) });
    expect(byName(await runDoctor(failing, {}), "raven")).toMatchObject({ status: "fail", detail: expect.stringContaining("ECONNREFUSED") });
    expect(calls).toBe(1);
    const offline = await runDoctor(failing, { offline: true });
    expect(byName(offline, "raven")).toMatchObject({ status: "skip", detail: expect.stringContaining("--offline") });
    expect(calls).toBe(1);
  });
});
