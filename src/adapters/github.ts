import { validateBranchName, validateRepoSlug } from "../core/pr.js";

export const GITHUB_TIMEOUT_MS = 60_000;
const DEFAULT_API_BASE = "https://api.github.com";
const MAX_MESSAGE = 600;

export interface GhFetchInit {
  method: string;
  headers: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
  /** Always "error": the token must never follow a redirect. */
  redirect?: "error";
}
export type GhFetch = (url: string, init: GhFetchInit) => Promise<Response>;

export interface GithubOptions {
  /** A GitHub token (`GITHUB_TOKEN` or a PAT). Only ever sent in the Authorization header. */
  token: string;
  /** `owner/repo`. */
  repo: string;
  fetch?: GhFetch;
  /** Default `https://api.github.com`; https only, except loopback (tests). */
  apiBase?: string;
  timeoutMs?: number;
  /** Delay before the single 5xx retry (override for tests). */
  sleep?: (ms: number) => Promise<void>;
}

export interface GithubRepo {
  fullName: string;
  defaultBranch: string;
  htmlUrl: string;
}

export interface GithubPr {
  number: number;
  url: string;
  state: string;
  headRef: string;
  baseRef: string;
}

export interface GithubClient {
  getRepo(): Promise<GithubRepo>;
  getDefaultBranch(): Promise<string>;
  /** The lowest-numbered OPEN PR whose head branch is `branch` (in this repo) and, when given, whose base is `base`; else null. */
  findOpenPr(branch: string, base?: string): Promise<GithubPr | null>;
  createPr(input: { title: string; body: string; head: string; base: string; draft?: boolean }): Promise<GithubPr>;
  updatePr(number: number, input: { title?: string; body?: string }): Promise<GithubPr>;
  /** Creates each label if missing (a 422 means it exists) and applies them to the PR. */
  addLabels(number: number, labels: string[], meta?: { color?: string; description?: string }): Promise<void>;
}

export class GithubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GithubError";
  }
}

const defaultFetch: GhFetch = (url, init) => fetch(url, init);
const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function checkApiBase(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("Invalid API base URL");
  }
  const loopback = u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]";
  if (u.username !== "" || u.password !== "" || !(u.protocol === "https:" || (u.protocol === "http:" && loopback))) {
    throw new Error("Invalid API base URL (https only; plain http is allowed for localhost; no credentials)");
  }
  return raw.replace(/\/+$/, "");
}

function hintFor(status: number, method: string): string {
  if (status === 401) return " Hint: the token was rejected (missing, expired or revoked). Pass a valid GITHUB_TOKEN.";
  if (status === 403) {
    return (
      " Hint: give the workflow `permissions: contents: write` and `pull-requests: write`, and allow it in the repository or organization under " +
      "Settings > Actions > General > Workflow permissions > \"Allow GitHub Actions to create and approve pull requests\"."
    );
  }
  if (status === 404) return method === "GET" ? " Hint: repository not found, or the token cannot see it." : " Hint: the repository or pull request was not found, or the token has no write access.";
  return "";
}

