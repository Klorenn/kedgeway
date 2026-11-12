import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RavenEcosystem } from "../adapters/raven-ecosystem.js";
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
let cacheDir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "sd-cli-"));
  cacheDir = await mkdtemp(join(tmpdir(), "sd-cli-cache-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  await rm(cacheDir, { recursive: true, force: true });
});

function makeIo(port: EcosystemPort = new FakeEcosystem(snapshot)) {
  const out: string[] = [];
  const err: string[] = [];
  const state = {
    loggedIn: 0,
    loggedOut: 0,
    mcpStarted: 0,
    allowWrite: false,
    written: {} as Record<string, string>,
    exportable: null as string | null,
    exportCalls: 0,
    loginOpts: [] as ({ preserve?: boolean } | undefined)[],
    env: {} as NodeJS.ProcessEnv,
  };
  const io: CliIo = {
    stdout: (s) => out.push(s),
    stderr: (s) => err.push(s),
    createRavenPort: () => port,
    login: (opts) => {
      state.loginOpts.push(opts);
      state.loggedIn += 1;
      state.exportable ??= "Zm9v";
      return Promise.resolve();
    },
    exportAuth: () => {
      state.exportCalls += 1;
      return Promise.resolve(state.exportable);
    },
    writeFile: (path, text) => {
      state.written[path] = text;
      return Promise.resolve();
    },
    cacheDir,
    cwd: () => dirname(dir),
    env: state.env,
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

function countingPort(result: EcosystemSnapshot | Error): EcosystemPort & { calls: number } {
  const p = {
    calls: 0,
    fetchSnapshot(): Promise<EcosystemSnapshot> {
      p.calls += 1;
      return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
    },
  };
  return p;
}

describe("snapshot cache flags", () => {
  it("writes the cache after a live fetch and serves the next run from it", async () => {
    await repoWith("21.0.0");
    const first = countingPort({ ...snapshot, observedAt: new Date().toISOString() });
    expect(await runCli(argv("diagnose", dir), makeIo(first).io)).toBe(0);
    expect(first.calls).toBe(1);
    expect(JSON.parse(await readFile(join(cacheDir, "snapshot.json"), "utf8")).sorobanSdk.currentMajor).toBe(23);
    const second = countingPort(new Error("must not be called"));
    expect(await runCli(argv("diagnose", dir), makeIo(second).io)).toBe(0);
    expect(second.calls).toBe(0);
  });

  it("--offline with no cache exits 1 and says so", async () => {
    await repoWith("21.0.0");
    const { io, err } = makeIo(countingPort(snapshot));
    expect(await runCli(argv("diagnose", dir, "--offline"), io)).toBe(1);
    expect(err.join("")).toMatch(/no cached snapshot/i);
  });

  it("--offline uses a stale cache with a DATA_DEGRADED warning", async () => {
    await repoWith("21.0.0");
    await runCli(argv("diagnose", dir), makeIo(countingPort({ ...snapshot, observedAt: "2020-01-01T00:00:00.000Z" })).io);
    const port = countingPort(new Error("no network"));
    const { io, out } = makeIo(port);
    expect(await runCli(argv("diagnose", dir, "--offline", "--json"), io)).toBe(0);
    expect(port.calls).toBe(0);
    const d = JSON.parse(out.join("")) as { findings: { code: string; message: string }[] };
    expect(d.findings.find((f) => f.code === "DATA_DEGRADED")?.message).toMatch(/snapshot is \d+ hours old/);
  });

  it("falls back to the cache when Raven fails", async () => {
    await repoWith("21.0.0");
    await runCli(argv("diagnose", dir, "--max-age", "0s"), makeIo(countingPort({ ...snapshot, observedAt: "2020-01-01T00:00:00.000Z" })).io);
    const { io, out } = makeIo(countingPort(new Error("raven down")));
    expect(await runCli(argv("diagnose", dir, "--json"), io)).toBe(0);
    expect(out.join("")).toContain("using cached snapshot from 2020-01-01T00:00:00.000Z");
  });

  it("--no-cache refetches even when the cache is fresh", async () => {
    await repoWith("21.0.0");
    const fresh = { ...snapshot, observedAt: new Date().toISOString() };
    await runCli(argv("diagnose", dir), makeIo(countingPort(fresh)).io);
    const port = countingPort(fresh);
    await runCli(argv("diagnose", dir, "--no-cache"), makeIo(port).io);
    expect(port.calls).toBe(1);
  });

  it("rejects an invalid --max-age", async () => {
    const { io, err } = makeIo();
    expect(await runCli(argv("diagnose", dir, "--max-age", "soon"), io)).toBe(1);
    expect(err.join("")).toMatch(/--max-age/);
  });

  it("--fixture never reads or writes the cache", async () => {
    await repoWith("21.0.0");
    const fx = join(dir, "fx.json");
    await writeFile(fx, JSON.stringify(snapshot));
    expect(await runCli(argv("diagnose", dir, "--fixture", fx, "--offline"), makeIo().io)).toBe(0);
    await expect(readFile(join(cacheDir, "snapshot.json"))).rejects.toThrow();
  });

  it("migrate honours --offline too", async () => {
    await repoWith("21.0.0");
    const { io, err } = makeIo(countingPort(snapshot));
    expect(await runCli(argv("migrate", dir, "--offline"), io)).toBe(1);
    expect(err.join("")).toMatch(/no cached snapshot/i);
  });
});

describe("login --export", () => {
  it("prints only the blob on stdout and warns on stderr", async () => {
    const { io, out, err, state } = makeIo();
    state.exportable = "QUJD";
    expect(await runCli(argv("login", "--export"), io)).toBe(0);
    expect(out.join("")).toBe("QUJD\n");
    expect(err.join("")).toMatch(/secret/i);
    expect(state.loggedIn).toBe(0);
  });

  it("logs in first when nothing is stored, still printing only the blob", async () => {
    const { io, out, state } = makeIo();
    expect(await runCli(argv("login", "--export"), io)).toBe(0);
    expect(state.loggedIn).toBe(1);
    expect(out.join("")).toBe("Zm9v\n");
  });

  it("plain login still forces the flow and prints the usual message", async () => {
    const { io, out, state } = makeIo();
    state.exportable = "QUJD";
    expect(await runCli(argv("login"), io)).toBe(0);
    expect(state.loggedIn).toBe(1);
    expect(out.join("")).toContain("Logged in");
  });
});

describe("diagnose --sarif / --format", () => {
  it("writes SARIF to the given file and still prints the normal report", async () => {
    await repoWith("21.0.0");
    const { io, out, state } = makeIo();
    expect(await runCli(argv("diagnose", dir, "--sarif", "out.sarif"), io)).toBe(0);
    expect(out.join("")).toContain("SDK_DEPRECATED");
    const log = JSON.parse(state.written["out.sarif"] ?? "null") as {
      version: string;
      runs: { results: { ruleId: string; locations: { physicalLocation: { artifactLocation: { uri: string } } }[] }[] }[];
    };
    expect(log.version).toBe("2.1.0");
    expect(log.runs[0]?.results[0]?.ruleId).toBe("SDK_DEPRECATED");
    expect(log.runs[0]?.results[0]?.locations[0]?.physicalLocation.artifactLocation.uri).toBe(`${basename(dir)}/c/Cargo.toml`);
  });

  it("uses absolute file:// uris when the scan root is outside the working directory", async () => {
    await repoWith("21.0.0");
    const { io, state } = makeIo();
    io.cwd = () => cacheDir; // unrelated directory
    expect(await runCli(argv("diagnose", dir, "--sarif", "out.sarif"), io)).toBe(0);
    const loc = (JSON.parse(state.written["out.sarif"] ?? "") as { runs: { results: { locations: { physicalLocation: { artifactLocation: Record<string, string> } }[] }[] }[] })
      .runs[0]?.results[0]?.locations[0]?.physicalLocation.artifactLocation;
    expect(loc?.["uri"]).toMatch(/^file:\/\/\/.*\/c\/Cargo\.toml$/);
    expect(loc?.["uriBaseId"]).toBeUndefined();
  });

  it("--sarif requires a file", async () => {
    await repoWith("21.0.0");
    const { io, out } = makeIo();
    expect(await runCli(argv("diagnose", dir, "--sarif"), io)).toBe(1);
    expect(out.join("")).toBe("");
  });

  it("--format sarif prints only SARIF to stdout; --format json equals --json", async () => {
    await repoWith("21.0.0");
    const a = makeIo();
    expect(await runCli(argv("diagnose", dir, "--format", "sarif"), a.io)).toBe(0);
    expect((JSON.parse(a.out.join("")) as { version: string }).version).toBe("2.1.0");
    const b = makeIo();
    const c = makeIo();
    await runCli(argv("diagnose", dir, "--format", "json"), b.io);
    await runCli(argv("diagnose", dir, "--json"), c.io);
    expect(b.out.join("")).toBe(c.out.join(""));
  });

  it("rejects --json together with --format, and unknown formats", async () => {
    const a = makeIo();
    expect(await runCli(argv("diagnose", dir, "--json", "--format", "text"), a.io)).toBe(1);
    expect(a.err.join("")).toMatch(/--json.*--format/);
    const b = makeIo();
    expect(await runCli(argv("diagnose", dir, "--format", "xml"), b.io)).toBe(1);
    expect(b.err.join("")).toMatch(/--format/);
  });

  it("keeps --fail-on semantics", async () => {
    await repoWith("21.0.0");
    const { io, state } = makeIo();
    expect(await runCli(argv("diagnose", dir, "--sarif", "o.sarif", "--fail-on", "critical"), io)).toBe(2);
    expect(state.written["o.sarif"]).toBeDefined();
  });
});

describe("cache flag conflicts", () => {
  it("--no-cache with --offline is rejected up front", async () => {
    const port = countingPort(snapshot);
    const { io, err } = makeIo(port);
    expect(await runCli(argv("diagnose", dir, "--offline", "--no-cache"), io)).toBe(1);
    expect(err.join("")).toMatch(/--offline.*--no-cache|--no-cache.*--offline/);
    expect(port.calls).toBe(0);
  });

  it("--offline with --fixture warns that --offline is ignored", async () => {
    await repoWith("21.0.0");
    const fx = join(dir, "fx.json");
    await writeFile(fx, JSON.stringify(snapshot));
    const { io, err } = makeIo();
    expect(await runCli(argv("diagnose", dir, "--fixture", fx, "--offline"), io)).toBe(0);
    expect(err.join("")).toMatch(/--offline is ignored/);
  });
});

describe("login --export safety", () => {
  it("never starts a login when credentials are stored", async () => {
    const { io, state } = makeIo();
    state.exportable = "QUJD";
    await runCli(argv("login", "--export"), io);
    expect(state.loggedIn).toBe(0);
  });

  it("logs in without removing existing registration when nothing is exportable", async () => {
    const { io, state } = makeIo();
    await runCli(argv("login", "--export"), io);
    expect(state.loginOpts).toEqual([{ preserve: true }]);
  });

  it("warns on stderr when KEDGEWAY_AUTH is set in the environment", async () => {
    const { io, err, state } = makeIo();
    state.exportable = "QUJD";
    state.env["KEDGEWAY_AUTH"] = "whatever";
    await runCli(argv("login", "--export"), io);
    expect(err.join("")).toMatch(/KEDGEWAY_AUTH is set/);
  });
});

describe("invalid KEDGEWAY_AUTH", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  it("prints the clear one-line message, no stack, and exits 1", async () => {
    vi.stubEnv("KEDGEWAY_AUTH", "%%garbage%%");
    await repoWith("21.0.0");
    const { io, err } = makeIo(new RavenEcosystem());
    expect(await runCli(argv("diagnose", dir), io)).toBe(1);
    const text = err.join("");
    expect(text).toMatch(/KEDGEWAY_AUTH is not valid/);
    expect(text).not.toMatch(/\n\s+at /);
  });
});

describe("lockfile hint", () => {
  it("prints a hint when a lockfile sits above the scan root", async () => {
    await mkdir(join(dir, "repo"), { recursive: true });
    await writeFile(join(dir, "repo/Cargo.toml"), `[dependencies]\nsoroban-sdk = "^21"\n`);
    await writeFile(join(dir, "Cargo.lock"), `[[package]]\nname = "soroban-sdk"\nversion = "21.0.0"\n`);
    const { io, out } = makeIo();
    await runCli(argv("diagnose", join(dir, "repo")), io);
    expect(out.join("")).toMatch(/hint: Cargo\.lock found in .* above the scan root/);
  });
});

describe("migrate lockfile note", () => {
  it("mentions the lockfiles the edits do not update", async () => {
    await repoWith("21.0.0");
    await writeFile(join(dir, "c/Cargo.lock"), `[[package]]\nname = "soroban-sdk"\nversion = "21.0.0"\n`);
    const { io, out } = makeIo();
    await runCli(argv("migrate", dir), io);
    expect(out.join("")).toMatch(/Lockfile\(s\) present \(Cargo\.lock\)/);
  });
});
