import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GhFetch } from "./adapters/github.js";
import type { RefreshExec } from "./adapters/lockfile-refresh.js";
import { openPr, planPr, PrUsageError, type OpenPrOptions } from "./pr-flow.js";

const run = promisify(execFile);
const fixture = resolve(import.meta.dirname, "../fixtures/ecosystem-2026-11-11.json");
const TOKEN = "ghs_SuperSecretToken123";

let tmp: string;
let bare: string;
let work: string;
const gitEnv = (): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };
  for (const k of ["GITHUB_REPOSITORY", "GITHUB_TOKEN", "GITHUB_API_URL", "KEDGEWAY_GIT_AUTHOR_NAME", "KEDGEWAY_GIT_AUTHOR_EMAIL"]) delete env[k];
  return env;
};
const git = (cwd: string, ...args: string[]) => run("git", args, { cwd, env: gitEnv() }).then((r) => r.stdout.trim());

async function setup(cargo = `[package]\nname = "c"\nversion = "0.1.0"\n\n[dependencies]\nsoroban-sdk = "21.0.0"\n`, extra: Record<string, string> = {}): Promise<void> {
  tmp = await mkdtemp(join(tmpdir(), "kw-prflow-"));
  bare = join(tmp, "origin.git");
  work = join(tmp, "work");
  await git(tmp, "init", "--bare", "-b", "main", bare);
  await git(tmp, "init", "-b", "main", work);
  await writeFile(join(work, "Cargo.toml"), cargo);
  for (const [f, c] of Object.entries(extra)) await writeFile(join(work, f), c);
  await git(work, "add", "-A");
  await git(work, "commit", "-m", "init");
  await git(work, "remote", "add", "origin", bare);
  await git(work, "push", "origin", "main");
}
afterEach(async () => {
  if (tmp) await rm(tmp, { recursive: true, force: true });
});

interface Req {
  method: string;
  path: string;
  body: Record<string, unknown> | undefined;
  auth: string | undefined;
}
function fakeGithub(over: { existing?: { number: number; head: string; base?: string }[]; createStatus?: number; createMessage?: string; repoStatus?: number; labelStatus?: number } = {}) {
  const reqs: Req[] = [];
  const fetch: GhFetch = async (url, init) => {
    const u = new URL(url);
    const path = u.pathname + u.search;
    reqs.push({ method: init.method, path, body: init.body === undefined ? undefined : (JSON.parse(init.body) as Record<string, unknown>), auth: init.headers["Authorization"] });
    const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s });
    if (init.method === "GET" && u.pathname === "/repos/o/r") return over.repoStatus ? json(over.repoStatus, { message: "nope" }) : json(200, { full_name: "o/r", default_branch: "main", html_url: "https://github.com/o/r" });
    if (init.method === "GET" && u.pathname === "/repos/o/r/pulls") return json(200, (over.existing ?? []).map((p) => ({ number: p.number, html_url: `https://github.com/o/r/pull/${p.number}`, state: "open", head: { ref: p.head }, base: { ref: p.base ?? "main" } })));
    if (init.method === "POST" && u.pathname === "/repos/o/r/pulls") {
      return over.createStatus ? json(over.createStatus, { message: over.createMessage ?? "boom" }) : json(201, { number: 31, html_url: "https://github.com/o/r/pull/31", state: "open", head: { ref: (JSON.parse(init.body ?? "{}") as { head: string }).head } });
    }
    if (init.method === "PATCH") return json(200, { number: Number(u.pathname.split("/").pop()), html_url: `https://github.com/o/r/pull/${u.pathname.split("/").pop()}`, state: "open", head: { ref: "kedgeway/migrate-28" } });
    if (u.pathname.endsWith("/labels") && u.pathname === "/repos/o/r/labels") return json(201, {});
    if (u.pathname.endsWith("/labels")) return over.labelStatus ? json(over.labelStatus, { message: "label boom" }) : json(200, []);
    return json(404, { message: "unexpected" });
  };
  return { fetch, reqs };
}

