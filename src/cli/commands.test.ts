import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCli, type CliIo } from "./commands.js";
import { FakeEcosystem } from "../adapters/fake-ecosystem.js";
import type { EcosystemPort, EcosystemSnapshot } from "../ports/ecosystem.js";

const snapshot: EcosystemSnapshot = {
  observedAt: "2026-01-01T00:00:00.000Z",
  sorobanSdk: { currentMajor: 23, currentVersion: "23.0.0", deprecatedVersions: [], source: "fake" },
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
  const state = { loggedIn: 0, loggedOut: 0, mcpStarted: 0, allowWrite: false };
  const io: CliIo = {
    stdout: (s) => out.push(s),
    stderr: (s) => err.push(s),
    createRavenPort: () => port,
    login: () => {
      state.loggedIn += 1;
      return Promise.resolve();
    },
    startMcp: (opts) => {
      state.mcpStarted += 1;
      state.allowWrite = opts.allowWrite;
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

  it("--allow-write is forwarded; default is off", async () => {
    const off = makeIo();
    await runCli(argv("mcp"), off.io);
    expect(off.state.allowWrite).toBe(false);
    const on = makeIo();
    await runCli(argv("mcp", "--allow-write"), on.io);
    expect(on.state.allowWrite).toBe(true);
  });

  it("exits 1 when the server fails to start", async () => {
    const { io, err } = makeIo();
    io.startMcp = () => Promise.reject(new Error("nope"));
    expect(await runCli(argv("mcp"), io)).toBe(1);
    expect(err.join("")).toContain("nope");
  });
});

describe("migrate", () => {
  const cargo = `[dependencies]\nsoroban-sdk = "21.0.0" # pinned\n`;

  it("dry-run (default) prints a diff, changes nothing and exits 2 when there are steps", async () => {
    await repoWith("21.0.0");
    const { io, out } = makeIo();
    const code = await runCli(argv("migrate", dir, "--fixture", await fixtureFile()), io);
    const text = out.join("");
    expect(code).toBe(2);
    expect(text).toContain("--- a/c/Cargo.toml");
    expect(text).toContain('+soroban-sdk = "23.0.0"');
    expect(text).toContain("cargo update -p soroban-sdk");
    expect(text).toMatch(/dry run/i);
    expect(await readFile(join(dir, "c/Cargo.toml"), "utf8")).toContain('"21.0.0"');
  });

  it("--write applies the edits, prints a summary and follow-up commands, exits 0", async () => {
    await mkdir(join(dir, "c"), { recursive: true });
    await writeFile(join(dir, "c/Cargo.toml"), cargo);
    const { io, out } = makeIo();
    const code = await runCli(argv("migrate", dir, "--write", "--fixture", await fixtureFile()), io);
    expect(code).toBe(0);
    expect(await readFile(join(dir, "c/Cargo.toml"), "utf8")).toBe(`[dependencies]\nsoroban-sdk = "23.0.0" # pinned\n`);
    expect(out.join("")).toMatch(/updated.*c\/Cargo\.toml/is);
    expect(out.join("")).toContain("cargo update -p soroban-sdk");
  });

  it("exits 0 when there is nothing to do", async () => {
    await repoWith("23.0.0");
    const { io, out } = makeIo();
    expect(await runCli(argv("migrate", dir, "--fixture", await fixtureFile()), io)).toBe(0);
    expect(out.join("")).toMatch(/nothing to migrate/i);
  });

  it("exits 0 in dry-run when only manual steps exist, still printing them", async () => {
    await mkdir(join(dir, "c"), { recursive: true });
    await writeFile(join(dir, "c/Cargo.toml"), `[dependencies]\nsoroban-sdk = ">=21.0.0"\n`);
    const { io, out } = makeIo();
    expect(await runCli(argv("migrate", dir, "--fixture", await fixtureFile()), io)).toBe(0);
    expect(out.join("")).toMatch(/manual steps/i);
  });

  it("--write exits 2 when a step could not be applied", async () => {
    await mkdir(join(dir, "c"), { recursive: true });
    await writeFile(join(dir, "c/Cargo.toml"), `[dependencies]\nsoroban-sdk.version = "21.0.0"\n`);
    const { io, out } = makeIo();
    expect(await runCli(argv("migrate", dir, "--write", "--fixture", await fixtureFile()), io)).toBe(2);
    expect(out.join("")).toMatch(/could not apply/i);
    expect(await readFile(join(dir, "c/Cargo.toml"), "utf8")).toContain('"21.0.0"');
  });

  it("rejects --dry-run together with --write", async () => {
    const { io, err } = makeIo();
    expect(await runCli(argv("migrate", dir, "--dry-run", "--write", "--fixture", await fixtureFile()), io)).toBe(1);
    expect(err.join("")).toMatch(/dry-run.*write/i);
  });

  it("refuses --write on uncommitted changes with exit 1", async () => {
    await repoWith("21.0.0");
    const git = promisify(execFile);
    await git("git", ["init", "-q"], { cwd: dir });
    const { io, err } = makeIo();
    expect(await runCli(argv("migrate", dir, "--write", "--fixture", await fixtureFile()), io)).toBe(1);
    expect(err.join("")).toMatch(/uncommitted/i);
    expect(await readFile(join(dir, "c/Cargo.toml"), "utf8")).toContain('"21.0.0"');
  });

  async function fixtureFile(): Promise<string> {
    const f = join(dir, "snapshot-migrate.json");
    await writeFile(f, JSON.stringify(snapshot));
    return f;
  }
});
