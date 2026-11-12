import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createKedgewayServer } from "./server.js";
import type { EcosystemSnapshot } from "../ports/ecosystem.js";

const snapshot: EcosystemSnapshot = {
  observedAt: "2026-11-11T00:00:00.000Z",
  sorobanSdk: { currentMajor: 28, deprecatedVersions: ["21.0.0"], source: "fixture" },
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
  it("lists the three tools", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["diagnose", "ecosystem_snapshot", "findings_reference"]);
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
    expect(JSON.parse(texts(res)[0] ?? "")).toEqual(snapshot);
  });

  it("ecosystem_snapshot surfaces a bad fixture as a tool error", async () => {
    const res = await client.callTool({ name: "ecosystem_snapshot", arguments: { fixture: join(dir, "missing.json") } });
    expect(res.isError).toBe(true);
  });
});
