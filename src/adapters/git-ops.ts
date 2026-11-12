import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { httpRemote, validateBranchName } from "../core/pr.js";
import { stripCredentials } from "./remote-repo.js";

const execFileP = promisify(execFile);

export interface GitExecOptions {
  cwd: string;
  env: NodeJS.ProcessEnv;
  timeout: number;
}
/** execFile-shaped (never a shell): the file and its argument array. */
export type GitExec = (file: string, args: string[], opts: GitExecOptions) => Promise<{ stdout: string; stderr: string }>;

const defaultExec: GitExec = (file, args, opts) =>
  execFileP(file, args, { cwd: opts.cwd, env: opts.env, timeout: opts.timeout, killSignal: "SIGKILL", windowsHide: true, maxBuffer: 4 * 1024 * 1024 });

export const BOT_NAME = "kedgeway[bot]";
export const BOT_EMAIL = "kedgeway@users.noreply.github.com";

export interface GitOpsOptions {
  /** Working directory: the repository (or a directory inside it). */
  cwd: string;
  exec?: GitExec;
  /** Environment (default `process.env`). `KEDGEWAY_GIT_AUTHOR_NAME` / `KEDGEWAY_GIT_AUTHOR_EMAIL` override the commit author. */
  env?: NodeJS.ProcessEnv;
  /** git executable (default `git`). */
  git?: string;
}

export interface GitAuth {
  /** GitHub token; sent only to `allowedHost`, as a URL-scoped http.extraheader. */
  token?: string;
  /** The git host the token may be sent to (`github.com`, a GHES host, or `host:port` for tests). */
  allowedHost?: string;
}

export interface GitOps {
  /** The checked-out branch, or null on a detached HEAD. */
  currentBranch(): Promise<string | null>;
  headSha(): Promise<string>;
  /** True when there are no tracked changes and no untracked files. */
  isClean(): Promise<boolean>;
  /** Creates (or resets) `name` from `origin/<base>` (else the local `base` branch, never HEAD) and checks it out. */
  checkoutNewBranch(name: string, base: string, remote?: string): Promise<void>;
  /** Best-effort `git fetch` of `<remote>/<branch>`; false when it failed (offline, no access). Throws only when the token may not go to that host. */
  fetchBranch(remote: string, branch: string, auth: GitAuth): Promise<boolean>;
  checkout(ref: string, opts?: { force?: boolean }): Promise<void>;
  /** Changed or untracked paths, as pathspecs for `git add` from `cwd` (`:(top)path` for files outside `cwd`). */
  changedFiles(): Promise<string[]>;
  /** Stages exactly `files` and commits them as the bot (no hooks, no signing). Returns the new commit sha. */
  commitAll(message: string, files: readonly string[]): Promise<string>;
  /**
   * Pushes `refs/heads/<name>`. With `force` it uses `--force-with-lease` pinned to the sha `ls-remote` reports (empty
   * when the branch does not exist), so a branch that moved is never overwritten blindly. The token travels in the
   * environment as a URL-scoped http.extraheader, never in argv, and only to `allowedHost`.
   */
  pushBranch(remote: string, name: string, opts: { force: boolean } & GitAuth): Promise<void>;
  remoteUrl(remote?: string): Promise<string>;
  /** The URL a push to `remote` goes to. */
  pushUrl(remote?: string): Promise<string>;
}

function validateRemote(remote: string): string {
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(remote) || remote.startsWith("-")) throw new Error("Invalid remote name");
  return remote;
}

function validateRef(ref: string): string {
  if (/^[0-9a-f]{7,40}$/.test(ref)) return ref;
  return validateBranchName(ref);
}

function ident(v: string | undefined, fallback: string): string {
  const t = v?.trim();
  return t !== undefined && t !== "" && !/[\r\n<>]/.test(t) ? t : fallback;
}