function opts(over: Partial<OpenPrOptions> = {}, gh = fakeGithub()): { o: OpenPrOptions; gh: ReturnType<typeof fakeGithub> } {
  return {
    gh,
    o: { path: work, fixture, repo: "o/r", token: TOKEN, version: "9.9.9", env: gitEnv(), deps: { fetch: gh.fetch, sleep: async () => {} }, ...over },
  };
}

describe("planPr", () => {
  beforeEach(() => setup());
  it("computes branch, title and body without touching git or the network", async () => {
    const p = await planPr({ path: work, fixture, version: "9.9.9" });
    expect(p.hasEdits).toBe(true);
    expect(p.branch).toBe("kedgeway/migrate-28");
    expect(p.title).toBe("chore(deps): migrate soroban-sdk to 28");
    expect(p.body).toContain("`soroban-sdk`");
    expect(p.body).toContain("Opened by kedgeway 9.9.9");
    expect(await git(work, "status", "--porcelain")).toBe("");
  });
});

describe("openPr: dry run and skip", () => {
  beforeEach(() => setup());

  it("--dry-run returns title and body, even on a dirty tree, with no git or network writes", async () => {
    await writeFile(join(work, "dirty.txt"), "x");
    const { o, gh } = opts({ dryRun: true, token: undefined });
    const r = await openPr(o);
    expect(r.action).toBe("dry-run");
    expect(r.title).toBe("chore(deps): migrate soroban-sdk to 28");
    expect(r.branch).toBe("kedgeway/migrate-28");
    expect(r.body).toContain("## Edits");
    expect(gh.reqs).toHaveLength(0);
    expect(await git(work, "branch", "--list")).not.toContain("kedgeway");
    expect(await git(bare, "branch", "--list")).not.toContain("kedgeway");
    expect(await readFile(join(work, "Cargo.toml"), "utf8")).toContain('"21.0.0"');
  });

  it("refuses a dirty tree with a usage error before any network call", async () => {
    await writeFile(join(work, "dirty.txt"), "x");
    const { o, gh } = opts();
    const e = await openPr(o).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(PrUsageError);
    expect((e as Error).message).toMatch(/uncommitted/i);
    expect(gh.reqs).toHaveLength(0);
  });

  it("skips, with no network and no git change, when there is nothing to edit", async () => {
    await rm(tmp, { recursive: true, force: true });
    await setup(`[package]\nname = "c"\nversion = "0.1.0"\n\n[dependencies]\nsoroban-sdk = "28.0.0"\n`);
    const { o, gh } = opts();
    const r = await openPr(o);
    expect(r.action).toBe("skip");
    expect(r.reason).toMatch(/no automatic edits/i);
    expect(gh.reqs).toHaveLength(0);
    expect(await git(bare, "branch", "--list")).not.toContain("kedgeway");
  });

  it("needs a token and a repository", async () => {
    const a = opts({ token: undefined });
    await expect(openPr(a.o)).rejects.toThrow(/token/i);
    const b = opts({ repo: undefined });
    const e = await openPr(b.o).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(PrUsageError);
    expect((e as Error).message).toMatch(/--repo/);
    const c = opts({ repo: "not a repo" });
    await expect(openPr(c.o)).rejects.toBeInstanceOf(PrUsageError);
    const d = opts({ branch: "bad branch" });
    await expect(openPr(d.o)).rejects.toBeInstanceOf(PrUsageError);
  });
});

