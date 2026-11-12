import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { diagnose, loadFixture } from "./index.js";

const root = resolve(import.meta.dirname, "..");

describe("committed ecosystem fixture", () => {
  it("loads and carries the 2026-11-11 values", async () => {
    const snap = await (await loadFixture(resolve(root, "fixtures/ecosystem-2026-11-11.json"))).fetchSnapshot();
    expect(snap.sorobanSdk.currentMajor).toBe(28);
    expect(snap.sorobanSdk.deprecatedVersions).toEqual(["21.0.0", "20.0.0", "22.0.1"]);
    expect(snap.jsSdk.currentVersion).toBe("17.2.1");
    expect(snap.protocolCurrent).toBe(29);
    expect(snap.degraded).toEqual([]);
  });

  it("lets the self-test pass: this repo has no finding at or above warning", async () => {
    const d = await diagnose({ path: root, fixture: resolve(root, "fixtures/ecosystem-2026-11-11.json") });
    expect(d.summary.critical + d.summary.warning).toBe(0);
  });
});

describe("action.yml", () => {
  it("declares the documented inputs and outputs and delegates to the run script", async () => {
    const y = await readFile(resolve(root, "action.yml"), "utf8");
    for (const key of ["path:", "fail-on:", "fixture:", "json:", "auth:", "sarif:", "summary:", "report-json:", "KW_AUTH:", "KW_SARIF:"]) {
      expect(y).toContain(key);
    }
    expect(y).toContain("using: composite");
    expect(y).toContain("github.action_path");
    expect(y).toContain("scripts/action-run.sh");
  });
});

describe("scripts/action-run.sh", () => {
  const script = resolve(root, "scripts/action-run.sh");
  let tmp: string;
  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), "kw-action-"));
  });
  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  async function stubCli(json: string, code: number): Promise<string> {
    const f = join(tmp, "cli.mjs");
    await writeFile(
      f,
      `import { writeFileSync } from "node:fs";
const a = process.argv.slice(2);
writeFileSync(${JSON.stringify(join(tmp, "call.json"))}, JSON.stringify({ args: a, auth: process.env.KEDGEWAY_AUTH ?? null }));
const i = a.indexOf("--sarif");
if (i !== -1) writeFileSync(a[i + 1], "{}");
console.log(${JSON.stringify(json)});
process.exit(${code});
`,
    );
    return f;
  }

  function run(env: Record<string, string>): Promise<{ code: number; out: string; outputs: string; calls: string }> {
    const outputsFile = join(tmp, "gh_output");
    return new Promise((res) => {
      execFile(
        "bash",
        [script],
        { env: { PATH: process.env["PATH"] ?? "", RUNNER_TEMP: tmp, GITHUB_OUTPUT: outputsFile, ...env } },
        async (err, stdout, stderr) => {
          const outputs = await readFile(outputsFile, "utf8").catch(() => "");
          const code = err && typeof err.code === "number" ? err.code : 0;
          res({ code, out: stdout + stderr, outputs, calls: "" });
        },
      );
    });
  }

  const report = JSON.stringify({
    findings: [{ severity: "warning", code: "SDK_BEHIND", file: "Cargo.toml", message: "behind", evidence: "e" }],
    summary: { critical: 0, warning: 1, info: 0 },
  });

  const call = async (): Promise<{ args: string[]; auth: string | null }> =>
    JSON.parse(await readFile(join(tmp, "call.json"), "utf8")) as { args: string[]; auth: string | null };

  it("fails fast naming both inputs when neither fixture nor auth is given", async () => {
    const r = await run({ KW_PATH: ".", KW_FIXTURE: "", KW_AUTH: "", KW_FAIL_ON: "warning", KW_JSON: "false", KW_CLI: "x" });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/'fixture'/);
    expect(r.out).toMatch(/'auth'/);
  });

  it("with auth and no fixture, exports KEDGEWAY_AUTH to the CLI and passes no --fixture", async () => {
    const cli = await stubCli(report, 0);
    const r = await run({ KW_PATH: ".", KW_FIXTURE: "", KW_AUTH: "c2VjcmV0", KW_FAIL_ON: "", KW_JSON: "true", KW_CLI: cli });
    expect(r.code).toBe(0);
    const c = await call();
    expect(c.auth).toBe("c2VjcmV0");
    expect(c.args).not.toContain("--fixture");
  });

  it("with a fixture, does not export the auth secret", async () => {
    const cli = await stubCli(report, 0);
    await run({ KW_PATH: ".", KW_FIXTURE: "fx.json", KW_AUTH: "c2VjcmV0", KW_FAIL_ON: "", KW_JSON: "true", KW_CLI: cli });
    const c = await call();
    expect(c.auth).toBeNull();
    expect(c.args).toEqual(expect.arrayContaining(["--fixture", "fx.json"]));
  });

  it("writes SARIF to RUNNER_TEMP and exposes the sarif output when requested", async () => {
    const cli = await stubCli(report, 2);
    const r = await run({ KW_PATH: ".", KW_FIXTURE: "fx.json", KW_FAIL_ON: "warning", KW_JSON: "false", KW_SARIF: "true", KW_CLI: cli });
    expect(r.code).toBe(2);
    expect((await call()).args).toEqual(expect.arrayContaining(["--sarif", join(tmp, "kedgeway.sarif")]));
    expect(r.outputs).toContain(`sarif=${join(tmp, "kedgeway.sarif")}`);
  });

  it("does not ask for SARIF by default", async () => {
    const cli = await stubCli(report, 0);
    const r = await run({ KW_PATH: ".", KW_FIXTURE: "fx.json", KW_FAIL_ON: "", KW_JSON: "false", KW_CLI: cli });
    expect((await call()).args).not.toContain("--sarif");
    expect(r.outputs).not.toContain("sarif=");
  });

  it("writes outputs even when fail-on trips, then exits with the CLI's code", async () => {
    const cli = await stubCli(report, 2);
    const r = await run({ KW_PATH: ".", KW_FIXTURE: "fx.json", KW_FAIL_ON: "warning", KW_JSON: "false", KW_CLI: cli });
    expect(r.code).toBe(2);
    expect(r.outputs).toContain("summary=critical=0 warning=1 info=0");
    expect(r.outputs).toMatch(/report-json=.*kedgeway-report\.json/);
    expect(r.out).toContain("SDK_BEHIND");
    expect((await readFile(join(tmp, "kedgeway-report.json"), "utf8")).includes("SDK_BEHIND")).toBe(true);
  });

  it("exits 0 and writes outputs on success", async () => {
    const cli = await stubCli(report, 0);
    const r = await run({ KW_PATH: ".", KW_FIXTURE: "fx.json", KW_FAIL_ON: "", KW_JSON: "true", KW_CLI: cli });
    expect(r.code).toBe(0);
    expect(r.outputs).toContain("summary=");
  });

  it("propagates tool errors (exit 1) without writing outputs", async () => {
    const cli = await stubCli("", 1);
    const r = await run({ KW_PATH: ".", KW_FIXTURE: "fx.json", KW_FAIL_ON: "warning", KW_JSON: "false", KW_CLI: cli });
    expect(r.code).toBe(1);
    expect(r.outputs).toBe("");
  });
});