export function createGitOps(opts: GitOpsOptions): GitOps {
  const exec = opts.exec ?? defaultExec;
  const git = opts.git ?? "git";
  const baseEnv = (): NodeJS.ProcessEnv => {
    const env = { ...(opts.env ?? process.env) };
    for (const k of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"]) delete env[k];
    env["GIT_TERMINAL_PROMPT"] = "0";
    return env;
  };

  const call = async (args: string[], extra: { env?: NodeJS.ProcessEnv; timeout?: number; secrets?: string[] } = {}): Promise<string> => {
    try {
      const { stdout } = await exec(git, args, { cwd: opts.cwd, env: extra.env ?? baseEnv(), timeout: extra.timeout ?? 30_000 });
      return stdout;
    } catch (e) {
      const err = e as { stderr?: string; message?: string; code?: string | number };
      if (err.code === "ENOENT") throw new Error("git is not installed or not on PATH");
      let detail = (err.stderr ?? "").trim() || err.message || "unknown error";
      for (const s of extra.secrets ?? []) if (s !== "") detail = detail.split(s).join("***");
      detail = stripCredentials(detail).replace(/(AUTHORIZATION:\s*basic\s+)\S+/gi, "$1***");
      throw new Error(`git ${args[0] === "-c" ? (args[2] ?? "") : (args[0] ?? "")} failed: ${detail}`);
    }
  };

  /** stdout, or null when git exits 1 (a "not found" answer from symbolic-ref / rev-parse --quiet). */
  const probe = async (args: string[]): Promise<string | null> => {
    try {
      const { stdout } = await exec(git, args, { cwd: opts.cwd, env: baseEnv(), timeout: 30_000 });
      return stdout.trim();
    } catch (e) {
      const err = e as { code?: string | number };
      if (err.code === 1) return null;
      return call(args); // rethrows with a clean message
    }
  };

  /** Environment for a network command: with a token and an http(s) push URL, adds the URL-scoped credential. */
  const authEnv = async (remote: string, auth: GitAuth): Promise<{ env: NodeJS.ProcessEnv; secrets: string[] }> => {
    const env = baseEnv();
    if (auth.token === undefined || auth.token === "") return { env, secrets: [] };
    const target = httpRemote((await call(["remote", "get-url", "--push", remote])).trim());
    if (target === null) return { env, secrets: [] }; // ssh, file and local remotes ignore http headers: git uses its own credentials
    if (auth.allowedHost === undefined || target.host !== auth.allowedHost.toLowerCase()) {
      throw new Error(`refusing to send the GitHub token to host ${target.host}: the ${remote} push URL must point at ${auth.allowedHost ?? "the GitHub host"}`);
    }
    const header = `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${auth.token}`).toString("base64")}`;
    // URL-scoped, because git uses the most specific http.<url>.extraheader and actions/checkout persists one for
    // github.com; an unscoped key would lose. The empty value first clears whatever was configured for this URL.
    const key = `http.${target.scheme}://${target.host}/.extraheader`;
    const n = Number.parseInt(env["GIT_CONFIG_COUNT"] ?? "0", 10);
    const count = Number.isInteger(n) && n >= 0 ? n : 0;
    env[`GIT_CONFIG_KEY_${count}`] = key;
    env[`GIT_CONFIG_VALUE_${count}`] = "";
    env[`GIT_CONFIG_KEY_${count + 1}`] = key;
    env[`GIT_CONFIG_VALUE_${count + 1}`] = header;
    env["GIT_CONFIG_COUNT"] = String(count + 2);
    return { env, secrets: [auth.token, header.slice("AUTHORIZATION: basic ".length)] };
  };

  const self: GitOps = {
    async currentBranch() {
      const out = await probe(["symbolic-ref", "--quiet", "--short", "HEAD"]);
      return out === null || out === "" ? null : out;
    },
    async headSha() {
      return (await call(["rev-parse", "HEAD"])).trim();
    },
    async isClean() {
      return (await call(["status", "--porcelain=v1", "--untracked-files=all"])).trim() === "";
    },
    async checkoutNewBranch(name, base, remoteName = "origin") {
      validateBranchName(name);
      validateRef(base);
      validateRemote(remoteName);
      const remote = await probe(["rev-parse", "--verify", "--quiet", `refs/remotes/${remoteName}/${base}^{commit}`]);
      const local = remote === null ? await probe(["rev-parse", "--verify", "--quiet", `refs/heads/${base}^{commit}`]) : null;
      let start: string;
      if (remote !== null) start = `refs/remotes/${remoteName}/${base}`;
      else if (local !== null) start = `refs/heads/${base}`;
      else throw new Error(`base branch ${base} not found locally or on ${remoteName} (fetch it first; with actions/checkout use fetch-depth: 0)`);
      await call(["checkout", "--no-guess", "-B", name, start, "--"]);
    },
    async fetchBranch(remote, branch, auth) {
      validateRemote(remote);
      validateBranchName(branch);
      const { env, secrets } = await authEnv(remote, auth);
      try {
        await call(["fetch", "--no-tags", "--quiet", "--", remote, `+refs/heads/${branch}:refs/remotes/${remote}/${branch}`], { env, timeout: 120_000, secrets });
        return true;
      } catch {
        return false;
      }
    },
    async checkout(ref, o = {}) {
      validateRef(ref);
      await call(["checkout", "--no-guess", ...(o.force ? ["-f"] : []), ref, "--"]);
    },
    async changedFiles() {
      const prefix = (await call(["rev-parse", "--show-prefix"])).trim();
      const out = await call(["status", "--porcelain=v1", "-z", "--untracked-files=all", "--no-renames"]);
      const files: string[] = [];
      for (const rec of out.split("\0")) {
        if (rec.length < 4) continue;
        const path = rec.slice(3);
        files.push(prefix !== "" && path.startsWith(prefix) ? path.slice(prefix.length) : prefix === "" ? path : `:(top)${path}`);
      }
      return files;
    },
    async commitAll(message, files) {
      if (files.length === 0) throw new Error("no files to commit");
      const env = baseEnv();
      const name = ident(env["KEDGEWAY_GIT_AUTHOR_NAME"], BOT_NAME);
      const email = ident(env["KEDGEWAY_GIT_AUTHOR_EMAIL"], BOT_EMAIL);
      Object.assign(env, { GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: email, GIT_COMMITTER_NAME: name, GIT_COMMITTER_EMAIL: email });
      await call(["add", "--", ...files], { env });
      await call(["-c", "commit.gpgsign=false", "commit", "--no-verify", "-m", message], { env });
      return (await call(["rev-parse", "HEAD"], { env })).trim();
    },
    async pushBranch(remote, name, o) {
      validateRemote(remote);
      validateBranchName(name);
      const { env, secrets } = await authEnv(remote, o);
      let lease: string[] = [];
      if (o.force) {
        const ref = `refs/heads/${name}`;
        const listed = await call(["ls-remote", "--heads", "--", remote, ref], { env, timeout: 120_000, secrets });
        const line = listed.split("\n").find((l) => l.trim().endsWith(`\t${ref}`) || l.trim().endsWith(` ${ref}`));
        const sha = line === undefined ? "" : (line.trim().split(/\s+/)[0] ?? "");
        if (sha !== "" && !/^[0-9a-f]{40,64}$/.test(sha)) throw new Error("git ls-remote returned an unexpected answer");
        lease = [`--force-with-lease=${ref}:${sha}`];
      }
      await call(["push", ...lease, "--", remote, `refs/heads/${name}:refs/heads/${name}`], { env, timeout: 120_000, secrets });
    },
    async remoteUrl(remote = "origin") {
      validateRemote(remote);
      return (await call(["remote", "get-url", remote])).trim();
    },
    async pushUrl(remote = "origin") {
      validateRemote(remote);
      return (await call(["remote", "get-url", "--push", remote])).trim();
    },
  };
  return self;
}
