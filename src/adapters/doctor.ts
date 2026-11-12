import { readFile } from "node:fs/promises";
import { judgeStellarCli, nodeSupported, parseStellarVersion, STELLAR_CLI_INSTALL_URL, type DoctorCheck } from "../core/doctor.js";
import { decodeAuth } from "./raven-auth.js";
import { DEFAULT_MAX_AGE_MS, type SnapshotCache } from "./snapshot-cache.js";

export interface DoctorDeps {
  nodeVersion: string;
  env: NodeJS.ProcessEnv;
  authPath: string;
  cache: SnapshotCache;
  now: () => number;
  /** One cheap, non-interactive Raven call; rejects when unreachable or unauthorized. */
  ping: () => Promise<void>;
  /** Runs a program without a shell (`execFile` semantics); rejects on a non-zero exit, a timeout or a missing binary. */
  exec: (file: string, args: string[], opts: { timeout: number }) => Promise<{ stdout: string }>;
  /** Give up on `stellar --version` after this long, whatever `exec` does (default 5 s). */
  cliTimeoutMs?: number;
  /** Give up on the ping after this long (default 10 s). */
  pingTimeoutMs?: number;
}

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

async function authCheck(d: DoctorDeps): Promise<DoctorCheck> {
  const env = d.env["KEDGEWAY_AUTH"];
  if (env !== undefined && env.trim() !== "") {
    try {
      decodeAuth(env);
      return { name: "auth", status: "ok", detail: "KEDGEWAY_AUTH (environment, valid; held in memory)" };
    } catch (e) {
      return { name: "auth", status: "fail", detail: msg(e) };
    }
  }
  let text: string;
  try {
    text = await readFile(d.authPath, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      return { name: "auth", status: "warn", detail: `none: run \`kedgeway login\` (or set KEDGEWAY_AUTH); ${d.authPath} does not exist` };
    }
    return { name: "auth", status: "fail", detail: `could not read ${d.authPath}: ${msg(e)}` };
  }
  try {
    const parsed = JSON.parse(text) as { tokens?: unknown };
    if (parsed.tokens) return { name: "auth", status: "ok", detail: `file ${d.authPath} (tokens present)` };
    return { name: "auth", status: "warn", detail: `file ${d.authPath} has no tokens: run \`kedgeway login\`` };
  } catch {
    return { name: "auth", status: "warn", detail: `file ${d.authPath} is unreadable (it will be quarantined on the next run); run \`kedgeway login\`` };
  }
}

async function cacheCheck(d: DoctorDeps): Promise<DoctorCheck> {
  const snap = await d.cache.read();
  if (snap === null) return { name: "cache", status: "warn", detail: `no cached snapshot at ${d.cache.path}` };
  const ageMs = d.now() - Date.parse(snap.observedAt);
  const where = `${Number.isFinite(ageMs) ? `${Math.floor(ageMs / 3_600_000)} hours old` : "age unknown"}, ${d.cache.path}`;
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > DEFAULT_MAX_AGE_MS) return { name: "cache", status: "warn", detail: `stale: ${where}` };
  if (snap.degraded.length > 0) return { name: "cache", status: "warn", detail: `degraded: ${where}` };
  return { name: "cache", status: "ok", detail: where };
}

const CLI_TIMEOUT_MS = 5000;

async function stellarCliCheck(d: DoctorDeps, offline: boolean): Promise<DoctorCheck> {
  const name = "stellar-cli";
  const ms = d.cliTimeoutMs ?? CLI_TIMEOUT_MS;
  let timer: NodeJS.Timeout | undefined;
  let stdout: string;
  try {
    // exec gets the timeout too, but a child that survives SIGTERM must not hang doctor: race an own timer.
    ({ stdout } = await Promise.race([
      d.exec("stellar", ["--version"], { timeout: ms }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error("timed out"), { killed: true })), ms);
      }),
    ]));
  } catch (e) {
    const err = e as NodeJS.ErrnoException & { killed?: boolean };
    if (err.code === "ENOENT") return { name, status: "warn", detail: `not installed (optional): ${STELLAR_CLI_INSTALL_URL}` };
    if (err.killed === true) return { name, status: "warn", detail: `\`stellar --version\` timed out after ${ms / 1000} s` };
    return { name, status: "warn", detail: `\`stellar --version\` failed: ${msg(e)}` };
  } finally {
    clearTimeout(timer);
  }
  const installed = parseStellarVersion(stdout);
  if (installed === null) {
    const first = stdout.split(/\r?\n/).find((l) => l.trim() !== "")?.trim().slice(0, 80) ?? "(empty)";
    return { name, status: "warn", detail: `unexpected output from \`stellar --version\`: ${first}` };
  }
  if (offline) return judgeStellarCli(installed, null, "offline");
  const snap = await d.cache.read();
  return snap === null ? judgeStellarCli(installed, null, "no cached snapshot") : judgeStellarCli(installed, snap.stellarCli.currentVersion, "snapshot has no CLI version");
}

/** Self-check: Node version, auth state, cache, Stellar CLI, Raven reachability. Never modifies anything. */
export async function runDoctor(d: DoctorDeps, opts: { offline?: boolean }): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = [
    nodeSupported(d.nodeVersion)
      ? { name: "node", status: "ok", detail: `v${d.nodeVersion.replace(/^v/, "")}` }
      : { name: "node", status: "fail", detail: `v${d.nodeVersion.replace(/^v/, "")}: kedgeway needs Node >= 22.12` },
    await authCheck(d),
    await cacheCheck(d),
    await stellarCliCheck(d, opts.offline === true),
  ];
  if (opts.offline === true) {
    checks.push({ name: "raven", status: "skip", detail: "skipped (--offline)" });
  } else {
    const ms = d.pingTimeoutMs ?? 10_000;
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        d.ping(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`timed out after ${ms / 1000} s`)), ms);
        }),
      ]);
      checks.push({ name: "raven", status: "ok", detail: "reachable (search call succeeded)" });
    } catch (e) {
      checks.push({ name: "raven", status: "fail", detail: msg(e) });
    } finally {
      clearTimeout(timer);
    }
  }
  return checks;
}
