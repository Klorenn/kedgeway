import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { LockfileKind } from "../core/lockfile.js";
import { stripCredentials } from "./remote-repo.js";

const execFileP = promisify(execFile);

export interface RefreshExecOptions {
  cwd: string;
  env: NodeJS.ProcessEnv;
  timeout: number;
}
/** execFile-shaped (never a shell). */
export type RefreshExec = (file: string, args: string[], opts: RefreshExecOptions) => Promise<{ stdout: string; stderr: string }>;

const defaultExec: RefreshExec = (file, args, opts) =>
  execFileP(file, args, { cwd: opts.cwd, env: opts.env, timeout: opts.timeout, killSignal: "SIGKILL", windowsHide: true, maxBuffer: 2 * 1024 * 1024 });

const COMMANDS: Record<LockfileKind, { tool: string; args: string[] }> = {
  "Cargo.lock": { tool: "cargo", args: ["update", "-p", "soroban-sdk"] },
  "package-lock.json": { tool: "npm", args: ["install", "--package-lock-only", "--ignore-scripts"] },
  "pnpm-lock.yaml": { tool: "pnpm", args: ["install", "--lockfile-only", "--ignore-scripts"] },
  "yarn.lock": { tool: "yarn", args: ["install", "--mode", "update-lockfile"] },
};

/** The only variables a package manager started by kedgeway sees; everything else (tokens, ACTIONS_*, KW_*) stays out. */
const ENV_ALLOW = new Set([
  "PATH", "HOME", "TMPDIR", "TEMP", "TMP", "LANG", "CI", "CARGO_HOME", "RUSTUP_HOME", "npm_config_cache",
  "HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "no_proxy", "all_proxy",
]);

function allowedEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(env)) if (v !== undefined && (ENV_ALLOW.has(k) || k.startsWith("LC_"))) out[k] = v;
  return out;
}

export interface RefreshResult {
  refreshed: LockfileKind[];
  /** One line per lockfile that could not be refreshed; they go into the PR body. */
  notes: string[];
}

/**
 * Refreshes ONLY the lockfiles `lockfiles` names, with the matching lockfile-only command, when the tool exists.
 * A missing tool or a failing command becomes a note; this never throws.
 */
export async function refreshLockfiles(
  root: string,
  lockfiles: readonly LockfileKind[],
  opts: { exec?: RefreshExec; env?: NodeJS.ProcessEnv; timeoutMs?: number } = {},
): Promise<RefreshResult> {
  const exec = opts.exec ?? defaultExec;
  const env = allowedEnv(opts.env ?? process.env);
  const refreshed: LockfileKind[] = [];
  const notes: string[] = [];
  for (const lock of lockfiles) {
    const { tool, args } = COMMANDS[lock];
    const cmd = `${tool} ${args.join(" ")}`;
    try {
      let childEnv = env;
      if (lock === "yarn.lock") {
        const v = await exec("yarn", ["--version"], { cwd: root, env, timeout: 30_000 });
        const major = /^(\d+)\./.exec(v.stdout.trim())?.[1];
        if (major === undefined) {
          notes.push(`Could not refresh ${lock}: could not read the yarn version. Run \`${cmd}\` yourself.`);
          continue;
        }
        if (Number.parseInt(major, 10) < 2) {
          notes.push(`Skipped refreshing ${lock}: this is Yarn 1 (classic), which ignores --mode and would run install scripts. Run \`yarn install\` yourself, or use Yarn 2+.`);
          continue;
        }
        childEnv = { ...env, YARN_ENABLE_SCRIPTS: "0" };
      }
      await exec(tool, args, { cwd: root, env: childEnv, timeout: opts.timeoutMs ?? 180_000 });
      refreshed.push(lock);
    } catch (e) {
      const err = e as { code?: string | number; stderr?: string; message?: string };
      if (err.code === "ENOENT") {
        notes.push(`Could not refresh ${lock}: ${tool} is not installed on this runner. Run \`${cmd}\` yourself.`);
        continue;
      }
      const first = stripCredentials(((err.stderr ?? "").trim() || err.message || "unknown error").split(/\r?\n/)[0] ?? "", 300);
      notes.push(`Could not refresh ${lock} (\`${cmd}\` failed: ${first}). Run it yourself.`);
    }
  }
  return { refreshed, notes };
}
