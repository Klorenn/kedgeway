import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { createKedgewayServer, runStdioServer } from "./server.js";
import type { EcosystemSnapshot } from "../ports/ecosystem.js";

const snapshot: EcosystemSnapshot = {
  observedAt: "2026-11-11T00:00:00.000Z",
  sorobanSdk: { currentMajor: 28, currentVersion: "28.0.0", deprecatedVersions: ["21.0.0"], source: "fixture" },
  jsSdk: { currentVersion: "17.2.1", source: "fixture" },
  protocolCurrent: 29,
  degraded: [],
  notes: [],
};

let dir: string;
let fixture: string;
let client: Client;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "kw-mcp-"));
  await mkdir(join(dir, "repo"));
  await writeFile(join(dir, "repo/Cargo.toml"), `[dependencies]\nsoroban-sdk = "21.0.0"\n`);
  fixture = join(dir, "fx.json");
  await writeFile(fixture, JSON.stringify(snapshot));
  const server = createKedgewayServer();
  const [a, b] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test", version: "0.0.0" });
  await Promise.all([server.connect(a), client.connect(b)]);
});
afterEach(async () => {
  await client.close();
  await rm(dir, { recursive: true, force: true });
});

function texts(result: unknown): string[] {
  const content = (result as { content?: { type: string; text?: string }[] }).content ?? [];
  return content.filter((c) => c.type === "text").map((c) => c.text ?? "");
}

describe("kedgeway MCP server", () => {
  it("lists the four tools", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["diagnose", "ecosystem_snapshot", "findings_reference", "migrate"]);
  });

  it("diagnose returns a text summary and the Diagnosis JSON", async () => {
    const res = await client.callTool({ name: "diagnose", arguments: { path: join(dir, "repo"), fixture } });
    const [summary, json] = texts(res);
    expect(summary).toMatch(/1 critical, 0 warning, 0 info/);
    const parsed = JSON.parse(json ?? "") as { findings: { code: string }[]; summary: { critical: number } };
    expect(parsed.findings[0]?.code).toBe("SDK_DEPRECATED");
    expect(parsed.summary.critical).toBe(1);
  });

  it("diagnose reports when failOn is met", async () => {
    const hit = await client.callTool({
      name: "diagnose",
      arguments: { path: join(dir, "repo"), fixture, failOn: "critical" },
    });
    expect(texts(hit)[0]).toMatch(/fail-on critical.*met/i);
    const miss = await client.callTool({
      name: "diagnose",
      arguments: { path: dir + "/nonexistent-but-empty-ok", fixture, failOn: "critical" },
    });
    expect(miss.isError).toBe(true); // unreadable path is a tool error
  });

  it("diagnose rejects invalid input as a tool error", async () => {
    const missing = await client.callTool({ name: "diagnose", arguments: { fixture } });
    expect(missing.isError).toBe(true);
    const badSeverity = await client.callTool({ name: "diagnose", arguments: { path: dir, fixture, failOn: "nope" } });
    expect(badSeverity.isError).toBe(true);
  });

  it("findings_reference returns the 12 codes", async () => {
    const res = await client.callTool({ name: "findings_reference", arguments: {} });
    const list = JSON.parse(texts(res)[0] ?? "") as { code: string; severity: string; meaning: string }[];
    expect(list).toHaveLength(12);
    expect(list.find((f) => f.code === "SDK_DEPRECATED")?.severity).toBe("critical");
  });

  it("ecosystem_snapshot returns the fixture snapshot", async () => {
    const res = await client.callTool({ name: "ecosystem_snapshot", arguments: { fixture } });
    expect(JSON.parse(texts(res)[0] ?? "")).toEqual({
      ...snapshot,
      sorobanSdk: { ...snapshot.sorobanSdk },
    });
  });

  it("ecosystem_snapshot surfaces a bad fixture as a tool error", async () => {
    const res = await client.callTool({ name: "ecosystem_snapshot", arguments: { fixture: join(dir, "missing.json") } });
    expect(res.isError).toBe(true);
  });
});

describe("migrate tool", () => {
  it("dry-run returns a summary, the plan JSON and the diff, without writing", async () => {
    const res = await client.callTool({ name: "migrate", arguments: { path: join(dir, "repo"), fixture } });
    const [summary, planJson, diff] = texts(res);
    expect(summary).toMatch(/dry run/i);
    const plan = JSON.parse(planJson ?? "") as { steps: { kind: string; to: string }[]; followUp: string[] };
    expect(plan.steps[0]).toMatchObject({ kind: "bump-rust-dep", to: "28.0.0" });
    expect(plan.followUp).toEqual(["cargo update -p soroban-sdk"]);
    expect(diff).toContain('+soroban-sdk = "28.0.0"');
    expect(await readFile(join(dir, "repo/Cargo.toml"), "utf8")).toContain('"21.0.0"');
  });

  it("write: true applies the edits", async () => {
    const res = await client.callTool({ name: "migrate", arguments: { path: join(dir, "repo"), fixture, write: true } });
    expect(res.isError).not.toBe(true);
    expect(texts(res)[0]).toMatch(/updated 1 file/i);
    expect(await readFile(join(dir, "repo/Cargo.toml"), "utf8")).toContain('"28.0.0"');
  });

  it("surfaces errors (bad path) as tool errors", async () => {
    const res = await client.callTool({ name: "migrate", arguments: { path: join(dir, "missing"), fixture } });
    expect(res.isError).toBe(true);
  });
});

describe("server lifecycle and metadata", () => {
  it("reports the package.json version", async () => {
    const pkg = createRequire(import.meta.url)("../../package.json") as { version: string };
    const server = createKedgewayServer();
    const [a, b] = InMemoryTransport.createLinkedPair();
    const c = new Client({ name: "t", version: "0" });
    await Promise.all([server.connect(a), c.connect(b)]);
    expect(c.getServerVersion()?.version).toBe(pkg.version);
    await c.close();
  });

  it("runStdioServer resolves only when the transport closes", async () => {
    const [a, b] = InMemoryTransport.createLinkedPair();
    let done = false;
    const running = runStdioServer({}, a).then(() => {
      done = true;
    });
    const c = new Client({ name: "t", version: "0" });
    await c.connect(b);
    await c.listTools();
    expect(done).toBe(false);
    await c.close();
    await running;
    expect(done).toBe(true);
  });
});
