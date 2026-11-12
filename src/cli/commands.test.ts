import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCli, type CliIo } from "./commands.js";
import { FakeEcosystem } from "../adapters/fake-ecosystem.js";
import type { EcosystemPort, EcosystemSnapshot } from "../ports/ecosystem.js";

const snapshot: EcosystemSnapshot = {
  observedAt: "2026-01-01T00:00:00.000Z",
  sorobanSdk: { currentMajor: 23, deprecatedVersions: [], source: "fake" },
  jsSdk: { currentVersion: null, source: "fake" },
  protocolCurrent: null,
  degraded: [],
  notes: [],
};

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "sd-cli-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function makeIo(port: EcosystemPort = new FakeEcosystem(snapshot)) {
  const out: string[] = [];
  const err: string[] = [];
  const state = { loggedIn: 0, loggedOut: 0, mcpStarted: 0 };
  const io: CliIo = {
    stdout: (s) => out.push(s),
    stderr: (s) => err.push(s),
    createRavenPort: () => port,
    login: () => {
      state.loggedIn += 1;
      return Promise.resolve();
    },
    startMcp: () => {
      state.mcpStarted += 1;
      return Promise.resolve();
    },
    logout: () => {
      state.loggedOut += 1;
      return Promise.resolve(true);
    },
  };
  return { io, out, err, state };
}

async function repoWith(version: string): Promise<void> {
  await mkdir(join(dir, "c"), { recursive: true });
  await writeFile(join(dir, "c/Cargo.toml"), `[dependencies]\nsoroban-sdk = "${version}"\n`);
}

const argv = (...a: string[]) => ["node", "kedgeway", ...a];

describe("diagnose", () => {
  it("prints a human-readable report and exits 0", async () => {
    await repoWith("21.0.0");
    const { io, out } = makeIo();
    const code = await runCli(argv("diagnose", dir), io);
    const text = out.join("");
    expect(code).toBe(0);
    expect(text).toContain("SDK_DEPRECATED");
    expect(text).toContain("c/Cargo.toml");
    expect(text).toContain("1 critical");
  });

  it("--json prints Diagnosis JSON only", async () => {
    await repoWith("23.0.0");
    const { io, out } = makeIo();
    const code = await runCli(argv("diagnose", dir, "--json"), io);
    const parsed = JSON.parse(out.join("")) as { findings: { code: string }[]; summary: { info: number } };
    expect(code).toBe(0);
    expect(parsed.findings[0]?.code).toBe("SDK_CURRENT");
    expect(parsed.summary.info).toBe(1);
  });

  it("--fail-on exits 2 when a finding meets the threshold", async () => {
    await repoWith("21.0.0");
    expect(await runCli(argv("diagnose", dir, "--fail-on", "critical"), makeIo().io)).toBe(2);
    expect(await runCli(argv("diagnose", dir, "--fail-on", "warning"), makeIo().io)).toBe(2);
  });

  it("--fail-on exits 0 when findings are below the threshold", async () => {
    await repoWith("23.0.0");
    expect(await runCli(argv("diagnose", dir, "--fail-on", "warning"), makeIo().io)).toBe(0);
  });

  it("rejects an invalid --fail-on value with exit 1", async () => {
    const { io, err } = makeIo();
    expect(await runCli(argv("diagnose", dir, "--fail-on", "bogus"), io)).toBe(1);
    expect(err.join("")).toContain("fail-on");
  });

  it("--fixture uses a fixture file instead of Raven", async () => {
    await repoWith("21.0.0");
    const fx = join(dir, "fx.json");
    await writeFile(fx, JSON.stringify({ ...snapshot, sorobanSdk: { ...snapshot.sorobanSdk, currentMajor: 21 } }));
    const { io, out } = makeIo({
      fetchSnapshot: () => Promise.reject(new Error("raven must not be used")),
    });
    const code = await runCli(argv("diagnose", dir, "--fixture", fx), io);
    expect(code).toBe(0);
    expect(out.join("")).toContain("SDK_CURRENT");
  });

  it("surfaces degraded ecosystem data and unparseable manifests in the report", async () => {
    await mkdir(join(dir, "bad"), { recursive: true });
    await writeFile(join(dir, "bad/Cargo.toml"), "not = [valid");
    const degraded = new FakeEcosystem({ ...snapshot, degraded: ["scout.analyzeEcosystem: down"] });
    const { io, out } = makeIo(degraded);
    expect(await runCli(argv("diagnose", dir, "--fail-on", "warning"), io)).toBe(2);
    const text = out.join("");
    expect(text).toContain("DATA_DEGRADED");
    expect(text).toContain("MANIFEST_UNPARSEABLE");
    expect(text).not.toContain("NO_SDK_FOUND");
  });

  it("exits 1 and reports on tool error", async () => {
    await repoWith("21.0.0");
    const { io, err } = makeIo({ fetchSnapshot: () => Promise.reject(new Error("boom")) });
    expect(await runCli(argv("diagnose", dir), io)).toBe(1);
    expect(err.join("")).toContain("boom");
  });
});

describe("login / logout", () => {
  it("login triggers the OAuth flow", async () => {
    const { io, state } = makeIo();
    expect(await runCli(argv("login"), io)).toBe(0);
    expect(state.loggedIn).toBe(1);
  });

  it("logout deletes stored auth", async () => {
    const { io, state, out } = makeIo();
    expect(await runCli(argv("logout"), io)).toBe(0);
    expect(state.loggedOut).toBe(1);
    expect(out.join("")).toMatch(/logged out/i);
  });
});

describe("mcp", () => {
  it("starts the stdio MCP server", async () => {
    const { io, state, out } = makeIo();
    expect(await runCli(argv("mcp"), io)).toBe(0);
    expect(state.mcpStarted).toBe(1);
    expect(out.join("")).toBe(""); // stdout is reserved for the MCP protocol
  });

  it("exits 1 when the server fails to start", async () => {
    const { io, err } = makeIo();
    io.startMcp = () => Promise.reject(new Error("nope"));
    expect(await runCli(argv("mcp"), io)).toBe(1);
    expect(err.join("")).toContain("nope");
  });
});