export function createGithubClient(o: GithubOptions): GithubClient {
  if (o.token === "" || !/^[\x21-\x7e]+$/.test(o.token)) throw new Error("Invalid GitHub token (empty or contains whitespace)");
  const { owner, repo } = validateRepoSlug(o.repo);
  const base = checkApiBase(o.apiBase ?? DEFAULT_API_BASE);
  const doFetch = o.fetch ?? defaultFetch;
  const sleep = o.sleep ?? defaultSleep;
  const timeoutMs = o.timeoutMs ?? GITHUB_TIMEOUT_MS;
  const scrub = (s: string): string => s.split(o.token).join("***");
  const repoPath = `/repos/${owner}/${repo}`;

  async function request(method: string, path: string, body?: unknown, okStatuses: number[] = []): Promise<{ status: number; data: unknown }> {
    const url = `${base}${path}`;
    let attempt = 0;
    for (;;) {
      attempt += 1;
      let res: Response;
      try {
        res = await doFetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${o.token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "kedgeway",
            ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: AbortSignal.timeout(timeoutMs),
          redirect: "error",
        });
      } catch (e) {
        const name = (e as { name?: string }).name;
        if (name === "TimeoutError" || name === "AbortError") throw new GithubError(`GitHub API ${method} ${path} timed out after ${Math.round(timeoutMs / 1000)} s`, 0);
        throw new GithubError(`GitHub API ${method} ${path} failed: ${scrub(e instanceof Error ? e.message : String(e)).slice(0, MAX_MESSAGE)}`, 0);
      }
      const text = await res.text().catch(() => "");
      let data: unknown = undefined;
      try {
        data = text === "" ? undefined : JSON.parse(text);
      } catch {
        data = undefined;
      }
      if (res.status >= 500 && attempt === 1 && method === "GET") { // a write may have been applied: never replay it
        await sleep(1000);
        continue;
      }
      if ((res.status >= 200 && res.status < 300) || okStatuses.includes(res.status)) return { status: res.status, data };
      const d = data as { message?: unknown; errors?: unknown } | undefined;
      let msg = typeof d?.message === "string" ? d.message : text.slice(0, 200) || res.statusText || "no message";
      if (Array.isArray(d?.errors)) {
        const details = (d.errors as unknown[])
          .map((x) => (typeof x === "string" ? x : typeof (x as { message?: unknown })?.message === "string" ? (x as { message: string }).message : ""))
          .filter((x) => x !== "");
        if (details.length > 0) msg += ` (${details.join("; ")})`;
      }
      throw new GithubError(`GitHub API ${res.status} on ${method} ${path}: ${scrub(msg).slice(0, MAX_MESSAGE)}.${hintFor(res.status, method)}`, res.status);
    }
  }

  const toPr = (data: unknown): GithubPr => {
    const d = data as { number?: number; html_url?: string; state?: string; head?: { ref?: string }; base?: { ref?: string } };
    if (typeof d?.number !== "number" || typeof d.html_url !== "string") throw new GithubError("GitHub API returned an unexpected pull request payload", 0);
    return { number: d.number, url: d.html_url, state: d.state ?? "open", headRef: d.head?.ref ?? "", baseRef: d.base?.ref ?? "" };
  };

  const getRepo = async (): Promise<GithubRepo> => {
    const d = (await request("GET", repoPath)).data as { full_name?: string; default_branch?: string; html_url?: string };
    if (typeof d?.default_branch !== "string") throw new GithubError("GitHub API returned no default branch", 0);
    return { fullName: d.full_name ?? `${owner}/${repo}`, defaultBranch: d.default_branch, htmlUrl: d.html_url ?? `https://github.com/${owner}/${repo}` };
  };

  return {
    getRepo,
    async getDefaultBranch() {
      return (await getRepo()).defaultBranch;
    },
    async findOpenPr(branch, base) {
      validateBranchName(branch);
      const head = encodeURIComponent(`${owner}:${branch}`);
      const baseQ = base === undefined ? "" : `&base=${encodeURIComponent(base)}`;
      const data = (await request("GET", `${repoPath}/pulls?state=open&head=${head}${baseQ}&per_page=100`)).data;
      const prs = (Array.isArray(data) ? data : []).map(toPr).filter((p) => p.state === "open" && p.headRef === branch && (base === undefined || p.baseRef === base));
      prs.sort((a, b) => a.number - b.number);
      return prs[0] ?? null;
    },
    async createPr(input) {
      return toPr((await request("POST", `${repoPath}/pulls`, { title: input.title, body: input.body, head: input.head.includes(":") ? input.head : `${owner}:${input.head}`, base: input.base, draft: input.draft === true })).data);
    },
    async updatePr(number, input) {
      if (!Number.isInteger(number) || number < 1) throw new Error("Invalid pull request number");
      return toPr((await request("PATCH", `${repoPath}/pulls/${number}`, { ...(input.title === undefined ? {} : { title: input.title }), ...(input.body === undefined ? {} : { body: input.body }) })).data);
    },
    async addLabels(number, labels, meta = {}) {
      if (!Number.isInteger(number) || number < 1) throw new Error("Invalid pull request number");
      for (const name of labels) {
        await request("POST", `${repoPath}/labels`, { name, color: meta.color ?? "5319e7", description: meta.description ?? "Opened by kedgeway" }, [422]);
      }
      await request("POST", `${repoPath}/issues/${number}/labels`, { labels });
    },
  };
}
