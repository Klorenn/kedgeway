import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FakeEcosystem } from "./adapters/fake-ecosystem.js";
import type { RemoteExec } from "./adapters/remote-repo.js";
import { diagnoseRemote, migrateRemote, parseRepoSource, resolveRepoSource, toAnnotations, toSarif } from "./sdk.js";
import type { EcosystemSnapshot } from "./ports/ecosystem.js";

const snapshot: EcosystemSnapshot = {
  observedAt: "2026-01-01T00:00:00.000Z",
  sorobanSdk: { currentMajor: 23, currentVersion: "23.0.0", deprecatedVersions: [], source: "fake" },
  jsSdk: { currentVersion: null, source: "fake" },
  stellarCli: { currentVersion: "28.1.0", source: "fake" },
  protocolCurrent: null,
  degraded: [],
  notes: [],
};

let scratch: string;
beforeEach(async () => {
  scratch = await mkdtemp(join(tmpdir(), "kw-sdkr-"));
});
afterEach(async () => {
  await rm(scratch, { recursive: true, force: true });
});

const cloneWith = (files: Record<string, string>): RemoteExec => async (_f, args) => {
  const dest = args[args.length - 1] as string;
  for (const [rel, text] of Object.entries(files)) {
    await mkdir(join(dest, rel, ".."), { recursive: true });
    await writeFile(join(dest, rel), text);
  }
  await mkdir(dest, { recursive: true });
  return { stdout: "", stderr: "" };
};
const OLD = { "contracts/a/Cargo.toml": '[dependencies]\nsoroban-sdk = "21.0.0"\n' };

describe("diagnoseRemote", () => {
  it("hides the temp dir: display root, relative files, relative SARIF and annotations", async () => {
    const d = await diagnoseRemote({ source: "https://github.com/o/r", ref: "main", ecosystem: new FakeEcosystem(snapshot), exec: cloneWith(OLD) });
    expect(d.display).toBe("github.com/o/r@main");
    expect(d.facts.root).toBe("github.com/o/r@main");
    const files = d.diagnosis.findings.map((f) => f.file);
    expect(files).toContain("contracts/a/Cargo.toml");
    expect(JSON.stringify(d)).not.toContain("kedgeway-");
    const sarif = JSON.stringify(toSarif(d, { cwd: "/somewhere/else" }));
    expect(sarif).not.toContain("file://");
    expect(sarif).not.toContain("kedgeway-");
    expect(sarif).toContain('"contracts/a/Cargo.toml"');
    const ann = toAnnotations(d, { cwd: "/somewhere/else" }).join("\n");
    expect(ann).toContain("file=contracts/a/Cargo.toml");
    expect(ann).not.toContain("kedgeway-");
  });

  it("NO_SDK_FOUND points at '.' not the temp dir", async () => {
    const d = await diagnoseRemote({ source: "o/r", ecosystem: new FakeEcosystem(snapshot), exec: cloneWith({ "README.md": "x" }) });
    const f = d.diagnosis.findings.find((x) => x.code === "NO_SDK_FOUND");
    expect(f?.file).toBe(".");
    expect(JSON.stringify(d)).not.toContain("kedgeway-");
  });

  it("allowHttp: false refuses http sources", async () => {
    await expect(diagnoseRemote({ source: "http://github.com/o/r", allowHttp: false, ecosystem: new FakeEcosystem(snapshot), exec: cloneWith(OLD) })).rejects.toThrow(/http/);
    await expect(migrateRemote({ source: "http://github.com/o/r", allowHttp: false, ecosystem: new FakeEcosystem(snapshot), exec: cloneWith(OLD) })).rejects.toThrow(/http/);
  });

  it("refuses a local source", async () => {
    await expect(diagnoseRemote({ source: "./local", ecosystem: new FakeEcosystem(snapshot) })).rejects.toThrow(/not a remote/);
  });
});

describe("migrateRemote", () => {
  it("returns a dry-run plan rooted at the display name", async () => {
    const o = await migrateRemote({ source: "o/r", ecosystem: new FakeEcosystem(snapshot), exec: cloneWith(OLD) });
    expect(o.plan.root).toBe("github.com/o/r");
    expect(o.result.written).toBe(false);
    expect(o.plan.steps.some((s) => s.kind !== "manual")).toBe(true);
    expect(o.result.diff).toContain("contracts/a/Cargo.toml");
    expect(JSON.stringify(o)).not.toContain("kedgeway-");
  });
});

describe("resolveRepoSource", () => {
  it("prefers an existing local path over the shorthand", async () => {
    await mkdir(join(scratch, "o/r"), { recursive: true });
    expect(await resolveRepoSource("o/r", { cwd: scratch })).toEqual({ kind: "local" });
    expect((await resolveRepoSource("x/y", { cwd: scratch })).kind).toBe("remote");
    expect((await resolveRepoSource("https://github.com/o/r", { cwd: scratch })).kind).toBe("remote");
  });
  it("re-exports parseRepoSource", () => {
    expect(parseRepoSource("o/r").kind).toBe("remote");
  });
});
