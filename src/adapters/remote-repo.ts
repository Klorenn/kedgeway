import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { validateRef, type RemoteSource } from "../core/remote-source.js";
import { extractTarGz, MAX_UNPACKED_BYTES } from "./tarball.js";

const execFileP = promisify(execFile);

export const CLONE_TIMEOUT_MS = 60_000;

export interface RemoteExecOptions {
  env: NodeJS.ProcessEnv;
  timeout: number;
  killSignal: NodeJS.Signals;
}
/** execFile-shaped (never a shell): the file and its argument array. */
export type RemoteExec = (file: string, args: string[], opts: RemoteExecOptions) => Promise<{ stdout: string; stderr: string }>;
export type RemoteFetch = (url: string, init?: { signal?: AbortSignal }) => Promise<Response>;

export interface RemoteRepoOptions {
  /** `--ref`; must agree with a ref already present in the source. */
  ref?: string;
  exec?: RemoteExec;
  fetch?: RemoteFetch;
  /** git executable (default `git`). */
  git?: string;
  timeoutMs?: number;
  /** Parent directory for the temp dir (default `os.tmpdir()`). */
  tmpRoot?: string;
  /**
   * @internal Extra git transports to allow. Exists for the integration test that clones a local bare repo over
   * `file://`; re-enabling `file` or `ext` for real sources defeats the hardening. Not part of the supported API.
   */
  extraProtocols?: string[];
}

const defaultExec: RemoteExec = (file, args, opts) =>
  execFileP(file, args, { env: opts.env, timeout: opts.timeout, killSignal: opts.killSignal, windowsHide: true, maxBuffer: 1024 * 1024 });

const MAX_DETAIL_CHARS = 2000;

/**
 * Removes `scheme://user:pass@` credentials from text that may be shown to the user. The text is cut to
 * `max` characters first and the quantifiers are bounded, so hostile stderr cannot cause quadratic work.
 */
export function stripCredentials(text: string, max: number = MAX_DETAIL_CHARS): string {
  return text.slice(0, max).replace(/([A-Za-z][A-Za-z0-9+.-]{0,31}:\/\/)[^/\s@]{1,256}@/g, "$1***@");
}

function effectiveRef(source: RemoteSource, ref: string | undefined): string | undefined {
  if (ref !== undefined) validateRef(ref);
  if (source.ref !== undefined && ref !== undefined && source.ref !== ref) {
    throw new Error(`--ref ${ref} conflicts with the ref in the URL (${source.ref})`);
  }
  return source.ref ?? ref;
}

async function gitClone(source: RemoteSource, ref: string | undefined, dir: string, opts: RemoteRepoOptions): Promise<void> {
  const timeout = opts.timeoutMs ?? CLONE_TIMEOUT_MS;
  // Untrusted repo and URL: symlinks become plain text files, redirects are not followed, git-lfs filters are off,
  // and only the transport of this very URL is allowed (never file://, git://, ext::).
  const scheme = source.cloneUrl.startsWith("https://") ? "https" : source.cloneUrl.startsWith("http://") ? "http" : "ssh";
  const protocols = [...new Set([scheme, ...(opts.extraProtocols ?? [])])];
  const args = [
    "-c", "core.symlinks=false",
    "-c", "http.followRedirects=false",
    "-c", "filter.lfs.process=",
    "-c", "filter.lfs.smudge=",
    "-c", "filter.lfs.required=false",
    "-c", "protocol.allow=never",
    ...protocols.flatMap((p) => ["-c", `protocol.${p}.allow=always`]),
    "clone", "--depth", "1", "--single-branch", ...(ref === undefined ? [] : ["--branch", ref]), "--no-tags",
    "--", source.cloneUrl, dir,
  ];
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_LFS_SKIP_SMUDGE: "1" };
  if (!env["GIT_SSH_COMMAND"]) env["GIT_SSH_COMMAND"] = "ssh -oBatchMode=yes";
  await (opts.exec ?? defaultExec)(opts.git ?? "git", args, {
    env,
    timeout,
    killSignal: "SIGKILL",
  });
}

/** Reads the body chunk by chunk and cancels the stream as soon as it exceeds `max` bytes. */
async function readCapped(res: Response, max: number): Promise<Uint8Array> {
  if (res.body === null) return new Uint8Array(0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => undefined);
      throw new Error(`archive too large (over ${max} bytes)`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

async function tarballClone(source: RemoteSource, ref: string | undefined, dir: string, opts: RemoteRepoOptions): Promise<void> {
  const fetchFn: RemoteFetch = opts.fetch ?? ((url, init) => fetch(url, init));
  const url = `https://codeload.github.com/${source.owner}/${source.repo}/tar.gz/${ref ?? "HEAD"}`;
  const res = await fetchFn(url, { signal: AbortSignal.timeout(opts.timeoutMs ?? CLONE_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`could not download ${source.display}: HTTP ${res.status} from codeload.github.com`);
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_UNPACKED_BYTES) throw new Error(`archive too large (over ${MAX_UNPACKED_BYTES} bytes)`);
  const body = await readCapped(res, MAX_UNPACKED_BYTES);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await extractTarGz(body, dir);
}

/**
 * Makes a shallow copy of a remote repository in a private temp dir (mode 0700), runs `fn` with its path
 * and always removes the temp dir. Uses `git clone --depth 1` (execFile, no shell, no prompts); when git is
 * not installed and the host is github.com it downloads the codeload tarball and unpacks it with Node only.
 */
export async function withRemoteRepo<T>(source: RemoteSource, opts: RemoteRepoOptions, fn: (dir: string) => Promise<T>): Promise<T> {
  const ref = effectiveRef(source, opts.ref);
  const base = await mkdtemp(join(opts.tmpRoot ?? tmpdir(), "kedgeway-"));
  const dir = join(base, "repo");
  try {
    try {
      await gitClone(source, ref, dir, opts);
    } catch (e) {
      const err = e as { code?: string | number; killed?: boolean; stderr?: string; message?: string };
      if (err.code === "ENOENT") {
        if (source.host !== "github.com") {
          throw new Error(`git is not installed, and the tarball fallback only works for github.com (${source.display}). Install git and retry.`);
        }
        await rm(dir, { recursive: true, force: true });
        await tarballClone(source, ref, dir, opts);
        return await fn(dir);
      }
      if (err.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") throw new Error(`could not clone ${source.display}: git produced too much output`);
      if (err.killed === true) throw new Error(`could not clone ${source.display}: timed out after ${(opts.timeoutMs ?? CLONE_TIMEOUT_MS) / 1000} s`);
      const detail = stripCredentials(err.stderr ?? "").trim() || stripCredentials(err.message ?? String(e)).trim();
      // never show the private temp path: the user knows the source, not our scratch dir
      const shown = detail.split(dir).join(source.display).split(base).join(source.display);
      throw new Error(`could not clone ${source.display}: ${shown}`);
    }
    return await fn(dir);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
}
