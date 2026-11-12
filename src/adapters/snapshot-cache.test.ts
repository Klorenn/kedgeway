import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { EcosystemPort, EcosystemSnapshot } from "../ports/ecosystem.js";
import { CachingEcosystem, SnapshotCache, defaultCacheDir } from "./snapshot-cache.js";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "kw-cache-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const HOUR = 3_600_000;
const T0 = Date.parse("2026-11-11T12:00:00.000Z");
const snap = (observedAt: string, extra: Partial<EcosystemSnapshot> = {}): EcosystemSnapshot => ({
  observedAt,
  sorobanSdk: { currentMajor: 28, currentVersion: "28.0.0", deprecatedVersions: [], source: "fake" },
  jsSdk: { currentVersion: "17.0.0", source: "fake" },
  stellarCli: { currentVersion: "28.1.0", source: "fake" },
  protocolCurrent: 29,
  degraded: [],
  notes: [],
  ...extra,
});
const hoursAgo = (h: number): string => new Date(T0 - h * HOUR).toISOString();

function port(result: EcosystemSnapshot | Error): EcosystemPort & { calls: number } {
  const p = {
    calls: 0,
    fetchSnapshot(): Promise<EcosystemSnapshot> {
      p.calls += 1;
      return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
    },
  };
  return p;
}

describe("defaultCacheDir", () => {
  it("honours XDG_CACHE_HOME, else ~/.cache", () => {
    expect(defaultCacheDir({ XDG_CACHE_HOME: "/x" })).toBe(join("/x", "kedgeway"));
    expect(defaultCacheDir({})).toBe(join(homedir(), ".cache", "kedgeway"));
  });
});

describe("SnapshotCache", () => {
  it("round-trips a snapshot as snapshot.json with mode 0600", async () => {
    const cache = new SnapshotCache(join(dir, "nested"));
    expect(await cache.read()).toBeNull();
    await cache.write(snap(hoursAgo(1)));
    expect(await cache.read()).toEqual(snap(hoursAgo(1)));
    const file = join(dir, "nested", "snapshot.json");
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    expect(JSON.parse(await readFile(file, "utf8")).observedAt).toBe(hoursAgo(1));
  });

  it("loads an old cached snapshot without stellarCli instead of dropping it", async () => {
    const cache = new SnapshotCache(join(dir, "old"));
    await cache.write(snap(hoursAgo(1)));
    const { stellarCli: _c, ...old } = snap(hoursAgo(1));
    await writeFile(cache.path, JSON.stringify(old));
    const read = await cache.read();
    expect(read).not.toBeNull();
    expect(read?.stellarCli).toEqual({ currentVersion: null, source: "cache (field missing)" });
    expect(read?.sorobanSdk.currentVersion).toBe("28.0.0");
  });

  it("treats a pre-upgrade cache (no stellarCli) as not fresh, so it is refetched", async () => {
    const cache = new SnapshotCache(join(dir, "legacy"));
    const { stellarCli: _c, ...old } = snap(hoursAgo(1));
    await mkdir(dirname(cache.path), { recursive: true });
    await writeFile(cache.path, JSON.stringify(old));
    const live = snap(hoursAgo(0));
    const p = port(live);
    const out = await new CachingEcosystem(p, cache, { now: () => T0 }).fetchSnapshot();
    expect(p.calls).toBe(1);
    expect(out.stellarCli.currentVersion).toBe("28.1.0");
    expect((await cache.read())?.stellarCli.source).toBe("fake");
  });

  it("notes the missing field as degraded when a pre-upgrade cache is used offline or after a failed fetch", async () => {
    const cache = new SnapshotCache(join(dir, "legacy2"));
    const { stellarCli: _c, ...old } = snap(hoursAgo(1));
    await mkdir(dirname(cache.path), { recursive: true });
    await writeFile(cache.path, JSON.stringify(old));
    const off = await new CachingEcosystem(port(new Error("x")), cache, { offline: true, now: () => T0 }).fetchSnapshot();
    expect(off.stellarCli.currentVersion).toBeNull();
    expect(off.degraded.join(" ")).toMatch(/stellarCli|Stellar CLI/);
    const fb = await new CachingEcosystem(port(new Error("down")), cache, { now: () => T0 }).fetchSnapshot();
    expect(fb.degraded.join(" ")).toMatch(/stellarCli|Stellar CLI/);
    expect(fb.degraded.join(" ")).toMatch(/using cached snapshot/);
  });

  it("treats a corrupt or invalid file as no cache", async () => {
    await writeFile(join(dir, "snapshot.json"), "{nope");
    expect(await new SnapshotCache(dir).read()).toBeNull();
    await writeFile(join(dir, "snapshot.json"), JSON.stringify({ observedAt: 5 }));
    expect(await new SnapshotCache(dir).read()).toBeNull();
  });
});

