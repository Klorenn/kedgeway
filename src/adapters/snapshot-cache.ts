import { randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { EcosystemPort, EcosystemSnapshot } from "../ports/ecosystem.js";
import { z } from "zod";
import { SnapshotSchema } from "./fake-ecosystem.js";

/** `stellarCli.source` of a cached snapshot that predates the field. */
export const CLI_FIELD_MISSING = "cache (field missing)";

const CacheSchema = SnapshotSchema.extend({
  observedAt: z.string().datetime(),
  // Snapshots cached before the Stellar CLI check existed have no such field; they must still load.
  stellarCli: z
    .object({ currentVersion: z.string().nullable(), source: z.string() })
    .default({ currentVersion: null, source: CLI_FIELD_MISSING }),
});

export function defaultCacheDir(env: NodeJS.ProcessEnv = process.env): string {
  const xdg = env["XDG_CACHE_HOME"];
  return join(xdg !== undefined && xdg !== "" ? xdg : join(homedir(), ".cache"), "kedgeway");
}

/** Stores the last successful ecosystem snapshot as `<dir>/snapshot.json` (mode 0600). */
export class SnapshotCache {
  constructor(private readonly dir: string = defaultCacheDir()) {}

  get path(): string {
    return join(this.dir, "snapshot.json");
  }

  async read(): Promise<EcosystemSnapshot | null> {
    try {
      return CacheSchema.parse(JSON.parse(await readFile(this.path, "utf8")));
    } catch {
      return null; // missing, unreadable, corrupt or from an incompatible version: all mean "no cache"
    }
  }

  async write(snapshot: EcosystemSnapshot): Promise<void> {
    const dir = dirname(this.path);
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await chmod(dir, 0o700);
    const tmp = `${this.path}.${randomBytes(6).toString("hex")}.tmp`;
    try {
      await writeFile(tmp, JSON.stringify(snapshot, null, 2), { mode: 0o600, flag: "wx" });
      await chmod(tmp, 0o600);
      await rename(tmp, this.path);
    } catch (e) {
      await rm(tmp, { force: true });
      throw e;
    }
  }
}

export interface CachingOptions {
  /** Serve only from the cache; error when there is none. A stale cache is used with a warning. */
  offline?: boolean;
  /** Bypass reading (and the failure fallback) but still write after a successful fetch. */
  noCache?: boolean;
  /** A cache older than this is refetched (unless offline). Default 24h. */
  maxAgeMs?: number;
  now?: () => number;
}

const HOUR_MS = 3_600_000;
export const DEFAULT_MAX_AGE_MS = 24 * HOUR_MS;

/** Wraps a live port with the on-disk snapshot cache (see {@link CachingOptions}). */
export class CachingEcosystem implements EcosystemPort {
  constructor(
    private readonly inner: EcosystemPort,
    private readonly cache: SnapshotCache,
    private readonly opts: CachingOptions = {},
  ) {}

  async fetchSnapshot(): Promise<EcosystemSnapshot> {
    const maxAge = this.opts.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
    const now = (this.opts.now ?? Date.now)();
    const cached = this.opts.noCache === true ? null : await this.cache.read();
    const ageMs = cached === null ? Number.NaN : now - Date.parse(cached.observedAt);
    const ageOk = cached !== null && ageMs >= 0 && ageMs <= maxAge; // a future observedAt is not trusted
    const legacy = cached !== null && cached.stellarCli.source === CLI_FIELD_MISSING; // pre-upgrade cache: refetch to fill stellarCli
    const fresh = ageOk && cached.degraded.length === 0 && !legacy; // a degraded snapshot is never "fresh"
    const note = legacy ? ["cached snapshot predates the Stellar CLI check (stellarCli missing); run once with Raven access to refresh it"] : [];

    if (this.opts.offline === true) {
      if (cached === null) {
        throw new Error('No cached snapshot to use with --offline. Run once without it (and with Raven access) to create one.');
      }
      if (ageOk) return legacy ? { ...cached, degraded: [...cached.degraded, ...note] } : cached; // its own degraded notes (if any) are already in the list
      const age = Number.isFinite(ageMs) && ageMs >= 0 ? `snapshot is ${Math.floor(ageMs / HOUR_MS)} hours old` : "snapshot age is unknown";
      return { ...cached, degraded: [...cached.degraded, ...note, age] };
    }
    if (cached !== null && fresh) return cached;

    try {
      const live = await this.inner.fetchSnapshot();
      // Never persist a degraded snapshot: it would be served as truth later. A read-only dir must not fail the run.
      if (live.degraded.length === 0) await this.cache.write(live).catch(() => undefined);
      return live;
    } catch (e) {
      if (cached === null) throw e;
      return { ...cached, degraded: [...cached.degraded, ...note, `using cached snapshot from ${cached.observedAt}`] };
    }
  }
}
