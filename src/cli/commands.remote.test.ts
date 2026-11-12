import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FakeEcosystem } from "../adapters/fake-ecosystem.js";
import type { RemoteExec } from "../adapters/remote-repo.js";
import type { EcosystemSnapshot } from "../ports/ecosystem.js";
import { runCli, type CliIo } from "./commands.js";

const snapshot: EcosystemSnapshot = {
  observedAt: "2026-01-01T00:00:00.000Z",
  sorobanSdk: { currentMajor: 23, currentVersion: "23.0.0", deprecatedVersions: [], source: "fake" },
  jsSdk: { currentVersion: null, source: "fake" },
  stellarCli: { currentVersion: "28.1.0", source: "fake" },
  protocolCurrent: null,
  degraded: [],
  notes: [],
};

let tmpRoot: string;
let cwd: string;
beforeEach(async () => {
  tmpRoot = await mkdtemp(join(tmpdir(), "kw-clir-tmp-"));
  cwd = await mkdtemp(join(tmpdir(), "kw-clir-cwd-"));
});
afterEach(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
  await rm(cwd, { recursive: true, force: true });
});

function setup(files: Record<string, string> = { "contracts/a/Cargo.toml": '[dependencies]\nsoroban-sdk = "21.0.0"\n' }) {
  const out: string[] = [];
  const err: string[] = [];
  const execCalls: string[][] = [];
  const exec: RemoteExec = async (_f, args) => {
    execCalls.push(args);
    const dest = args[args.length - 1] as string;
    for (const [rel, text] of Object.entries(files)) {
      await mkdir(join(dest, rel, ".."), { recursive: true });
      await writeFile(join(dest, rel), text);
    }
    return { stdout: "", stderr: "" };
  };
  const written: Record<string, string> = {};
  const io = {
    stdout: (s: string) => out.push(s),
    stderr: (s: string) => err.push(s),
    createRavenPort: () => new FakeEcosystem(snapshot),
    writeFile: (p: string, t: string) => {
      written[p] = t;
      return Promise.resolve();
    },
    cwd: () => cwd,
    version: "9.9.9",
    remote: { exec, tmpRoot },
  } as unknown as CliIo;
  return { io, out, err, execCalls, written };
}