describe("packaging", () => {
  it("emits declarations (no maps), cleans dist before building and checks dist before publishing", async () => {
    const build = JSON.parse(await readFile(resolve(root, "tsconfig.build.json"), "utf8")) as {
      compilerOptions?: { declaration?: boolean; declarationMap?: boolean };
    };
    expect(build.compilerOptions?.declaration).toBe(true);
    expect(build.compilerOptions?.declarationMap).toBeUndefined();
    const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8")) as { scripts: Record<string, string> };
    expect(pkg.scripts["build"]).toMatch(/^rm -rf dist && tsc/);
    expect(pkg.scripts["prepublishOnly"]).toContain("scripts/check-dist.mjs");
  });
});

describe("scripts/check-dist.mjs", () => {
  const script = resolve(root, "scripts/check-dist.mjs");
  let tmp: string;
  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), "kw-dist-"));
  });
  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  const required = ["cli.js", "index.js", "index.d.ts", "sdk.js", "mcp/server.js"];
  async function makeDist(files: string[]): Promise<void> {
    for (const f of files) {
      await mkdir(join(tmp, "dist", f, ".."), { recursive: true });
      await writeFile(join(tmp, "dist", f), "");
    }
  }
  const check = (): Promise<{ code: number; out: string }> =>
    new Promise((res) => {
      execFile("node", [script, tmp], (err, stdout, stderr) =>
        res({ code: err && typeof err.code === "number" ? err.code : 0, out: stdout + stderr }),
      );
    });

  it("passes for a complete dist", async () => {
    await makeDist(required);
    expect((await check()).code).toBe(0);
  });

  it("fails and names missing files", async () => {
    await makeDist(required.filter((f) => f !== "mcp/server.js"));
    const r = await check();
    expect(r.code).toBe(1);
    expect(r.out).toContain("dist/mcp/server.js");
  });

  it("fails when test files leaked into dist", async () => {
    await makeDist([...required, "core/diagnose.test.js"]);
    const r = await check();
    expect(r.code).toBe(1);
    expect(r.out).toContain("diagnose.test.js");
  });
});