describe("openPr: create and update", () => {
  beforeEach(() => setup());

  it("creates the branch, commits the edits as the bot, pushes it and opens the PR", async () => {
    const { o, gh } = opts({ draft: true });
    const r = await openPr(o);
    expect(r).toMatchObject({ action: "create", url: "https://github.com/o/r/pull/31", number: 31, branch: "kedgeway/migrate-28", base: "main", title: "chore(deps): migrate soroban-sdk to 28" });

    expect(await git(bare, "branch", "--list", "kedgeway/*")).toContain("kedgeway/migrate-28");
    expect(await git(bare, "show", "kedgeway/migrate-28:Cargo.toml")).toContain('soroban-sdk = "28.0.0"');
    expect(await git(bare, "log", "-1", "--format=%an <%ae>|%s", "kedgeway/migrate-28")).toBe("kedgeway[bot] <kedgeway@users.noreply.github.com>|chore(deps): migrate soroban-sdk to 28");
    expect(await git(bare, "rev-parse", "main")).toBe(await git(work, "rev-parse", "main"));

    const create = gh.reqs.find((q) => q.method === "POST" && q.path === "/repos/o/r/pulls");
    expect(create?.body).toMatchObject({ title: "chore(deps): migrate soroban-sdk to 28", head: "o:kedgeway/migrate-28", base: "main", draft: true });
    expect(String(create?.body?.["body"])).toContain("Opened by kedgeway 9.9.9");
    expect(gh.reqs.some((q) => q.path === "/repos/o/r/issues/31/labels" && JSON.stringify(q.body) === '{"labels":["kedgeway"]}')).toBe(true);
    expect(gh.reqs.every((q) => q.auth === `Bearer ${TOKEN}`)).toBe(true);

    expect(await git(work, "branch", "--show-current")).toBe("main");
    expect(await readFile(join(work, "Cargo.toml"), "utf8")).toContain('"21.0.0"');
  });

  it("looks up the default branch through the API when --base is not given", async () => {
    const { o, gh } = opts();
    await openPr(o);
    expect(gh.reqs[0]).toMatchObject({ method: "GET", path: "/repos/o/r" });
  });

  it("updates the open PR on the same branch instead of creating a second one", async () => {
    const { o, gh } = opts({}, fakeGithub({ existing: [{ number: 17, head: "kedgeway/migrate-28" }] }));
    const r = await openPr(o);
    expect(r).toMatchObject({ action: "update", number: 17, url: "https://github.com/o/r/pull/17" });
    expect(gh.reqs.some((q) => q.method === "POST" && q.path === "/repos/o/r/pulls")).toBe(false);
    const patch = gh.reqs.find((q) => q.method === "PATCH");
    expect(patch?.path).toBe("/repos/o/r/pulls/17");
    expect(Object.keys(patch?.body ?? {}).sort()).toEqual(["body", "title"]);
    expect(await git(bare, "branch", "--list", "kedgeway/*")).toContain("kedgeway/migrate-28");
  });

  it("running twice force-pushes the same branch and never opens two PRs", async () => {
    const first = opts();
    await openPr(first.o);
    const shaAfterFirst = await git(bare, "rev-parse", "kedgeway/migrate-28");
    const second = opts({}, fakeGithub({ existing: [{ number: 31, head: "kedgeway/migrate-28" }] }));
    const r = await openPr(second.o);
    expect(r.action).toBe("update");
    expect(second.gh.reqs.filter((q) => q.method === "POST" && q.path === "/repos/o/r/pulls")).toHaveLength(0);
    expect(await git(bare, "rev-parse", "kedgeway/migrate-28")).not.toBe("");
    expect(await git(work, "branch", "--list", "kedgeway/*")).toContain("kedgeway/migrate-28");
    expect(shaAfterFirst).toMatch(/^[0-9a-f]{40}$/);
  });

  it("honours --branch, --base and --label", async () => {
    await git(work, "branch", "dev");
    await git(work, "push", "origin", "dev");
    const { o, gh } = opts({ branch: "bot/sdk-28", base: "dev", label: "deps", allowAnyBranch: true });
    const r = await openPr(o);
    expect(r.branch).toBe("bot/sdk-28");
    expect(await git(bare, "branch", "--list", "bot/*")).toContain("bot/sdk-28");
    expect(gh.reqs.find((q) => q.method === "POST" && q.path === "/repos/o/r/pulls")?.body).toMatchObject({ head: "o:bot/sdk-28", base: "dev" });
    expect(gh.reqs.some((q) => q.path === "/repos/o/r/issues/31/labels" && JSON.stringify(q.body) === '{"labels":["deps"]}')).toBe(true);
  });

  it("falls back to the current branch, with a warning, when the default branch cannot be read", async () => {
    const { o } = opts({}, fakeGithub({ repoStatus: 404 }));
    const r = await openPr(o);
    expect(r.base).toBe("main");
    expect(r.warnings.join("\n")).toMatch(/default branch/i);
  });

  it("a label failure is a warning, not a failure", async () => {
    const { o } = opts({}, fakeGithub({ labelStatus: 403 }));
    const r = await openPr(o);
    expect(r.action).toBe("create");
    expect(r.warnings.join("\n")).toMatch(/label/i);
  });

  it("surfaces the Actions 403 with its hint, never the token, and leaves the checkout on its original branch", async () => {
    const { o } = opts({}, fakeGithub({ createStatus: 403, createMessage: "GitHub Actions is not permitted to create or approve pull requests." }));
    const e = (await openPr(o).catch((x: unknown) => x)) as Error;
    expect(e.message).toMatch(/403/);
    expect(e.message).toMatch(/not permitted to create or approve pull requests/);
    expect(e.message).toMatch(/Allow GitHub Actions to create and approve pull requests/i);
    expect(e.message).not.toContain(TOKEN);
    expect(await git(work, "branch", "--show-current")).toBe("main");
  });

  it("plans from the base branch when it differs from the checked-out one", async () => {
    await git(work, "checkout", "-b", "feature");
    await writeFile(join(work, "Cargo.toml"), `[dependencies]\nsoroban-sdk = "28.0.0"\n`);
    await git(work, "commit", "-am", "feature already on 28");
    const { o } = opts({ base: "main" });
    const r = await openPr(o);
    expect(r.action).toBe("create");
    expect(await git(bare, "show", "kedgeway/migrate-28:Cargo.toml")).toContain('soroban-sdk = "28.0.0"');
    expect(await git(work, "branch", "--show-current")).toBe("feature");
  });
});

