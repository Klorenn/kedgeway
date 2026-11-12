import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GhFetch } from "../adapters/github.js";
import { runCli, type CliIo } from "./commands.js";

const run = promisify(execFile);
const fixture = resolve(import.meta.dirname, "../../fixtures/ecosystem-2026-11-11.json");
const TOKEN = "ghs_SuperSecretToken123";

let tmp: string;
let bare: string;
let work: string;
const gitEnv = (): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };
  for (const k of ["GITHUB_REPOSITORY", "GITHUB_TOKEN", "GITHUB_API_URL"]) delete env[k];
  return env;
};
const git = (cwd: string, ...args: string[]) => run("git", args, { cwd, env: gitEnv() }).then((r) => r.stdout.trim());

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), "kw-clipr-"));
  bare = join(tmp, "origin.git");
  work = join(tmp, "work");
  await git(tmp, "init", "--bare", "-b", "main", bare);
  await git(tmp, "init", "-b", "main", work);
  await writeFile(join(work, "Cargo.toml"), `[dependencies]\nsoroban-sdk = "21.0.0"\n`);
  await git(work, "add", "-A");
  await git(work, "commit", "-m", "init");
  await git(work, "remote", "add", "origin", bare);
  await git(work, "push", "origin", "main");
});
afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

interface Harness {
  io: CliIo;
  out: string[];
  err: string[];
  urls: string[];
  workflows: { rel: string; text: string }[];
}
function harness(env: NodeJS.ProcessEnv = {}, createStatus?: number): Harness {
  const out: string[] = [];
  const err: string[] = [];
  const urls: string[] = [];
  const workflows: { rel: string; text: string }[] = [];
  const fetch: GhFetch = async (url, init) => {
    urls.push(`${init.method} ${url}`);
    const u = new URL(url);
    const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s });
    if (init.method === "GET" && u.pathname === "/repos/o/r") return json(200, { full_name: "o/r", default_branch: "main", html_url: "h" });
    if (init.method === "GET") return json(200, []);
    if (init.method === "POST" && u.pathname === "/repos/o/r/pulls") return createStatus ? json(createStatus, { message: "GitHub Actions is not permitted to create or approve pull requests." }) : json(201, { number: 5, html_url: "https://github.com/o/r/pull/5", state: "open", head: { ref: "kedgeway/migrate-28" } });
    return json(200, {});
  };
  const io: CliIo = {
    stdout: (s) => out.push(s),
    stderr: (s) => err.push(s),
    createRavenPort: () => {
      throw new Error("no raven in tests");
    },
    login: async () => {},
    logout: async () => true,
    exportAuth: async () => null,
    doctor: async () => [],
    writeFile: async () => {},
    version: "9.8.7",
    writeWorkflow: async (root, rel, text) => {
      workflows.push({ rel, text });
      return { status: "written", path: join(root, rel) };
    },
    env: { ...gitEnv(), ...env },
    startMcp: async () => {},
    prDeps: { fetch, sleep: async () => {} },
  };
  return { io, out, err, urls, workflows };
}

const all = (h: Harness): string => [...h.out, ...h.err].join("");