describe("CachingEcosystem", () => {
  const now = (): number => T0;
  const maxAgeMs = 24 * HOUR;
  const make = (inner: EcosystemPort, opts: { offline?: boolean; noCache?: boolean } = {}) =>
    new CachingEcosystem(inner, new SnapshotCache(dir), { maxAgeMs, now, ...opts });

  it("fetches and writes the cache when empty", async () => {
    const inner = port(snap(hoursAgo(0)));
    expect(await make(inner).fetchSnapshot()).toEqual(snap(hoursAgo(0)));
    expect(await new SnapshotCache(dir).read()).toEqual(snap(hoursAgo(0)));
  });

  it("serves a fresh cache without calling the inner port", async () => {
    await new SnapshotCache(dir).write(snap(hoursAgo(2)));
    const inner = port(snap(hoursAgo(0)));
    expect((await make(inner).fetchSnapshot()).observedAt).toBe(hoursAgo(2));
    expect(inner.calls).toBe(0);
  });

  it("refetches and rewrites a stale cache", async () => {
    await new SnapshotCache(dir).write(snap(hoursAgo(30)));
    const inner = port(snap(hoursAgo(0)));
    expect((await make(inner).fetchSnapshot()).observedAt).toBe(hoursAgo(0));
    expect((await new SnapshotCache(dir).read())?.observedAt).toBe(hoursAgo(0));
  });

  it("--no-cache bypasses the read but still writes, and does not fall back", async () => {
    await new SnapshotCache(dir).write(snap(hoursAgo(1)));
    const inner = port(snap(hoursAgo(0)));
    expect((await make(inner, { noCache: true }).fetchSnapshot()).observedAt).toBe(hoursAgo(0));
    expect(inner.calls).toBe(1);
    expect((await new SnapshotCache(dir).read())?.observedAt).toBe(hoursAgo(0));
    await expect(make(port(new Error("boom")), { noCache: true }).fetchSnapshot()).rejects.toThrow("boom");
  });

  it("--offline errors when there is no cache and never calls the inner port", async () => {
    const inner = port(snap(hoursAgo(0)));
    await expect(make(inner, { offline: true }).fetchSnapshot()).rejects.toThrow(/no cached snapshot/i);
    expect(inner.calls).toBe(0);
  });

  it("--offline serves a fresh cache silently", async () => {
    await new SnapshotCache(dir).write(snap(hoursAgo(3)));
    const s = await make(port(snap(hoursAgo(0))), { offline: true }).fetchSnapshot();
    expect(s.degraded).toEqual([]);
  });

  it("--offline serves a stale cache with a DATA_DEGRADED note", async () => {
    await new SnapshotCache(dir).write(snap(hoursAgo(30), { degraded: ["existing"] }));
    const inner = port(snap(hoursAgo(0)));
    const s = await make(inner, { offline: true }).fetchSnapshot();
    expect(inner.calls).toBe(0);
    expect(s.degraded).toEqual(["existing", "snapshot is 30 hours old"]);
  });

  it("falls back to the cache when the inner port fails", async () => {
    await new SnapshotCache(dir).write(snap(hoursAgo(30)));
    const s = await make(port(new Error("raven down"))).fetchSnapshot();
    expect(s.degraded).toEqual([`using cached snapshot from ${hoursAgo(30)}`]);
  });

  it("rethrows the original error when it fails and there is no cache", async () => {
    await expect(make(port(new Error("raven down"))).fetchSnapshot()).rejects.toThrow("raven down");
  });

  it("does not fail the run when the cache cannot be written", async () => {
    const blocked = join(dir, "file");
    await writeFile(blocked, "x"); // a file where the cache directory should be
    const eco = new CachingEcosystem(port(snap(hoursAgo(0))), new SnapshotCache(join(blocked, "sub")), { maxAgeMs, now });
    expect((await eco.fetchSnapshot()).observedAt).toBe(hoursAgo(0));
  });

  it("never caches a snapshot that carries degraded notes", async () => {
    const eco = make(port(snap(hoursAgo(0), { degraded: ["scout failed"] })));
    expect((await eco.fetchSnapshot()).degraded).toEqual(["scout failed"]);
    expect(await new SnapshotCache(dir).read()).toBeNull();
  });

  it("treats a cached degraded snapshot as stale: refetches by default, still usable offline", async () => {
    await new SnapshotCache(dir).write(snap(hoursAgo(1), { degraded: ["old note"] }));
    const inner = port(snap(hoursAgo(0)));
    expect((await make(inner).fetchSnapshot()).observedAt).toBe(hoursAgo(0));
    expect(inner.calls).toBe(1);
    await new SnapshotCache(dir).write(snap(hoursAgo(1), { degraded: ["old note"] }));
    const off = await make(port(new Error("x")), { offline: true }).fetchSnapshot();
    expect(off.degraded).toEqual(["old note"]);
  });

  it("treats an observedAt in the future as stale", async () => {
    await new SnapshotCache(dir).write(snap(new Date(T0 + 5 * HOUR).toISOString()));
    const inner = port(snap(hoursAgo(0)));
    await make(inner).fetchSnapshot();
    expect(inner.calls).toBe(1);
  });

  it("rejects a cache whose observedAt is not an ISO datetime", async () => {
    await writeFile(join(dir, "snapshot.json"), JSON.stringify(snap("yesterday")));
    expect(await new SnapshotCache(dir).read()).toBeNull();
  });

  it("writes via an exclusive temp file, leaves none behind and keeps the dir 0700", async () => {
    const cache = new SnapshotCache(join(dir, "c"));
    await cache.write(snap(hoursAgo(1)));
    await cache.write(snap(hoursAgo(0)));
    expect(await readdir(join(dir, "c"))).toEqual(["snapshot.json"]);
    expect((await stat(join(dir, "c"))).mode & 0o777).toBe(0o700);
  });
});
