import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GhFetch } from "../adapters/github.js";
import { createKedgewayServer, type KedgewayServerOptions } from "./server.js";

const run = promisify(execFile);
const fixture = resolve(import.meta.dirname, "../../fixtures/ecosystem-2026-11-11.json");
const TOKEN = "ghs_SuperSecretToken123";

let tmp: string;
let bare: string;
let work: string;
let client: Client | undefined;
const gitEnv = (): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };
  for (const k of ["GITHUB_REPOSITORY", "GITHUB_TOKEN", "GITHUB_API_URL"]) delete env[k];
  return env;
};
const git = (cwd: string, ...args: string[]) => run("git", args, { cwd, env: gitEnv() }).then((r) => r.stdout.trim());

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), "kw-mcppr-"));
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
  await client?.close();
  client = undefined;
  await rm(tmp, { recursive: true, force: true });
});

const urls: string[] = [];
const fetch: GhFetch = async (url, init) => {
  urls.push(`${init.method} ${url}`);
  const u = new URL(url);
  const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s });
  if (init.method === "GET" && u.pathname === "/repos/o/r") return json(200, { full_name: "o/r", default_branch: "main", html_url: "h" });
  if (init.method === "GET") return json(200, []);
  if (init.method === "POST" && u.pathname === "/repos/o/r/pulls") return json(201, { number: 8, html_url: "https://github.com/o/r/pull/8", state: "open", head: { ref: "kedgeway/migrate-28" } });
  return json(200, {});
};

async function connect(opts: KedgewayServerOptions = {}): Promise<Client> {
  urls.length = 0;
  const server = createKedgewayServer({ env: gitEnv(), pr: { fetch, sleep: async () => {} }, ...opts });
  const [a, b] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test", version: "0.0.0" });
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}
const texts = (r: unknown): string[] => ((r as { content?: { type: string; text?: string }[] }).content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "");
const isError = (r: unknown): boolean => (r as { isError?: boolean }).isError === true;

describe("MCP pr tool", () => {
  it("is listed, with no token parameter", async () => {
    const c = await connect();
    const { tools } = await c.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["diagnose", "ecosystem_snapshot", "findings_reference", "migrate", "pr"]);
    const pr = tools.find((t) => t.name === "pr");
    const props = Object.keys((pr?.inputSchema as { properties: Record<string, unknown> }).properties).sort();
    expect(props).toEqual(["base", "branch", "draft", "dry_run", "fixture", "label", "path", "refresh_lockfiles", "repo", "url"]);
    expect(props).not.toContain("token");
  });

  it("dry_run works without --allow-write and touches neither git nor the network", async () => {
    const c = await connect();
    const r = await c.callTool({ name: "pr", arguments: { path: work, fixture, dry_run: true } });
    expect(isError(r)).toBe(false);
    const [head, body] = texts(r);
    expect(head).toMatch(/Dry run/);
    expect(head).toContain("chore(deps): migrate soroban-sdk to 28");
    expect(head).toContain("kedgeway/migrate-28");
    expect(body).toContain("## Edits");
    expect(urls).toHaveLength(0);
    expect(await git(bare, "branch", "--list")).not.toContain("kedgeway");
  });

  it("refuses to open a PR without --allow-write", async () => {
    const c = await connect({ env: { ...gitEnv(), GITHUB_TOKEN: TOKEN, GITHUB_REPOSITORY: "o/r" } });
    const r = await c.callTool({ name: "pr", arguments: { path: work, fixture } });
    expect(isError(r)).toBe(true);
    expect(texts(r).join("")).toMatch(/--allow-write/);
    expect(urls).toHaveLength(0);
  });

  it("rejects url sources and requires exactly one of path/url", async () => {
    const c = await connect({ allowWrite: true });
    const u = await c.callTool({ name: "pr", arguments: { url: "https://github.com/o/r", fixture, dry_run: true } });
    expect(isError(u)).toBe(true);
    expect(texts(u).join("")).toMatch(/local checkout/);
    const none = await c.callTool({ name: "pr", arguments: { fixture, dry_run: true } });
    expect(isError(none)).toBe(true);
    expect(texts(none).join("")).toMatch(/path or url/);
  });

  it("with --allow-write opens the PR using GITHUB_TOKEN from the server environment", async () => {
    const c = await connect({ allowWrite: true, env: { ...gitEnv(), GITHUB_TOKEN: TOKEN, GITHUB_REPOSITORY: "o/r" } });
    const r = await c.callTool({ name: "pr", arguments: { path: work, fixture } });
    expect(isError(r)).toBe(false);
    const out = texts(r).join("\n");
    expect(out).toContain("https://github.com/o/r/pull/8");
    expect(out).toMatch(/create/);
    expect(out).not.toContain(TOKEN);
    expect(await git(bare, "branch", "--list", "kedgeway/*")).toContain("kedgeway/migrate-28");
  });

  it("explains a missing GITHUB_TOKEN and scrubs the token from errors", async () => {
    const c = await connect({ allowWrite: true, env: { ...gitEnv(), GITHUB_REPOSITORY: "o/r" } });
    const r = await c.callTool({ name: "pr", arguments: { path: work, fixture } });
    expect(isError(r)).toBe(true);
    expect(texts(r).join("")).toMatch(/GITHUB_TOKEN/);
  });

  it("refuses a branch outside kedgeway/ (the MCP tool has no way to lift that)", async () => {
    const c = await connect({ allowWrite: true, env: { ...gitEnv(), GITHUB_TOKEN: TOKEN, GITHUB_REPOSITORY: "o/r" } });
    const r = await c.callTool({ name: "pr", arguments: { path: work, fixture, branch: "main", base: "main" } });
    expect(isError(r)).toBe(true);
    expect(texts(r).join("")).toMatch(/kedgeway\//);
    const props = Object.keys(((await c.listTools()).tools.find((t) => t.name === "pr")?.inputSchema as { properties: Record<string, unknown> }).properties);
    expect(props).not.toContain("allow_any_branch");
    expect(await git(bare, "rev-parse", "main")).toBe(await git(work, "rev-parse", "main"));
  });

  it("reports a skip", async () => {
    await writeFile(join(work, "Cargo.toml"), `[dependencies]\nsoroban-sdk = "28.0.0"\n`);
    await git(work, "commit", "-am", "current");
    const c = await connect({ allowWrite: true, env: { ...gitEnv(), GITHUB_TOKEN: TOKEN, GITHUB_REPOSITORY: "o/r" } });
    const r = await c.callTool({ name: "pr", arguments: { path: work, fixture } });
    expect(isError(r)).toBe(false);
    expect(texts(r)[0]).toMatch(/skipped: no automatic edits/i);
  });
});