describe("diagnose <url>", () => {
  it("shows the display name, relative files, and leaves no temp dir", async () => {
    const t = setup();
    const code = await runCli(["node", "kedgeway", "diagnose", "https://github.com/o/r/tree/dev", "--no-cache"], t.io);
    expect(code).toBe(0);
    const text = t.out.join("");
    expect(text.split("\n")[0]).toBe("kedgeway: github.com/o/r@dev");
    expect(text).toContain("contracts/a/Cargo.toml");
    expect(text).not.toContain("kedgeway-");
    expect(t.execCalls[0]).toContain("dev");
    expect(await readdir(tmpRoot)).toEqual([]);
  });

  it("accepts the owner/repo shorthand and --ref", async () => {
    const t = setup();
    expect(await runCli(["node", "kedgeway", "diagnose", "o/r", "--ref", "v1", "--no-cache"], t.io)).toBe(0);
    expect(t.out.join("")).toContain("kedgeway: github.com/o/r@v1");
  });

  it("prints one stderr line when the shorthand is treated as github, and not for URLs", async () => {
    const t = setup();
    await runCli(["node", "kedgeway", "diagnose", "o/r", "--no-cache"], t.io);
    expect(t.err.join("")).toBe("kedgeway: treating 'o/r' as github.com/o/r\n");
    const u = setup();
    await runCli(["node", "kedgeway", "diagnose", "https://github.com/o/r", "--no-cache"], u.io);
    expect(u.err.join("")).toBe("");
  });

  it("rejects internal hosts", async () => {
    const t = setup();
    expect(await runCli(["node", "kedgeway", "diagnose", "http://169.254.169.254/o/r"], t.io)).toBe(1);
    expect(t.err.join("")).toMatch(/host not allowed/);
    expect(t.execCalls).toHaveLength(0);
  });

  it("an existing local dir wins over the shorthand", async () => {
    const t = setup();
    const here = await mkdtemp(join(process.cwd(), "kwt-")); // a relative "kwt-xxxx/r" that exists under process.cwd()
    try {
      await mkdir(join(here, "r"));
      await writeFile(join(here, "r/Cargo.toml"), '[dependencies]\nsoroban-sdk = "23.0.0"\n');
      const rel = `${here.split("/").pop()}/r`;
      expect(await runCli(["node", "kedgeway", "diagnose", rel, "--no-cache"], t.io)).toBe(0);
      expect(t.execCalls).toHaveLength(0);
      expect(t.out.join("")).toContain("kedgeway:");
    } finally {
      await rm(here, { recursive: true, force: true });
    }
  });

  it("--ref conflicting with the URL ref exits 1", async () => {
    const t = setup();
    expect(await runCli(["node", "kedgeway", "diagnose", "https://github.com/o/r/tree/a", "--ref", "b"], t.io)).toBe(1);
    expect(t.err.join("")).toMatch(/conflict/);
    expect(t.execCalls).toHaveLength(0);
  });

  it("--ref with the same ref is fine", async () => {
    const t = setup();
    expect(await runCli(["node", "kedgeway", "diagnose", "https://github.com/o/r/tree/a", "--ref", "a", "--no-cache"], t.io)).toBe(0);
  });

  it("--ref on a local path exits 1", async () => {
    const t = setup();
    expect(await runCli(["node", "kedgeway", "diagnose", cwd, "--ref", "a"], t.io)).toBe(1);
    expect(t.err.join("")).toMatch(/--ref/);
  });

  it.each(["file:///etc/passwd", "javascript:alert(1)", "https://u:p@github.com/o/r"])("rejects %s with exit 1 and no clone", async (u) => {
    const t = setup();
    expect(await runCli(["node", "kedgeway", "diagnose", u], t.io)).toBe(1);
    expect(t.err.join("")).toMatch(/kedgeway:/);
    expect(t.execCalls).toHaveLength(0);
  });

  it("json format has relative files; sarif has relative uris and no file://", async () => {
    const t = setup();
    expect(await runCli(["node", "kedgeway", "diagnose", "o/r", "--format", "sarif", "--no-cache"], t.io)).toBe(0);
    const sarif = t.out.join("");
    expect(sarif).not.toContain("file://");
    expect(sarif).not.toContain("kedgeway-");
    expect(sarif).toContain('"contracts/a/Cargo.toml"');
    const j = setup();
    expect(await runCli(["node", "kedgeway", "diagnose", "o/r", "--json", "--no-cache"], j.io)).toBe(0);
    expect(JSON.parse(j.out.join("")).findings[0].file).toBe("contracts/a/Cargo.toml");
  });

  it("keeps exit codes: --fail-on trips with 2", async () => {
    const t = setup();
    expect(await runCli(["node", "kedgeway", "diagnose", "o/r", "--fail-on", "warning", "--no-cache"], t.io)).toBe(2);
  });

  it("clone failure is exit 1 with the reason", async () => {
    const t = setup();
    t.io.remote = {
      tmpRoot,
      exec: async () => {
        throw Object.assign(new Error("x"), { code: 128, stderr: "fatal: repository not found" });
      },
    };
    expect(await runCli(["node", "kedgeway", "diagnose", "o/r"], t.io)).toBe(1);
    expect(t.err.join("")).toMatch(/repository not found/);
    expect(await readdir(tmpRoot)).toEqual([]);
  });
});

describe("migrate <url>", () => {
  it("is a dry run rooted at the display name", async () => {
    const t = setup();
    const code = await runCli(["node", "kedgeway", "migrate", "https://github.com/o/r", "--no-cache"], t.io);
    expect(code).toBe(2);
    const text = t.out.join("");
    expect(text).toContain("kedgeway migrate (dry run): github.com/o/r");
    expect(text).not.toContain("kedgeway-");
    expect(await readdir(tmpRoot)).toEqual([]);
  });

  it("rejects --write with exit 2 before cloning", async () => {
    const t = setup();
    const code = await runCli(["node", "kedgeway", "migrate", "o/r", "--write"], t.io);
    expect(code).toBe(2);
    expect(t.err.join("")).toContain("remote sources are dry-run only; clone it and run migrate locally");
    expect(t.execCalls).toHaveLength(0);
  });
});
