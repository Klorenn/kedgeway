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
  stellarCli: { currentVersion: "28.1.0", source: "fake" },
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
    exec: () => Promise.reject(Object.assign(new Error("spawn stellar ENOENT"), { code: "ENOENT" })),
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

describe("runDoctor: stellar-cli", () => {
  const out = (stdout: string): DoctorDeps["exec"] => () => Promise.resolve({ stdout });
  const cacheWith = async (current: string | null): Promise<SnapshotCache> => {
    const cache = new SnapshotCache(join(dir, "cache"));
    await cache.write({ ...snap(1), stellarCli: { currentVersion: current, source: "s" } });
    return cache;
  };

  it("warns, without failing, when stellar is not installed", async () => {
    const c = byName(await runDoctor(deps(), {}), "stellar-cli");
    expect(c).toMatchObject({ status: "warn", detail: "not installed (optional): https://developers.stellar.org/docs/tools/cli/install-cli" });
  });

  it("runs `stellar --version` through execFile-style args with a 5 s timeout, never a shell string", async () => {
    const calls: { file: string; args: string[]; timeout: number }[] = [];
    const exec: DoctorDeps["exec"] = (file, args, opts) => {
      calls.push({ file, args, timeout: opts.timeout });
      return Promise.resolve({ stdout: "stellar 28.1.0 (abc)\nstellar-xdr 28.0.0\n" });
    };
    await runDoctor(deps({ exec, cache: await cacheWith("28.1.0") }), {});
    expect(calls).toEqual([{ file: "stellar", args: ["--version"], timeout: 5000 }]);
    calls.length = 0;
    await runDoctor(deps({ exec, cliTimeoutMs: 1234 }), {});
    expect(calls[0]?.timeout).toBe(1234);
  });

  it("ok on the current major or newer, warn one behind, fail two or more behind", async () => {
    const cache = await cacheWith("28.1.0");
    expect(byName(await runDoctor(deps({ exec: out("stellar 28.0.2\n"), cache }), {}), "stellar-cli")?.status).toBe("ok");
    expect(byName(await runDoctor(deps({ exec: out("stellar 29.0.0\n"), cache }), {}), "stellar-cli")?.status).toBe("ok");
    expect(byName(await runDoctor(deps({ exec: out("stellar 27.3.0\n"), cache }), {}), "stellar-cli")?.status).toBe("warn");
    const two = byName(await runDoctor(deps({ exec: out("stellar 26.9.9\n"), cache }), {}), "stellar-cli");
    expect(two?.status).toBe("fail");
  });

  it("is ok with 'current unknown offline' under --offline, even when a snapshot exists", async () => {
    const cache = await cacheWith("28.1.0");
    expect(byName(await runDoctor(deps({ exec: out("stellar 21.0.0\n"), cache }), { offline: true }), "stellar-cli")).toEqual({
      name: "stellar-cli",
      status: "ok",
      detail: "installed 21.0.0 (current unknown offline)",
    });
  });

  it("is ok with no snapshot, or a snapshot without a CLI version", async () => {
    expect(byName(await runDoctor(deps({ exec: out("stellar 21.0.0\n") }), {}), "stellar-cli")).toMatchObject({ status: "ok", detail: expect.stringContaining("current unknown") });
    const cache = await cacheWith(null);
    expect(byName(await runDoctor(deps({ exec: out("stellar 21.0.0\n"), cache }), {}), "stellar-cli")?.status).toBe("ok");
  });

  it("does not hang when exec never settles: its own timer wins", async () => {
    const never: DoctorDeps["exec"] = () => new Promise(() => undefined);
    const t0 = Date.now();
    const c = byName(await runDoctor(deps({ exec: never, cliTimeoutMs: 20 }), {}), "stellar-cli");
    expect(c).toMatchObject({ status: "warn", detail: expect.stringMatching(/timed out/) });
    expect(Date.now() - t0).toBeLessThan(2000);
  });

  it("warns on unparseable output and on a failing or hanging command", async () => {
    expect(byName(await runDoctor(deps({ exec: out("hello\n") }), {}), "stellar-cli")).toMatchObject({ status: "warn", detail: expect.stringContaining("unexpected output") });
    const boom: DoctorDeps["exec"] = () => Promise.reject(Object.assign(new Error("Command failed"), { code: 1 }));
    expect(byName(await runDoctor(deps({ exec: boom }), {}), "stellar-cli")).toMatchObject({ status: "warn", detail: expect.stringContaining("Command failed") });
    const killed: DoctorDeps["exec"] = () => Promise.reject(Object.assign(new Error("timed out"), { killed: true, code: null, signal: "SIGTERM" }));
    expect(byName(await runDoctor(deps({ exec: killed }), {}), "stellar-cli")).toMatchObject({ status: "warn", detail: expect.stringMatching(/timed out after 5 s/) });
  });
});