describe("kedgeway pr", () => {
  it("--dry-run prints the title and body and touches neither git nor the network", async () => {
    const h = harness();
    const code = await runCli(["node", "kedgeway", "pr", work, "--fixture", fixture, "--dry-run", "--repo", "o/r", "--token", "x"], h.io);
    expect(code).toBe(0);
    const text = h.out.join("");
    expect(text).toMatch(/Branch: kedgeway\/migrate-28/);
    expect(text).toMatch(/Title: +chore\(deps\): migrate soroban-sdk to 28/);
    expect(text).toContain("## Edits");
    expect(h.urls).toHaveLength(0);
    expect(await git(bare, "branch", "--list")).not.toContain("kedgeway");
  });

  it("--dry-run --json prints { action, branch, title, body }", async () => {
    const h = harness();
    const code = await runCli(["node", "kedgeway", "pr", work, "--fixture", fixture, "--dry-run", "--json"], h.io);
    expect(code).toBe(0);
    const j = JSON.parse(h.out.join("")) as Record<string, string>;
    expect(j["action"]).toBe("dry-run");
    expect(j["branch"]).toBe("kedgeway/migrate-28");
    expect(j["title"]).toBe("chore(deps): migrate soroban-sdk to 28");
    expect(j["body"]).toContain("Opened by kedgeway 9.8.7");
  });

  it("opens the PR: pushes the branch, prints the URL, exit 0, never prints the token", async () => {
    const h = harness();
    const code = await runCli(["node", "kedgeway", "pr", work, "--fixture", fixture, "--repo", "o/r", "--token", TOKEN], h.io);
    expect(code).toBe(0);
    expect(h.out.join("")).toMatch(/created pull request #5/i);
    expect(h.out.join("")).toContain("https://github.com/o/r/pull/5");
    expect(await git(bare, "branch", "--list", "kedgeway/*")).toContain("kedgeway/migrate-28");
    expect(all(h)).not.toContain(TOKEN);
  });

  it("--json prints { action, url, branch, title }", async () => {
    const h = harness();
    const code = await runCli(["node", "kedgeway", "pr", work, "--fixture", fixture, "--repo", "o/r", "--token", TOKEN, "--json", "--base", "main", "--branch", "bot/x", "--allow-any-branch", "--draft", "--label", "deps"], h.io);
    expect(code).toBe(0);
    expect(JSON.parse(h.out.join(""))).toEqual({ action: "create", url: "https://github.com/o/r/pull/5", branch: "bot/x", title: "chore(deps): migrate soroban-sdk to 28" });
  });

  it("refuses a branch outside kedgeway/ without --allow-any-branch (exit 2) and main as a branch always", async () => {
    const a = harness();
    expect(await runCli(["node", "kedgeway", "pr", work, "--fixture", fixture, "--repo", "o/r", "--token", TOKEN, "--branch", "develop"], a.io)).toBe(2);
    expect(a.err.join("")).toMatch(/kedgeway\//);
    const b = harness();
    expect(await runCli(["node", "kedgeway", "pr", work, "--fixture", fixture, "--repo", "o/r", "--token", TOKEN, "--branch", "main", "--base", "main", "--allow-any-branch"], b.io)).toBe(2);
    expect(await git(bare, "rev-parse", "main")).toBe(await git(work, "rev-parse", "main"));
    expect(a.urls.concat(b.urls).filter((u) => u.startsWith("POST"))).toHaveLength(0);
  });

  it("reads the token and repository from the environment", async () => {
    const h = harness({ GITHUB_TOKEN: TOKEN, GITHUB_REPOSITORY: "o/r" });
    const code = await runCli(["node", "kedgeway", "pr", work, "--fixture", fixture], h.io);
    expect(code).toBe(0);
    expect(h.urls[0]).toBe("GET https://api.github.com/repos/o/r");
  });

  it("--api-base redirects the API calls", async () => {
    const h = harness();
    const code = await runCli(["node", "kedgeway", "pr", work, "--fixture", fixture, "--repo", "o/r", "--token", TOKEN, "--api-base", "http://127.0.0.1:9"], h.io);
    expect(code).toBe(0);
    expect(h.urls.every((u) => u.includes("http://127.0.0.1:9/repos/o/r"))).toBe(true);
  });

  it("skips with exit 0 when there is nothing to migrate", async () => {
    await writeFile(join(work, "Cargo.toml"), `[dependencies]\nsoroban-sdk = "28.0.0"\n`);
    await git(work, "commit", "-am", "already current");
    const h = harness();
    const code = await runCli(["node", "kedgeway", "pr", work, "--fixture", fixture, "--repo", "o/r", "--token", TOKEN], h.io);
    expect(code).toBe(0);
    expect(h.out.join("")).toMatch(/skipped: no automatic edits/i);
    expect(h.urls).toHaveLength(0);
  });

  it("--json skip carries the reason", async () => {
    await writeFile(join(work, "Cargo.toml"), `[dependencies]\nsoroban-sdk = "28.0.0"\n`);
    await git(work, "commit", "-am", "already current");
    const h = harness();
    await runCli(["node", "kedgeway", "pr", work, "--fixture", fixture, "--repo", "o/r", "--token", TOKEN, "--json"], h.io);
    const j = JSON.parse(h.out.join("")) as { action: string; reason: string };
    expect(j.action).toBe("skip");
    expect(j.reason).toMatch(/no automatic edits/i);
  });

  it("refuses a dirty tree with exit 2", async () => {
    await writeFile(join(work, "dirty.txt"), "x");
    const h = harness();
    const code = await runCli(["node", "kedgeway", "pr", work, "--fixture", fixture, "--repo", "o/r", "--token", TOKEN], h.io);
    expect(code).toBe(2);
    expect(h.err.join("")).toMatch(/uncommitted/i);
    expect(h.urls).toHaveLength(0);
  });

  it("exit 2 without a token, for an invalid repo, for a remote source and for contradictory cache flags", async () => {
    for (const args of [
      ["--repo", "o/r"],
      ["--repo", "nope", "--token", "x"],
      ["--repo", "o/r", "--token", "x", "--offline", "--no-cache"],
    ]) {
      const h = harness();
      expect(await runCli(["node", "kedgeway", "pr", work, "--fixture", fixture, ...args], h.io), args.join(" ")).toBe(2);
    }
    const h = harness();
    expect(await runCli(["node", "kedgeway", "pr", "https://github.com/o/r", "--fixture", fixture, "--dry-run"], h.io)).toBe(2);
    expect(h.err.join("")).toMatch(/local checkout/i);
  });

  it("exit 1 on an API failure, with the hint and without the token", async () => {
    const h = harness({}, 403);
    const code = await runCli(["node", "kedgeway", "pr", work, "--fixture", fixture, "--repo", "o/r", "--token", TOKEN], h.io);
    expect(code).toBe(1);
    expect(h.err.join("")).toMatch(/403/);
    expect(h.err.join("")).toMatch(/Allow GitHub Actions to create and approve pull requests/i);
    expect(all(h)).not.toContain(TOKEN);
  });

  it("exit 1 on a git failure (not a repository)", async () => {
    const plain = await mkdtemp(join(tmpdir(), "kw-clipr-plain-"));
    try {
      await writeFile(join(plain, "Cargo.toml"), `[dependencies]\nsoroban-sdk = "21.0.0"\n`);
      const h = harness();
      const code = await runCli(["node", "kedgeway", "pr", plain, "--fixture", fixture, "--repo", "o/r", "--token", TOKEN], h.io);
      expect(code).toBe(1);
      expect(h.err.join("")).toMatch(/git/i);
    } finally {
      await rm(plain, { recursive: true, force: true });
    }
  });
});

describe("kedgeway init --mode pr", () => {
  it("writes .github/workflows/kedgeway-pr.yml", async () => {
    const h = harness();
    const code = await runCli(["node", "kedgeway", "init", tmp, "--mode", "pr"], h.io);
    expect(code).toBe(0);
    expect(h.workflows[0]?.rel).toBe(".github/workflows/kedgeway-pr.yml");
    expect(h.workflows[0]?.text).toContain("mode: pr");
    expect(h.workflows[0]?.text).toContain("Klorenn/kedgeway@v9.8.7");
    expect(h.out.join("")).toMatch(/Allow GitHub Actions to create and approve pull requests/);
    expect(h.out.join("")).toMatch(/KEDGEWAY_AUTH/);
  });

  it("--print prints the pr workflow", async () => {
    const h = harness();
    await runCli(["node", "kedgeway", "init", "--mode", "pr", "--print"], h.io);
    expect(h.out.join("")).toMatch(/^name: kedgeway-pr$/m);
    expect(h.workflows).toHaveLength(0);
  });

  it("the default mode is unchanged and an unknown mode is rejected", async () => {
    const h = harness();
    expect(await runCli(["node", "kedgeway", "init", tmp], h.io)).toBe(0);
    expect(h.workflows[0]?.rel).toBe(".github/workflows/kedgeway.yml");
    const bad = harness();
    expect(await runCli(["node", "kedgeway", "init", tmp, "--mode", "nope"], bad.io)).toBe(1);
    expect(bad.workflows).toHaveLength(0);
  });
});