describe("openPr: branch safety", () => {
  beforeEach(() => setup());
  const untouched = async (gh: ReturnType<typeof fakeGithub>): Promise<void> => {
    expect(gh.reqs.filter((q) => q.method !== "GET")).toHaveLength(0);
    expect(await git(bare, "branch", "--list")).not.toContain("develop");
    expect(await git(bare, "rev-parse", "main")).toBe(await git(work, "rev-parse", "main"));
    expect(await git(work, "branch", "--show-current")).toBe("main");
  };

  it("requires the kedgeway/ prefix unless allowAnyBranch", async () => {
    const { o, gh } = opts({ branch: "develop" });
    const e = await openPr(o).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(PrUsageError);
    expect((e as Error).message).toMatch(/kedgeway\//);
    expect(gh.reqs).toHaveLength(0);
    await untouched(gh);
  });

  it("refuses the prefix rule in dry-run too", async () => {
    const { o } = opts({ branch: "develop", dryRun: true });
    await expect(openPr(o)).rejects.toBeInstanceOf(PrUsageError);
  });

  it("refuses --branch main --base main even with allowAnyBranch, and never pushes", async () => {
    const { o, gh } = opts({ branch: "main", base: "main", allowAnyBranch: true });
    const e = await openPr(o).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(PrUsageError);
    expect((e as Error).message).toMatch(/base branch/);
    await untouched(gh);
  });

  it("refuses to overwrite a real branch: --branch develop without the explicit flag", async () => {
    await git(work, "branch", "develop");
    await git(work, "push", "origin", "develop");
    const before = await git(bare, "rev-parse", "develop");
    const { o, gh } = opts({ branch: "develop", base: "main" });
    await expect(openPr(o)).rejects.toBeInstanceOf(PrUsageError);
    expect(gh.reqs).toHaveLength(0);
    expect(await git(bare, "rev-parse", "develop")).toBe(before);
  });

  it("refuses the repository default branch as the PR branch", async () => {
    await git(work, "checkout", "-b", "dev");
    await git(work, "push", "origin", "dev");
    const { o, gh } = opts({ branch: "main", base: "dev", allowAnyBranch: true });
    const e = await openPr(o).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(PrUsageError);
    expect((e as Error).message).toMatch(/default branch/);
    expect(gh.reqs.filter((q) => q.method !== "GET")).toHaveLength(0);
    expect(await git(bare, "rev-parse", "main")).toBe(await git(work, "rev-parse", "main"));
  });

  it("with allowAnyBranch, refuses to proceed when the default branch cannot be read", async () => {
    const { o, gh } = opts({ branch: "bot/x", allowAnyBranch: true }, fakeGithub({ repoStatus: 404 }));
    const e = await openPr(o).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(PrUsageError);
    expect((e as Error).message).toMatch(/default branch/);
    expect(gh.reqs.filter((q) => q.method !== "GET")).toHaveLength(0);
    expect(await git(bare, "branch", "--list")).not.toContain("bot/x");
  });

  it("uses the configured remote for the base and the push", async () => {
    await git(work, "remote", "rename", "origin", "upstream");
    const { o } = opts({ remote: "upstream" });
    const r = await openPr(o);
    expect(r.action).toBe("create");
    expect(await git(bare, "branch", "--list", "kedgeway/*")).toContain("kedgeway/migrate-28");
  });

  it("refuses the checked-out branch", async () => {
    await git(work, "checkout", "-b", "work");
    const { o, gh } = opts({ branch: "work", base: "main", allowAnyBranch: true });
    const e = await openPr(o).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(PrUsageError);
    expect((e as Error).message).toMatch(/checked-out/);
    expect(gh.reqs.filter((q) => q.method !== "GET")).toHaveLength(0);
  });

  it("does not leak unpushed local commits into the PR branch", async () => {
    await writeFile(join(work, "secret.txt"), "local only");
    await git(work, "add", "-A");
    await git(work, "commit", "-m", "unpushed");
    const { o } = opts();
    await openPr(o);
    const files = await git(bare, "ls-tree", "--name-only", "kedgeway/migrate-28");
    expect(files).not.toContain("secret.txt");
    expect(await git(work, "log", "-1", "--format=%s", "main")).toBe("unpushed");
  });

  it("refuses to send the token to a push URL on another host", async () => {
    await git(work, "remote", "set-url", "origin", "https://evil.example/o/r.git");
    const { o, gh } = opts();
    const e = await openPr(o).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(PrUsageError);
    expect((e as Error).message).toMatch(/evil\.example/);
    expect((e as Error).message).not.toContain(TOKEN);
    expect(gh.reqs).toHaveLength(0);
    expect(await git(work, "branch", "--show-current")).toBe("main");
  });

  it("commits only the edited files and the refreshed lockfiles, not whatever else appeared", async () => {
    await rm(tmp, { recursive: true, force: true });
    const lock = `# generated\nversion = 3\n\n[[package]]\nname = "soroban-sdk"\nversion = "21.0.0"\n`;
    await setup(undefined, { "Cargo.lock": lock });
    const refreshExec: RefreshExec = async (_f, _a, o) => {
      await writeFile(join(o.cwd, "Cargo.lock"), lock.replace("21.0.0", "28.0.0"));
      await writeFile(join(o.cwd, "junk.txt"), "build artifact");
      return { stdout: "", stderr: "" };
    };
    const gh = fakeGithub();
    const { o } = opts({ refreshLockfiles: true, deps: { fetch: gh.fetch, refreshExec, sleep: async () => {} } });
    await openPr(o);
    const files = (await git(bare, "show", "--name-only", "--format=", "kedgeway/migrate-28")).split("\n").sort();
    expect(files).toEqual(["Cargo.lock", "Cargo.toml"]);
  });

  it("an already-exists 422 on create becomes an update of the PR that won the race", async () => {
    const reqs: string[] = [];
    let listed = 0;
    const inner = fakeGithub({ createStatus: 422, createMessage: "Validation Failed" });
    const fetch: GhFetch = async (url, init) => {
      const u = new URL(url);
      reqs.push(`${init.method} ${u.pathname}`);
      if (init.method === "POST" && u.pathname === "/repos/o/r/pulls") return new Response(JSON.stringify({ message: "Validation Failed", errors: [{ message: "A pull request already exists for o:kedgeway/migrate-28." }] }), { status: 422 });
      if (init.method === "GET" && u.pathname === "/repos/o/r/pulls") {
        listed += 1;
        const items = listed >= 2 ? [{ number: 77, html_url: "https://github.com/o/r/pull/77", state: "open", head: { ref: "kedgeway/migrate-28" }, base: { ref: "main" } }] : [];
        return new Response(JSON.stringify(items), { status: 200 });
      }
      return inner.fetch(url, init);
    };
    const { o } = opts({ deps: { fetch, sleep: async () => {} } });
    const r = await openPr(o);
    expect(r).toMatchObject({ action: "update", number: 77 });
    expect(reqs).toContain("PATCH /repos/o/r/pulls/77");
  });

  it("does not swallow a failure to restore the starting branch", async () => {
    const { createGitOps } = await import("./adapters/git-ops.js");
    const real = createGitOps({ cwd: work, env: gitEnv() });
    const flaky = { ...real, checkout: async () => { throw new Error("restore exploded"); } };
    const { o } = opts({}, fakeGithub({ createStatus: 403, createMessage: "nope" }));
    o.deps = { ...o.deps, git: flaky };
    const e = (await openPr(o).catch((x: unknown) => x)) as Error;
    expect(e.message).toMatch(/403/);
    expect(e.message).toMatch(/restore exploded/);
  });
});

describe("openPr: lockfiles", () => {
  const lock = `# This file is automatically @generated by Cargo.\nversion = 3\n\n[[package]]\nname = "soroban-sdk"\nversion = "21.0.0"\n`;
  beforeEach(() => setup(undefined, { "Cargo.lock": lock }));

  function refreshSpy(fail = false): { exec: RefreshExec; calls: string[][] } {
    const calls: string[][] = [];
    return {
      calls,
      exec: async (file, args, o) => {
        calls.push([file, ...args]);
        if (fail) throw Object.assign(new Error("x"), { stderr: "error: offline" });
        await writeFile(join(o.cwd, "Cargo.lock"), lock.replace("21.0.0", "28.0.0"));
        return { stdout: "", stderr: "" };
      },
    };
  }

  it("does not refresh lockfiles by default and says so in the PR body", async () => {
    const spy = refreshSpy();
    const { o, gh } = opts({ deps: { fetch: fakeGithub().fetch, refreshExec: spy.exec, sleep: async () => {} } });
    void gh;
    const g = fakeGithub();
    o.deps = { ...o.deps, fetch: g.fetch };
    await openPr(o);
    expect(spy.calls).toHaveLength(0);
    const body = String(g.reqs.find((q) => q.method === "POST" && q.path === "/repos/o/r/pulls")?.body?.["body"]);
    expect(body).toMatch(/## Lockfiles/);
    expect(body).toContain("`Cargo.lock`");
    expect(body).toMatch(/not updated/);
  });

  it("--refresh-lockfiles runs the command and commits the refreshed lockfile", async () => {
    const spy = refreshSpy();
    const g = fakeGithub();
    const { o } = opts({ refreshLockfiles: true, deps: { fetch: g.fetch, refreshExec: spy.exec, sleep: async () => {} } });
    await openPr(o);
    expect(spy.calls).toEqual([["cargo", "update", "-p", "soroban-sdk"]]);
    expect(await git(bare, "show", "kedgeway/migrate-28:Cargo.lock")).toContain('version = "28.0.0"');
    const body = String(g.reqs.find((q) => q.method === "POST" && q.path === "/repos/o/r/pulls")?.body?.["body"]);
    expect(body).toMatch(/refreshed/);
  });

  it("a failing refresh becomes a PR-body note, not a crash", async () => {
    const spy = refreshSpy(true);
    const g = fakeGithub();
    const { o } = opts({ refreshLockfiles: true, deps: { fetch: g.fetch, refreshExec: spy.exec, sleep: async () => {} } });
    const r = await openPr(o);
    expect(r.action).toBe("create");
    const body = String(g.reqs.find((q) => q.method === "POST" && q.path === "/repos/o/r/pulls")?.body?.["body"]);
    expect(body).toMatch(/## Notes/);
    expect(body).toMatch(/offline/);
    expect(await git(bare, "show", "kedgeway/migrate-28:Cargo.lock")).toContain('version = "21.0.0"');
  });
});
