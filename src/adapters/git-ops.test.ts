import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createGitOps, type GitExec } from "./git-ops.js";

const run = promisify(execFile);

describe("git-ops (faked exec)", () => {
  const TOKEN = "ghs_SuperSecretToken123";
  const B64 = Buffer.from(`x-access-token:${TOKEN}`).toString("base64");
  const SHA = "a".repeat(40);

  type Call = { file: string; args: string[]; env: NodeJS.ProcessEnv };
  function fake(o: { fail?: (args: string[]) => Error | undefined; pushUrl?: string; remoteSha?: string } = {}): { exec: GitExec; calls: Call[] } {
    const calls: Call[] = [];
    return {
      calls,
      exec: async (file, args, opts) => {
        calls.push({ file, args, env: opts.env });
        const err = o.fail?.(args);
        if (err) throw err;
        if (args[0] === "remote" && args[1] === "get-url") return { stdout: `${o.pushUrl ?? "https://github.com/o/r.git"}\n`, stderr: "" };
        if (args[0] === "ls-remote") return { stdout: o.remoteSha === undefined ? "" : `${o.remoteSha}\t${args[args.length - 1]}\n`, stderr: "" };
        return { stdout: "", stderr: "" };
      },
    };
  }
  const configOf = (env: NodeJS.ProcessEnv): string[] => {
    const n = Number(env["GIT_CONFIG_COUNT"] ?? 0);
    return Array.from({ length: n }, (_, i) => `${env[`GIT_CONFIG_KEY_${i}`]}=${env[`GIT_CONFIG_VALUE_${i}`]}`);
  };
  const push = (f: ReturnType<typeof fake>, extra: { env?: NodeJS.ProcessEnv; branch?: string } = {}, o: { force: boolean; token?: string; allowedHost?: string } = { force: true, token: TOKEN, allowedHost: "github.com" }) =>
    createGitOps({ cwd: "/r", exec: f.exec, env: extra.env ?? {} }).pushBranch("origin", extra.branch ?? "kedgeway/migrate-28", o);

  it("pushes with --force-with-lease pinned to the sha ls-remote reports", async () => {
    const f = fake({ remoteSha: SHA });
    await push(f);
    const ls = f.calls.find((c) => c.args[0] === "ls-remote");
    expect(ls?.args).toEqual(["ls-remote", "--heads", "--", "origin", "refs/heads/kedgeway/migrate-28"]);
    const p = f.calls.find((c) => c.args[0] === "push");
    expect(p?.args).toEqual([
      "push",
      `--force-with-lease=refs/heads/kedgeway/migrate-28:${SHA}`,
      "--",
      "origin",
      "refs/heads/kedgeway/migrate-28:refs/heads/kedgeway/migrate-28",
    ]);
    expect(p?.args).not.toContain("--force");
  });

  it("uses an empty expected sha when the remote branch does not exist", async () => {
    const f = fake();
    await push(f);
    expect(f.calls.find((c) => c.args[0] === "push")?.args[1]).toBe("--force-with-lease=refs/heads/kedgeway/migrate-28:");
  });

  it("a non-force push has no lease and no ls-remote", async () => {
    const f = fake();
    await push(f, {}, { force: false, token: TOKEN, allowedHost: "github.com" });
    expect(f.calls.some((c) => c.args[0] === "ls-remote")).toBe(false);
    expect(f.calls.find((c) => c.args[0] === "push")?.args).toEqual(["push", "--", "origin", "refs/heads/kedgeway/migrate-28:refs/heads/kedgeway/migrate-28"]);
  });

  it("scopes the credential to the push host, resets first, and keeps it out of argv", async () => {
    const f = fake();
    await push(f);
    for (const c of f.calls.filter((x) => x.args[0] === "push" || x.args[0] === "ls-remote")) {
      const all = JSON.stringify(c.args);
      expect(all).not.toContain(TOKEN);
      expect(all).not.toContain(B64);
      expect(c.env["GIT_TERMINAL_PROMPT"]).toBe("0");
      const cfg = configOf(c.env);
      expect(cfg).toEqual(["http.https://github.com/.extraheader=", `http.https://github.com/.extraheader=AUTHORIZATION: basic ${B64}`]);
      expect(cfg.some((x) => x.startsWith("http.extraheader="))).toBe(false);
    }
  });

  it("appends to a GIT_CONFIG_COUNT the caller already set", async () => {
    const f = fake();
    await push(f, { env: { GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "a.b", GIT_CONFIG_VALUE_0: "c" } });
    const env = f.calls.find((c) => c.args[0] === "push")?.env ?? {};
    expect(env["GIT_CONFIG_KEY_0"]).toBe("a.b");
    expect(env["GIT_CONFIG_COUNT"]).toBe("3");
  });

  it("refuses to send the token to a host other than the GitHub host", async () => {
    const f = fake({ pushUrl: "https://evil.example/o/r.git" });
    await expect(push(f)).rejects.toThrow(/host/i);
    expect(f.calls.some((c) => c.args[0] === "push" || c.args[0] === "ls-remote")).toBe(false);
    const g = fake();
    await expect(push(g, {}, { force: true, token: TOKEN })).rejects.toThrow(/host/i);
  });

  it("sends no credential for ssh or local-path remotes (git uses its own auth there)", async () => {
    for (const pushUrl of ["git@github.com:o/r.git", "/tmp/some/bare", "file:///tmp/bare"]) {
      const f = fake({ pushUrl });
      await push(f);
      expect(f.calls.find((c) => c.args[0] === "push")?.env["GIT_CONFIG_COUNT"], pushUrl).toBeUndefined();
    }
  });

  it("drops GIT_DIR and friends", async () => {
    const f = fake({ pushUrl: "/tmp/bare" });
    await push(f, { env: { GIT_DIR: "/evil", GIT_WORK_TREE: "/evil", GIT_INDEX_FILE: "/evil" } });
    const env = f.calls.find((c) => c.args[0] === "push")?.env ?? {};
    for (const k of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"]) expect(env[k]).toBeUndefined();
  });

  it("strips the token, its base64 form and url credentials from errors", async () => {
    const err = Object.assign(new Error(`Command failed: git push https://x-access-token:${TOKEN}@github.com/o/r`), {
      stderr: `fatal: unable to access 'https://x-access-token:${TOKEN}@github.com/o/r/': The requested URL returned error: 403\nAUTHORIZATION: basic ${B64}\nraw ${TOKEN}`,
    });
    const f = fake({ fail: (a) => (a[0] === "push" ? err : undefined) });
    const p = push(f);
    await expect(p).rejects.toThrow(/git push failed/);
    const msg = await p.catch((e: Error) => e.message + (e.stack ?? ""));
    expect(msg).not.toContain(TOKEN);
    expect(msg).not.toContain(B64);
    expect(msg).toContain("403");
  });

  it("rejects unsafe branch, remote and base names before running git", async () => {
    const f = fake();
    const g = createGitOps({ cwd: "/r", exec: f.exec, env: {} });
    await expect(g.pushBranch("origin", "-x", { force: true })).rejects.toThrow(/branch/i);
    await expect(g.pushBranch("--upload-pack=x", "ok", { force: true })).rejects.toThrow(/remote/i);
    await expect(g.checkoutNewBranch("ok", "--evil")).rejects.toThrow(/branch/i);
    expect(f.calls).toHaveLength(0);
  });

  it("checkoutNewBranch resolves the base under the configured remote name", async () => {
    const f = fake();
    await createGitOps({ cwd: "/r", exec: f.exec, env: {} }).checkoutNewBranch("kedgeway/x", "main", "upstream");
    expect(f.calls.some((c) => c.args.join(" ").includes("refs/remotes/upstream/main"))).toBe(true);
    expect(f.calls.some((c) => c.args.join(" ").includes("refs/remotes/origin/"))).toBe(false);
  });

  it("stages only the files it is given", async () => {
    const f = fake();
    await createGitOps({ cwd: "/r", exec: f.exec, env: {} }).commitAll("msg", ["Cargo.toml", ":(top)Cargo.lock"]);
    const add = f.calls.find((c) => c.args[0] === "add");
    expect(add?.args).toEqual(["add", "--", "Cargo.toml", ":(top)Cargo.lock"]);
    expect(f.calls.some((c) => c.args.includes("-A"))).toBe(false);
  });

  it("refuses to commit without files", async () => {
    const f = fake();
    await expect(createGitOps({ cwd: "/r", exec: f.exec, env: {} }).commitAll("msg", [])).rejects.toThrow(/no files/i);
  });
});

describe("git-ops (real git, local bare origin)", () => {
  let tmp: string;
  let bare: string;
  let work: string;
  const env = (): NodeJS.ProcessEnv => ({ ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" });
  const git = (cwd: string, ...args: string[]) => run("git", args, { cwd, env: env() }).then((r) => r.stdout.trim());

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), "kw-gitops-"));
    bare = join(tmp, "origin.git");
    work = join(tmp, "work");
    await git(tmp, "init", "--bare", "-b", "main", bare);
    await git(tmp, "init", "-b", "main", work);
    await writeFile(join(work, "Cargo.toml"), "[dependencies]\nsoroban-sdk = \"21.0.0\"\n");
    await git(work, "add", "-A");
    await git(work, "commit", "-m", "init");
    await git(work, "remote", "add", "origin", bare);
    await git(work, "push", "origin", "main");
  });
  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it("checks out a branch from base, commits as the bot and force-pushes", async () => {
    const ops = createGitOps({ cwd: work, env: env() });
    expect(await ops.currentBranch()).toBe("main");
    expect(await ops.isClean()).toBe(true);
    expect(await ops.remoteUrl("origin")).toBe(bare);

    await ops.checkoutNewBranch("kedgeway/migrate-28", "main");
    expect(await ops.currentBranch()).toBe("kedgeway/migrate-28");

    await writeFile(join(work, "Cargo.toml"), "[dependencies]\nsoroban-sdk = \"28.0.0\"\n");
    await writeFile(join(work, "new.txt"), "untracked\n");
    expect(await ops.isClean()).toBe(false);
    const sha = await ops.commitAll("chore(deps): migrate soroban-sdk to 28", ["Cargo.toml"]);
    expect(sha).toMatch(/^[0-9a-f]{40}$/);
    expect(await git(work, "show", "--stat", "--format=", "HEAD")).not.toContain("new.txt"); // only the named file was staged
    expect(await ops.isClean()).toBe(false); // the untracked file is still there
    await rm(join(work, "new.txt"));
    expect(await ops.isClean()).toBe(true);
    expect(await git(work, "log", "-1", "--format=%an <%ae>")).toBe("kedgeway[bot] <kedgeway@users.noreply.github.com>");
    expect(await git(work, "log", "-1", "--format=%cn <%ce>")).toBe("kedgeway[bot] <kedgeway@users.noreply.github.com>");
    expect(await git(work, "log", "-1", "--format=%s")).toBe("chore(deps): migrate soroban-sdk to 28");

    await ops.pushBranch("origin", "kedgeway/migrate-28", { force: true, token: "tok" });
    expect(await git(bare, "branch", "--list", "kedgeway/*")).toContain("kedgeway/migrate-28");
    expect(await git(bare, "rev-parse", "kedgeway/migrate-28")).toBe(sha);

    // our own branch is force-pushed: a rewritten history replaces the old one
    await git(work, "commit", "--amend", "-m", "chore(deps): rewritten");
    await ops.pushBranch("origin", "kedgeway/migrate-28", { force: true, token: "tok" });
    expect(await git(bare, "log", "-1", "--format=%s", "kedgeway/migrate-28")).toBe("chore(deps): rewritten");

    await ops.checkout("main");
    expect(await ops.currentBranch()).toBe("main");
  });

  it("takes the author from the environment override", async () => {
    const ops = createGitOps({ cwd: work, env: { ...env(), KEDGEWAY_GIT_AUTHOR_NAME: "Acme Bot", KEDGEWAY_GIT_AUTHOR_EMAIL: "bot@acme.test" } });
    await ops.checkoutNewBranch("b1", "main");
    await writeFile(join(work, "x.txt"), "x");
    await ops.commitAll("msg", ["x.txt"]);
    expect(await git(work, "log", "-1", "--format=%an <%ae>")).toBe("Acme Bot <bot@acme.test>");
  });

  it("builds the branch from origin/<base> when base is not the current branch", async () => {
    const ops = createGitOps({ cwd: work, env: env() });
    await ops.checkoutNewBranch("feature", "main");
    await writeFile(join(work, "f.txt"), "f");
    await ops.commitAll("feature work", ["f.txt"]);
    await ops.checkoutNewBranch("kedgeway/migrate-28", "main");
    expect(await git(work, "log", "-1", "--format=%s")).toBe("init");
  });

  it("never starts from local commits that were not pushed", async () => {
    await writeFile(join(work, "secret.txt"), "unpushed");
    await git(work, "add", "-A");
    await git(work, "commit", "-m", "local only");
    const ops = createGitOps({ cwd: work, env: env() });
    await ops.checkoutNewBranch("kedgeway/migrate-28", "main"); // main is also the checked-out branch
    expect(await git(work, "log", "-1", "--format=%s")).toBe("init");
    expect(await git(work, "rev-parse", "HEAD")).toBe(await git(work, "rev-parse", "origin/main"));
  });

  it("fetches the base from the remote before branching", async () => {
    const other = join(tmp, "other");
    await git(tmp, "clone", "-b", "main", bare, other);
    await writeFile(join(other, "upstream.txt"), "u");
    await git(other, "add", "-A");
    await git(other, "commit", "-m", "upstream moved");
    await git(other, "push", "origin", "main");
    const ops = createGitOps({ cwd: work, env: env() });
    expect(await ops.fetchBranch("origin", "main", {})).toBe(true);
    await ops.checkoutNewBranch("kedgeway/migrate-28", "main");
    expect(await git(work, "log", "-1", "--format=%s")).toBe("upstream moved");
  });

  it("fetchBranch reports failure instead of throwing", async () => {
    const ops = createGitOps({ cwd: work, env: env() });
    expect(await ops.fetchBranch("origin", "nope", {})).toBe(false);
  });

  it("force-with-lease refuses to overwrite a remote branch that moved since ls-remote", async () => {
    const ops = createGitOps({ cwd: work, env: env() });
    await ops.checkoutNewBranch("kedgeway/migrate-28", "main");
    await writeFile(join(work, "a.txt"), "a");
    await ops.commitAll("mine", ["a.txt"]);
    // someone else's branch with the same name already exists: the lease read happens inside pushBranch, so this push
    // (which reads the current value) succeeds, but a stale expectation must fail:
    await expect(run("git", ["push", "--force-with-lease=refs/heads/kedgeway/migrate-28:" + "0".repeat(40), "--", "origin", "HEAD:refs/heads/kedgeway/migrate-28"], { cwd: work, env: env() })).resolves.toBeDefined();
    await git(work, "commit", "--amend", "-m", "mine 2");
    await expect(run("git", ["push", "--force-with-lease=refs/heads/kedgeway/migrate-28:" + "1".repeat(40), "--", "origin", "HEAD:refs/heads/kedgeway/migrate-28"], { cwd: work, env: env() })).rejects.toBeDefined();
    await ops.pushBranch("origin", "kedgeway/migrate-28", { force: true });
    expect(await git(bare, "log", "-1", "--format=%s", "kedgeway/migrate-28")).toBe("mine 2");
  });

  it("checkout --force discards local changes while restoring", async () => {
    const ops = createGitOps({ cwd: work, env: env() });
    await ops.checkoutNewBranch("kedgeway/x", "main");
    await writeFile(join(work, "Cargo.toml"), "dirty\n");
    await ops.checkout("main", { force: true });
    expect(await ops.currentBranch()).toBe("main");
    expect(await ops.isClean()).toBe(true);
  });

  it("changedFiles lists paths usable with git add from a subdirectory, outside ones as :(top)", async () => {
    await mkdir(join(work, "sub"), { recursive: true });
    await writeFile(join(work, "sub/a.txt"), "a");
    await writeFile(join(work, "Cargo.lock"), "lock");
    await git(work, "add", "-A");
    await git(work, "commit", "-m", "more");
    await writeFile(join(work, "sub/a.txt"), "b");
    await writeFile(join(work, "Cargo.lock"), "lock2");
    const ops = createGitOps({ cwd: join(work, "sub"), env: env() });
    expect((await ops.changedFiles()).sort()).toEqual([":(top)Cargo.lock", "a.txt"]);
  });

  it("fails clearly when the base does not exist, and reports detached HEAD as null", async () => {
    const ops = createGitOps({ cwd: work, env: env() });
    await expect(ops.checkoutNewBranch("x", "nope")).rejects.toThrow(/base branch/i);
    await git(work, "checkout", "--detach");
    expect(await ops.currentBranch()).toBeNull();
    expect(await ops.headSha()).toMatch(/^[0-9a-f]{40}$/);
  });

  it("surfaces a push failure without hanging on a prompt", async () => {
    const ops = createGitOps({ cwd: work, env: env() });
    await ops.checkoutNewBranch("b", "main");
    await expect(ops.pushBranch("nowhere", "b", { force: true })).rejects.toThrow(/git (ls-remote|push) failed/);
  });
});

