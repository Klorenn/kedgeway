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
    for (const key of ["mode:", "pr-base:", "pr-branch:", "pr-draft:", "refresh-lockfiles:", "token:", "pr-url:", "pr-action:", "KW_MODE:", "KW_PR_BASE:", "KW_PR_BRANCH:", "KW_PR_DRAFT:", "KW_REFRESH_LOCKFILES:", "KW_TOKEN:", "github.token", "path:", "repo:", "KW_REPO:", "fail-on:", "fixture:", "json:", "auth:", "sarif:", "annotations:", "version:", "summary:", "report-json:", "KW_AUTH:", "KW_SARIF:", "KW_ANNOTATIONS:"]) {
      expect(y).toContain(key);
    }
    expect(y).toContain("using: composite");
    expect(y).toContain("GITHUB_ACTION_PATH");
    expect(y).toContain("scripts/action-run.sh");
  });
});

describe(".github/workflows/action-npm-check.yml", () => {
  it("pins the published action to the package.json version", async () => {
    const y = await readFile(resolve(root, ".github/workflows/action-npm-check.yml"), "utf8");
    const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8")) as { version: string };
    expect(y).toContain(`uses: Klorenn/kedgeway@v${pkg.version}`);
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
const j = a.indexOf("--annotations");
if (j !== -1) writeFileSync(a[j + 1], "::error file=Cargo.toml,line=2,title=SDK_BEHIND::stub annotation\\n");
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

  it("repo input is passed instead of path, without annotations", async () => {
    const cli = await stubCli(report, 0);
    const r = await run({ KW_PATH: "ignored", KW_REPO: "https://github.com/o/r", KW_FIXTURE: "fx.json", KW_FAIL_ON: "", KW_JSON: "true", KW_CLI: cli, GITHUB_ACTIONS: "true" });
    expect(r.code).toBe(0);
    const c = await call();
    expect(c.args[0]).toBe("diagnose");
    expect(c.args[1]).toBe("https://github.com/o/r");
    expect(c.args).not.toContain("ignored");
    expect(c.args).not.toContain("--annotations");
  });

  it("repo input that looks like an option is refused", async () => {
    const cli = await stubCli(report, 0);
    const r = await run({ KW_REPO: "--ref=x", KW_FIXTURE: "fx.json", KW_FAIL_ON: "", KW_JSON: "true", KW_CLI: cli });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/repo/);
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

  it("annotates by default inside GitHub Actions, printing annotations before the report", async () => {
    const cli = await stubCli(report, 2);
    const r = await run({ KW_PATH: ".", KW_FIXTURE: "fx.json", KW_FAIL_ON: "warning", KW_JSON: "false", KW_CLI: cli, GITHUB_ACTIONS: "true" });
    expect((await call()).args).toEqual(expect.arrayContaining(["--annotations", join(tmp, "kedgeway-annotations.txt")]));
    expect(r.out.indexOf("::error file=Cargo.toml")).toBeGreaterThanOrEqual(0);
    expect(r.out.indexOf("::error file=Cargo.toml")).toBeLessThan(r.out.indexOf("Summary:"));
  });

  it("annotations: false overrides the Actions default, true works outside Actions", async () => {
    const cli = await stubCli(report, 0);
    await run({ KW_PATH: ".", KW_FIXTURE: "fx.json", KW_FAIL_ON: "", KW_JSON: "false", KW_ANNOTATIONS: "false", KW_CLI: cli, GITHUB_ACTIONS: "true" });
    expect((await call()).args).not.toContain("--annotations");
    await run({ KW_PATH: ".", KW_FIXTURE: "fx.json", KW_FAIL_ON: "", KW_JSON: "false", KW_ANNOTATIONS: "true", KW_CLI: cli });
    expect((await call()).args).toContain("--annotations");
  });

  it("does not annotate outside Actions by default", async () => {
    const cli = await stubCli(report, 0);
    await run({ KW_PATH: ".", KW_FIXTURE: "fx.json", KW_FAIL_ON: "", KW_JSON: "false", KW_CLI: cli });
    expect((await call()).args).not.toContain("--annotations");
  });

  it("cannot be tricked into emitting workflow commands from untrusted finding text", async () => {
    const evil = JSON.stringify({
      findings: [{ severity: "warning", code: "SDK_BEHIND", file: "::error::pwn-file", message: "line one\n::error file=x::injected\r::warning::also", evidence: "e" }],
      summary: { critical: 0, warning: 1, info: 0 },
    });
    const cli = await stubCli(evil, 0);
    const r = await run({ KW_PATH: ".", KW_FIXTURE: "fx.json", KW_FAIL_ON: "", KW_JSON: "false", KW_CLI: cli });
    expect(r.out).toContain("injected");
    for (const line of r.out.split(/\r?\n|\r/)) expect(line.startsWith("::")).toBe(false);
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

  it("fails when the text report cannot be rendered, instead of keeping the CLI's success code", async () => {
    const broken = JSON.stringify({ summary: { critical: 0, warning: 0, info: 0 } });
    const cli = await stubCli(broken, 0);
    const r = await run({ KW_PATH: ".", KW_FIXTURE: "fx.json", KW_FAIL_ON: "", KW_JSON: "false", KW_CLI: cli });
    expect(r.code).toBe(1);
  });

  it("propagates tool errors (exit 1) without writing outputs", async () => {
    const cli = await stubCli("", 1);
    const r = await run({ KW_PATH: ".", KW_FIXTURE: "fx.json", KW_FAIL_ON: "warning", KW_JSON: "false", KW_CLI: cli });
    expect(r.code).toBe(1);
    expect(r.outputs).toBe("");
  });

  describe("mode: pr", () => {
    const prJson = JSON.stringify({ action: "create", url: "https://github.com/o/r/pull/5", branch: "kedgeway/migrate-28", title: "chore(deps): migrate soroban-sdk to 28" });
    async function prStub(json: string, code: number): Promise<string> {
      const f = join(tmp, "pr-cli.mjs");
      await writeFile(
        f,
        `import { writeFileSync } from "node:fs";
writeFileSync(${JSON.stringify(join(tmp, "call.json"))}, JSON.stringify({ args: process.argv.slice(2), auth: process.env.KEDGEWAY_AUTH ?? null, token: process.env.GITHUB_TOKEN ?? null, repo: process.env.GITHUB_REPOSITORY ?? null }));
console.log(${JSON.stringify(json)});
process.exit(${code});
`,
      );
      return f;
    }
    const callPr = async (): Promise<{ args: string[]; auth: string | null; token: string | null; repo: string | null }> =>
      JSON.parse(await readFile(join(tmp, "call.json"), "utf8")) as { args: string[]; auth: string | null; token: string | null; repo: string | null };
    const base = { KW_MODE: "pr", KW_PATH: ".", KW_AUTH: "c2VjcmV0", KW_FIXTURE: "", KW_TOKEN: "ghs_tok", KW_FAIL_ON: "warning", KW_JSON: "false", GITHUB_REPOSITORY: "o/r" };

    it("runs `kedgeway pr --json`, hands the token over through the environment and exposes the outputs", async () => {
      const cli = await prStub(prJson, 0);
      const r = await run({ ...base, KW_CLI: cli });
      expect(r.code).toBe(0);
      const c = await callPr();
      expect(c.args).toEqual(["pr", ".", "--json"]);
      expect(c.token).toBe("ghs_tok");
      expect(c.auth).toBe("c2VjcmV0");
      expect(c.repo).toBe("o/r");
      expect(JSON.stringify(c.args)).not.toContain("ghs_tok");
      expect(r.outputs).toContain("pr-action=create");
      expect(r.outputs).toContain("pr-url=https://github.com/o/r/pull/5");
      expect(r.out).toContain("kedgeway pr: create https://github.com/o/r/pull/5");
      expect(r.out).not.toContain("ghs_tok");
    });

    it("passes base, branch, draft, refresh-lockfiles and fixture; with a fixture the auth secret is not exported", async () => {
      const cli = await prStub(prJson, 0);
      await run({ ...base, KW_FIXTURE: "fx.json", KW_PR_BASE: "main", KW_PR_BRANCH: "bot/x", KW_PR_DRAFT: "true", KW_REFRESH_LOCKFILES: "true", KW_CLI: cli });
      const c = await callPr();
      expect(c.args).toEqual(["pr", ".", "--json", "--fixture", "fx.json", "--base", "main", "--branch", "bot/x", "--draft", "--refresh-lockfiles"]);
      expect(c.auth).toBeNull();
    });

    it("leaves draft and refresh off unless they are exactly \"true\"", async () => {
      const cli = await prStub(prJson, 0);
      await run({ ...base, KW_PR_DRAFT: "false", KW_REFRESH_LOCKFILES: "", KW_CLI: cli });
      expect((await callPr()).args).toEqual(["pr", ".", "--json"]);
    });

    it("reports a skip with its reason and still succeeds", async () => {
      const cli = await prStub(JSON.stringify({ action: "skip", branch: "b", title: "t", reason: "no automatic edits to make" }), 0);
      const r = await run({ ...base, KW_CLI: cli });
      expect(r.code).toBe(0);
      expect(r.outputs).toContain("pr-action=skip");
      expect(r.out).toMatch(/skip.*no automatic edits/);
    });

    it("propagates the CLI's exit code and writes no outputs on failure", async () => {
      const cli = await prStub("", 1);
      const r = await run({ ...base, KW_CLI: cli });
      expect(r.code).toBe(1);
      expect(r.outputs).toBe("");
    });

    it("still needs fixture or auth, rejects the repo input and unknown modes, and refuses an option-looking path", async () => {
      const cli = await prStub(prJson, 0);
      expect((await run({ ...base, KW_AUTH: "", KW_CLI: cli })).code).toBe(1);
      const repo = await run({ ...base, KW_REPO: "o/other", KW_CLI: cli });
      expect(repo.code).toBe(1);
      expect(repo.out).toMatch(/repo/);
      const bad = await run({ ...base, KW_MODE: "bogus", KW_CLI: cli });
      expect(bad.code).toBe(1);
      expect(bad.out).toMatch(/mode/);
      expect((await run({ ...base, KW_PATH: "--evil", KW_CLI: cli })).code).toBe(1);
    });

    it("cannot be tricked into workflow commands or output injection by the CLI's JSON", async () => {
      const evil = JSON.stringify({ action: "create", url: "https://x\n::error::pwn\nfoo=bar", branch: "b", title: "::error::t\r::warning::x", reason: "::error::r" });
      const cli = await prStub(evil, 0);
      const r = await run({ ...base, KW_CLI: cli });
      for (const line of r.out.split(/\r?\n|\r/)) expect(line.startsWith("::")).toBe(false);
      for (const line of r.outputs.split("\n").filter((l) => l !== "")) expect(line).toMatch(/^(pr-action|pr-url|report-json)=/);
    });

    it("diagnose stays the default mode", async () => {
      const cli = await stubCli(report, 0);
      const r = await run({ KW_PATH: ".", KW_FIXTURE: "fx.json", KW_FAIL_ON: "", KW_JSON: "true", KW_CLI: cli });
      expect(r.code).toBe(0);
      expect((await call()).args[0]).toBe("diagnose");
    });
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
