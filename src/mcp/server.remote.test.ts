import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RemoteExec } from "../adapters/remote-repo.js";
import type { EcosystemSnapshot } from "../ports/ecosystem.js";
import { createKedgewayServer } from "./server.js";

const snapshot: EcosystemSnapshot = {
  observedAt: "2026-11-11T00:00:00.000Z",
  sorobanSdk: { currentMajor: 28, currentVersion: "28.0.0", deprecatedVersions: ["21.0.0"], source: "fixture" },
  jsSdk: { currentVersion: "17.2.1", source: "fixture" },
  stellarCli: { currentVersion: "28.1.0", source: "fake" },
  protocolCurrent: 29,
  degraded: [],
  notes: [],
};

let dir: string;
let tmpRoot: string;
let fixture: string;
let clones: string[][];
let client: Client;

async function connect(allowWrite: boolean): Promise<void> {
  const exec: RemoteExec = async (_f, args) => {
    clones.push(args);
    const dest = args[args.length - 1] as string;
    await mkdir(dest, { recursive: true });
    await writeFile(join(dest, "Cargo.toml"), `[dependencies]\nsoroban-sdk = "21.0.0"\n`);
    return { stdout: "", stderr: "" };
  };
  const server = createKedgewayServer({ allowWrite, remote: { exec, tmpRoot } });
  const [a, b] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test", version: "0.0.0" });
  await Promise.all([server.connect(a), client.connect(b)]);
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "kw-mcpr-"));
  tmpRoot = await mkdtemp(join(tmpdir(), "kw-mcpr-tmp-"));
  fixture = join(dir, "fx.json");
  await writeFile(fixture, JSON.stringify(snapshot));
  clones = [];
});
afterEach(async () => {
  await client.close();
  await rm(dir, { recursive: true, force: true });
  await rm(tmpRoot, { recursive: true, force: true });
});

const texts = (r: unknown): string[] =>
  ((r as { content?: { type: string; text?: string }[] }).content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "");

describe("MCP remote url", () => {
  it("diagnose accepts url and returns relative files", async () => {
    await connect(false);
    const res = await client.callTool({ name: "diagnose", arguments: { url: "https://github.com/o/r/tree/main", fixture } });
    expect(res.isError).not.toBe(true);
    const [summary, json] = texts(res);
    expect(summary).toMatch(/1 critical/);
    const parsed = JSON.parse(json ?? "") as { findings: { file: string }[] };
    expect(parsed.findings[0]?.file).toBe("Cargo.toml");
    expect(json).not.toContain("kedgeway-");
    expect(clones[0]).toContain("main");
    expect(await readdir(tmpRoot)).toEqual([]);
  });

  it("diagnose sarif for a url has no file:// uris", async () => {
    await connect(false);
    const res = await client.callTool({ name: "diagnose", arguments: { url: "o/r", fixture, format: "sarif" } });
    expect(texts(res)[1]).not.toContain("file://");
  });

  it("path and url are mutually exclusive, and one is required", async () => {
    await connect(false);
    const both = await client.callTool({ name: "diagnose", arguments: { path: dir, url: "o/r", fixture } });
    expect(both.isError).toBe(true);
    expect(texts(both).join("")).toMatch(/either path or url/);
    const none = await client.callTool({ name: "migrate", arguments: { fixture } });
    expect(none.isError).toBe(true);
    expect(texts(none).join("")).toMatch(/either path or url/);
    expect(clones).toHaveLength(0);
  });

  it("rejects hostile urls as tool errors", async () => {
    await connect(false);
    for (const url of ["file:///etc/passwd", "https://u:p@github.com/o/r"]) {
      const res = await client.callTool({ name: "diagnose", arguments: { url, fixture } });
      expect(res.isError).toBe(true);
    }
    expect(clones).toHaveLength(0);
  });

  it("never accepts http:// or internal hosts", async () => {
    await connect(false);
    for (const url of ["http://github.com/o/r", "https://127.0.0.1/o/r", "https://localhost/o/r"]) {
      const res = await client.callTool({ name: "diagnose", arguments: { url, fixture } });
      expect(res.isError).toBe(true);
      const m = await client.callTool({ name: "migrate", arguments: { url, fixture } });
      expect(m.isError).toBe(true);
    }
    expect(clones).toHaveLength(0);
    const ok = await client.callTool({ name: "diagnose", arguments: { url: "ssh://git@github.com/o/r", fixture } });
    expect(ok.isError).not.toBe(true);
  });

  it("marks diagnose and migrate as open-world", async () => {
    await connect(false);
    const { tools } = await client.listTools();
    for (const n of ["diagnose", "migrate"]) expect(tools.find((t) => t.name === n)?.annotations?.openWorldHint).toBe(true);
  });

  it("migrate with url is a dry run", async () => {
    await connect(true);
    const res = await client.callTool({ name: "migrate", arguments: { url: "o/r", fixture } });
    expect(res.isError).not.toBe(true);
    expect(texts(res)[0]).toMatch(/^Dry run: 1 edit/);
    expect(texts(res).join("")).not.toContain("kedgeway-");
  });

  it("migrate with url never writes, even with allowWrite", async () => {
    await connect(true);
    const res = await client.callTool({ name: "migrate", arguments: { url: "o/r", fixture, write: true } });
    expect(res.isError).toBe(true);
    expect(texts(res).join("")).toMatch(/dry-run only/);
    expect(clones).toHaveLength(0);
  });
});