describe("git-ops credential reaches the server even when actions/checkout persisted its own header", () => {
  let tmp: string;
  let work: string;
  const env = (): NodeJS.ProcessEnv => ({ ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" });
  const git = (cwd: string, ...args: string[]) => run("git", args, { cwd, env: env() }).then((r) => r.stdout.trim());
  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), "kw-gitauth-"));
    work = join(tmp, "work");
    await git(tmp, "init", "-b", "main", work);
    await writeFile(join(work, "f.txt"), "f");
    await git(work, "add", "-A");
    await git(work, "commit", "-m", "init");
    await git(work, "checkout", "-b", "kedgeway/migrate-28");
  });
  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it("sends exactly one Authorization header, ours, on ls-remote and push", async () => {
    const seen: { url: string; auth: string[] }[] = [];
    const srv = createServer((req, res) => {
      const auth: string[] = [];
      for (let i = 0; i < req.rawHeaders.length; i += 2) if ((req.rawHeaders[i] as string).toLowerCase() === "authorization") auth.push(req.rawHeaders[i + 1] as string);
      seen.push({ url: req.url ?? "", auth });
      res.writeHead(404);
      res.end("not a git server");
    });
    await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
    try {
      const port = (srv.address() as { port: number }).port;
      const host = `127.0.0.1:${port}`;
      await git(work, "remote", "add", "origin", `http://${host}/o/r.git`);
      // what actions/checkout persists: a URL-scoped header with the workflow's own credential
      await git(work, "config", `http.http://${host}/.extraheader`, "AUTHORIZATION: basic CHECKOUT-PERSISTED-CREDENTIAL");
      const TOKEN = "ghs_OurPushToken";
      const ours = `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${TOKEN}`).toString("base64")}`;
      const ops = createGitOps({ cwd: work, env: env() });
      await expect(ops.pushBranch("origin", "kedgeway/migrate-28", { force: true, token: TOKEN, allowedHost: host })).rejects.toThrow(/git (ls-remote|push) failed/);
      expect(seen.length).toBeGreaterThan(0);
      for (const r of seen) {
        expect(r.auth, r.url).toEqual([ours.slice("AUTHORIZATION: ".length)]);
      }
      console.log(`loopback server saw ${seen.length} request(s); Authorization headers per request: ${JSON.stringify(seen.map((r) => r.auth.length))}; first: ${seen[0]?.auth[0]?.slice(0, 12)}... (ours: ${seen.every((r) => r.auth[0] === ours.slice("AUTHORIZATION: ".length))}, checkout-persisted seen: ${seen.some((r) => r.auth.some((a) => a.includes("CHECKOUT")))})`);
    } finally {
      await new Promise<void>((r) => srv.close(() => r()));
    }
  });
});
