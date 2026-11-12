import { describe, expect, it } from "vitest";
import type { Finding } from "./diagnose.js";
import { buildGuide } from "./guide.js";
import type { MigrationPlan, MigrationStep } from "./migration.js";
import { branchNameFor, checkBranchPolicy, decidePr, githubHostFor, httpRemote, prTitleFor, renderPrBody, repoFromRemoteUrl, validateBranchName, validateRepoSlug, type PrBodyInput } from "./pr.js";
import type { EcosystemSnapshot } from "../ports/ecosystem.js";

const snapshot: EcosystemSnapshot = {
  observedAt: "2026-11-11T00:00:00.000Z",
  sorobanSdk: { currentMajor: 28, currentVersion: "28.0.0", deprecatedVersions: ["21.0.0"], source: "fixture: official page" },
  jsSdk: { currentVersion: "17.2.1", source: "fixture" },
  stellarCli: { currentVersion: "28.1.0", source: "fixture" },
  protocolCurrent: 29,
  degraded: [],
  notes: [],
};

const rustStep: MigrationStep = {
  file: "Cargo.toml",
  kind: "bump-rust-dep",
  dependency: "soroban-sdk",
  from: "21.0.0",
  to: "28.0.0",
  reason: "soroban-sdk 21.0.0 is deprecated. Evidence: x",
  findingCode: "SDK_DEPRECATED",
};
const jsStep: MigrationStep = { ...rustStep, file: "package.json", kind: "bump-js-dep", dependency: "@stellar/stellar-sdk", from: "^12.0.0", to: "^17.2.1", findingCode: "JS_SDK_BEHIND" };
const legacyStep: MigrationStep = { ...jsStep, kind: "replace-legacy-package", dependency: "soroban-client", from: "^1.0.0", replacement: "@stellar/stellar-sdk", findingCode: "JS_LEGACY_PACKAGE" };
const manualStep: MigrationStep = { file: "Cargo.toml", kind: "manual", dependency: "soroban-sdk", from: ">=20", to: "", reason: "not a plain version", findingCode: "SDK_BEHIND" };

const plan = (steps: MigrationStep[], extra: Partial<MigrationPlan> = {}): MigrationPlan => ({ root: "/r", steps, followUp: [], ...extra });

describe("branchNameFor", () => {
  it("uses the target major of the primary edit", () => {
    expect(branchNameFor(plan([rustStep]))).toBe("kedgeway/migrate-28");
    expect(branchNameFor(plan([jsStep]))).toBe("kedgeway/migrate-17");
    expect(branchNameFor(plan([legacyStep]))).toBe("kedgeway/migrate-17");
  });
  it("prefers the rust dependency when both change, and ignores manual steps", () => {
    expect(branchNameFor(plan([manualStep, jsStep, rustStep]))).toBe("kedgeway/migrate-28");
  });
  it("falls back to toolchain", () => {
    expect(branchNameFor(plan([]))).toBe("kedgeway/migrate-toolchain");
    expect(branchNameFor(plan([manualStep]))).toBe("kedgeway/migrate-toolchain");
  });
  it("emits only safe characters even for hostile versions", () => {
    const evil = { ...rustStep, to: "28;rm -rf /.0" };
    const name = branchNameFor(plan([evil]));
    expect(name).toMatch(/^kedgeway\/migrate-[A-Za-z0-9._-]+$/);
    expect(() => validateBranchName(name)).not.toThrow();
  });
  it("parses aliased npm targets", () => {
    const aliased = { ...jsStep, to: "npm:@stellar/stellar-sdk@^17.2.1" };
    expect(branchNameFor(plan([aliased]))).toBe("kedgeway/migrate-17");
  });
});

describe("prTitleFor", () => {
  it("names the dependency and the major", () => {
    expect(prTitleFor(plan([rustStep]))).toBe("chore(deps): migrate soroban-sdk to 28");
    expect(prTitleFor(plan([legacyStep]))).toBe("chore(deps): migrate @stellar/stellar-sdk to 17");
  });
  it("uses the toolchain title without a concrete edit", () => {
    expect(prTitleFor(plan([manualStep]))).toBe("chore(toolchain): kedgeway migration");
  });
  it("is at most 72 characters and single-line", () => {
    const long = { ...rustStep, dependency: `x${"y".repeat(200)}\nz` };
    const t = prTitleFor(plan([long]));
    expect(t.length).toBeLessThanOrEqual(72);
    expect(t).not.toMatch(/[\r\n]/);
    expect(t.startsWith("chore(deps): migrate ")).toBe(true);
  });
});

describe("decidePr", () => {
  it("skips when there are no edits", () => {
    const d = decidePr({ plan: plan([manualStep]), existing: [] });
    expect(d.action).toBe("skip");
    expect(d.action === "skip" && d.reason).toMatch(/no automatic edits/i);
  });
  it("creates when nothing is open on the branch", () => {
    expect(decidePr({ plan: plan([rustStep]), existing: [] })).toEqual({ action: "create" });
  });
  it("updates the open PR whose head is the branch", () => {
    const d = decidePr({ plan: plan([rustStep]), existing: [{ number: 7, state: "open", headRef: "kedgeway/migrate-28" }] });
    expect(d).toEqual({ action: "update", number: 7 });
  });
  it("ignores closed PRs and other branches", () => {
    expect(
      decidePr({
        plan: plan([rustStep]),
        existing: [
          { number: 3, state: "closed", headRef: "kedgeway/migrate-28" },
          { number: 4, state: "open", headRef: "kedgeway/migrate-29" },
        ],
      }),
    ).toEqual({ action: "create" });
  });
  it("never yields two PRs: several open matches update the lowest number", () => {
    const d = decidePr({
      plan: plan([rustStep]),
      existing: [
        { number: 9, state: "open", headRef: "kedgeway/migrate-28" },
        { number: 5, state: "open", headRef: "kedgeway/migrate-28" },
      ],
    });
    expect(d).toEqual({ action: "update", number: 5 });
  });
  it("honours a branch override", () => {
    const d = decidePr({ plan: plan([rustStep]), existing: [{ number: 2, state: "open", headRef: "bot/x" }], branch: "bot/x" });
    expect(d).toEqual({ action: "update", number: 2 });
  });
});

describe("decidePr base matching", () => {
  it("only updates a PR that targets the same base", () => {
    const existing = [
      { number: 3, state: "open", headRef: "kedgeway/migrate-28", baseRef: "dev" },
      { number: 4, state: "open", headRef: "kedgeway/migrate-28", baseRef: "main" },
    ];
    expect(decidePr({ plan: plan([rustStep]), existing, base: "main" })).toEqual({ action: "update", number: 4 });
    expect(decidePr({ plan: plan([rustStep]), existing: [existing[0] as (typeof existing)[0]], base: "main" })).toEqual({ action: "create" });
    expect(decidePr({ plan: plan([rustStep]), existing: [{ number: 6, state: "open", headRef: "kedgeway/migrate-28" }], base: "main" })).toEqual({ action: "create" });
  });
});

describe("branch policy and push host", () => {
  const ok = { branch: "kedgeway/migrate-28", base: "main", defaultBranch: "main", startBranch: "main" };
  it("accepts a kedgeway/ branch that is none of base, default or start", () => {
    expect(() => checkBranchPolicy(ok)).not.toThrow();
  });
  it("refuses a branch equal to the base, the default branch or the checked-out branch, even with allowAny", () => {
    for (const bad of [{ branch: "main" }, { branch: "develop", base: "develop" }, { branch: "trunk", defaultBranch: "trunk" }, { branch: "work", startBranch: "work" }]) {
      expect(() => checkBranchPolicy({ ...ok, ...bad, allowAny: true }), JSON.stringify(bad)).toThrow(/base|default|checked-out/i);
    }
  });
  it("compares case-insensitively (case-folding filesystems) and rejects refs/ and heads/ prefixes", () => {
    for (const bad of [{ branch: "Main" }, { branch: "MAIN", base: "main" }, { branch: "Trunk", defaultBranch: "trunk" }, { branch: "Work", startBranch: "work" }]) {
      expect(() => checkBranchPolicy({ ...ok, ...bad, allowAny: true }), JSON.stringify(bad)).toThrow(/base|default|checked-out/i);
    }
    for (const bad of ["refs/heads/x", "heads/x", "refs/tags/v1"]) {
      expect(() => checkBranchPolicy({ ...ok, branch: bad, allowAny: true }), bad).toThrow(/refs\/|heads\//);
    }
  });
  it("requires the kedgeway/ prefix unless allowAny", () => {
    expect(() => checkBranchPolicy({ ...ok, branch: "develop" })).toThrow(/kedgeway\//);
    expect(() => checkBranchPolicy({ ...ok, branch: "develop", allowAny: true })).not.toThrow();
  });
  it("tolerates unknown default/start branches", () => {
    expect(() => checkBranchPolicy({ branch: "kedgeway/x", base: "main", defaultBranch: null, startBranch: null })).not.toThrow();
  });
  it("derives the GitHub host from the API base", () => {
    expect(githubHostFor("https://api.github.com")).toBe("github.com");
    expect(githubHostFor("https://ghe.example/api/v3")).toBe("ghe.example");
    expect(githubHostFor("http://127.0.0.1:9999")).toBe("127.0.0.1:9999");
  });
  it("httpRemote parses http(s) remotes only", () => {
    expect(httpRemote("https://github.com/o/r.git")).toEqual({ scheme: "https", host: "github.com" });
    expect(httpRemote("https://x-access-token:s@GitHub.com/o/r")).toEqual({ scheme: "https", host: "github.com" });
    expect(httpRemote("http://127.0.0.1:5/o/r")).toEqual({ scheme: "http", host: "127.0.0.1:5" });
    for (const n of ["/tmp/bare", "file:///tmp/b", "git@github.com:o/r.git", "ssh://git@github.com/o/r"]) expect(httpRemote(n), n).toBeNull();
  });
});

describe("validators", () => {
  it("accepts sane branch names and rejects unsafe ones", () => {
    for (const ok of ["kedgeway/migrate-28", "bot/x_y.z-1"]) expect(() => validateBranchName(ok), ok).not.toThrow();
    for (const bad of ["", "-x", "/x", "x/", "a..b", "a b", "a;b", "a//b", "x.lock", "a@{b", "a\nb", "~x", "a:b", "a\\b"]) {
      expect(() => validateBranchName(bad), bad).toThrow(/branch/i);
    }
  });
  it("validates owner/repo", () => {
    expect(validateRepoSlug("Klorenn/kedgeway")).toEqual({ owner: "Klorenn", repo: "kedgeway" });
    for (const bad of ["", "a", "a/b/c", "a b/c", "../x", "a/b;c", "-a/b"]) expect(() => validateRepoSlug(bad), bad).toThrow(/owner\/repo/);
  });
  it("derives owner/repo from a git remote url without leaking credentials", () => {
    expect(repoFromRemoteUrl("https://github.com/o/r.git")).toBe("o/r");
    expect(repoFromRemoteUrl("https://x-access-token:SECRET@github.com/o/r")).toBe("o/r");
    expect(repoFromRemoteUrl("git@github.com:o/r.git")).toBe("o/r");
    expect(repoFromRemoteUrl("ssh://git@github.com/o/r.git")).toBe("o/r");
    expect(repoFromRemoteUrl("/tmp/some/bare")).toBeNull();
    expect(repoFromRemoteUrl("file:///tmp/bare")).toBeNull();
  });
});

const finding = (over: Partial<Finding> = {}): Finding => ({
  severity: "critical",
  code: "SDK_DEPRECATED",
  message: "soroban-sdk 21.0.0 is deprecated",
  file: "Cargo.toml",
  line: 7,
  evidence: "e",
  ...over,
});

function input(over: Partial<PrBodyInput> = {}): PrBodyInput {
  const p = over.plan ?? plan([rustStep, manualStep], { followUp: ["cargo update -p soroban-sdk"] });
  return {
    plan: p,
    findings: [finding()],
    guide: buildGuide(p, snapshot, []),
    snapshot,
    display: "github.com/o/r",
    lockfilesTouched: [],
    version: "0.3.0",
    ...over,
  };
}

/** Lines outside code fences. */
function outsideFences(md: string): string[] {
  const out: string[] = [];
  let fence: string | null = null;
  for (const line of md.split("\n")) {
    const m = /^(`{3,})/.exec(line);
    if (fence === null && m) {
      fence = m[1] as string;
      continue;
    }
    if (fence !== null) {
      if (line.startsWith(fence) && line.trim() === fence) fence = null;
      continue;
    }
    out.push(line);
  }
  return out;
}

describe("renderPrBody", () => {
  const body = renderPrBody(input());

  it("opens with a summary of what moves", () => {
    const first = body.split("\n").find((l) => l.trim() !== "") as string;
    expect(first).toContain("`soroban-sdk`");
    expect(first).toContain("`21.0.0`");
    expect(first).toContain("`28.0.0`");
  });
  it("has the findings table, edits, manual checklist, guide, provenance and footer", () => {
    expect(body).toContain("| Code | Severity | Location | Status |");
    expect(body).toContain("| `SDK_DEPRECATED` | `critical` | `Cargo.toml:7` | `fixed by this PR` |");
    expect(body).toMatch(/## Edits/);
    expect(body).toContain("`Cargo.toml`");
    expect(body).toMatch(/## Manual follow-ups\n\n- \[ \] /);
    expect(body).toMatch(/## Migration guide\n\n```/);
    expect(body).toContain("`fixture: official page`");
    expect(body).toContain("`2026-11-11T00:00:00.000Z`");
    expect(body.trimEnd().split("\n").pop()).toBe("Opened by kedgeway 0.3.0");
  });
  it("omits the lockfile note unless a lockfile is touched", () => {
    expect(body).not.toMatch(/## Lockfiles/);
    const withLock = renderPrBody(input({ lockfilesTouched: ["Cargo.lock"] }));
    expect(withLock).toMatch(/## Lockfiles/);
    expect(withLock).toContain("`Cargo.lock`");
  });
  it("renders refresh notes and extra notes", () => {
    const b = renderPrBody(input({ lockfilesTouched: ["Cargo.lock"], notes: ["Could not refresh `Cargo.lock`: boom"] }));
    expect(b).toContain("boom");
  });
  it("lists no checklist when there are no manual steps", () => {
    expect(renderPrBody(input({ plan: plan([rustStep]) }))).not.toMatch(/## Manual follow-ups/);
  });
  it("is deterministic", () => {
    expect(renderPrBody(input())).toBe(body);
  });

  describe("hostile strings", () => {
    const evil = "x`\n# H1\n- item\n| a | b |\n> quote\n::error::pwned\n```\n## escape\r\n\u001b[31m";
    const hostile = renderPrBody(
      input({
        plan: plan([{ ...rustStep, file: `Cargo${evil}.toml`, reason: evil }, { ...manualStep, file: evil, dependency: evil, reason: evil }]),
        findings: [finding({ file: evil, message: evil, code: evil, evidence: evil, line: 3 })],
        display: evil,
        snapshot: { ...snapshot, observedAt: evil, sorobanSdk: { ...snapshot.sorobanSdk, source: evil }, notes: [{ title: evil, url: "https://docs.example/migration", snippet: evil }] },
        guide: { lines: ["Guide", `  ${evil}`, "```", "# not a heading", "````"] },
        notes: [evil],
        version: "0.3.0",
      }),
    );

    it("never lets untrusted text start a line outside a fence", () => {
      for (const line of outsideFences(hostile)) {
        expect(line, line).not.toMatch(/^\s*(::|#{1,6}\s*(H1|escape|not))/);
        expect(line).not.toMatch(/^\s*(- item|\| a \| b|> quote)/);

        expect(line).not.toContain("\r");
      }
    });
    it("keeps every fence balanced and strips control characters", () => {
      expect(hostile).not.toContain("\u001b");
      let open: string | null = null;
      for (const line of hostile.split("\n")) {
        const m = /^(`{3,})/.exec(line);
        if (open === null && m) open = m[1] as string;
        else if (open !== null && line === open) open = null;
      }
      expect(open).toBeNull();
    });
    it("keeps every table row on one line with the right cell count", () => {
      const rows = outsideFences(hostile).filter((l) => l.startsWith("|"));
      expect(rows.length).toBeGreaterThan(2);
      for (const r of rows) expect(r.replace(/\\\|/g, "").split("|").length, r).toBe(6);
    });
  });
});

describe("renderPrBody: fixed versus manual", () => {
  const rustPlan = plan([rustStep]);
  const mixed: Finding[] = [
    finding({ severity: "info", code: "SDK_CURRENT", file: "other/Cargo.toml", line: 2 }),
    finding({ severity: "warning", code: "RUST_TOOLCHAIN_OLD", file: "rust-toolchain.toml", line: 2 }),
    finding({ severity: "warning", code: "RUST_TARGET_LEGACY", file: ".github/workflows/ci.yml", line: 14 }),
    finding({ severity: "warning", code: "RUST_TARGET_LEGACY", file: "Makefile", line: 3 }),
    finding({ severity: "critical", code: "CLI_DEPRECATED", file: ".github/workflows/ci.yml", line: 20 }),
    finding(),
  ];
  const b = renderPrBody(input({ plan: rustPlan, findings: mixed }));
  const rows = b.split("\n").filter((l) => l.startsWith("| `"));

  it("sorts fixed, then manual, then info, by severity inside each group", () => {
    expect(rows.map((r) => r.split("|")[1]?.trim())).toEqual(["`SDK_DEPRECATED`", "`CLI_DEPRECATED`", "`RUST_TOOLCHAIN_OLD`", "`RUST_TARGET_LEGACY`", "`RUST_TARGET_LEGACY`", "`SDK_CURRENT`"]);
  });
  it("marks each finding fixed, manual or informational", () => {
    expect(rows[0]).toContain("| `fixed by this PR` |");
    for (const r of rows.slice(1, 5)) expect(r).toMatch(/\| `manual` \|$/);
    expect(rows[5]).toMatch(/\| — \|$/);
  });
  it("does not call a finding fixed when the edit is for another file or dependency", () => {
    const other = renderPrBody(input({ plan: rustPlan, findings: [finding({ file: "elsewhere/Cargo.toml" })] }));
    expect(other).toMatch(/\| `manual` \|\n/);
  });
  it("treats an informational RUST_TARGET_LEGACY (browser Wasm) as info", () => {
    const w = renderPrBody(input({ plan: rustPlan, findings: [finding({ severity: "info", code: "RUST_TARGET_LEGACY", file: "web/ci.yml", line: 1 })] }));
    expect(w).toMatch(/\| — \|\n/);
    expect(w).not.toMatch(/## Manual follow-ups/);
  });
  it("has a concrete checkbox per manual finding", () => {
    expect(b).toContain("- [ ] Bump `stellar-cli` to `28.1.0` in `.github/workflows/ci.yml:20` (`cargo install --locked stellar-cli --version 28.1.0`)");
    expect(b).toContain("- [ ] Replace `wasm32-unknown-unknown` with `wasm32v1-none` in `.github/workflows/ci.yml:14` and run `rustup target add wasm32v1-none`");
    expect(b).toContain("- [ ] Replace `wasm32-unknown-unknown` with `wasm32v1-none` in `Makefile:3` and run `rustup target add wasm32v1-none`");
    expect(b).toContain("- [ ] Raise the Rust channel in `rust-toolchain.toml` to `1.84.0` or newer");
    expect(b.split("\n").filter((l) => l.startsWith("- [ ] ")).length).toBe(4);
  });
  it("counts them in the summary line", () => {
    const first = b.split("\n").find((l) => l.trim() !== "") as string;
    expect(first).toContain("fixes 1 finding");
    expect(first).toContain("4 need a manual follow-up");
    expect(renderPrBody(input({ plan: rustPlan, findings: [finding()] })).split("\n")[0]).not.toContain("manual follow-up");
  });
  it("keeps plan manual steps and does not duplicate their finding", () => {
    const m = renderPrBody(input({ plan: plan([rustStep, manualStep]), findings: [finding(), finding({ code: "SDK_BEHIND", severity: "warning" })] }));
    expect(m).toContain("not a plain version");
    expect(m.split("\n").filter((l) => l.startsWith("- [ ] ")).length).toBe(1);
    expect(m.split("\n")[0]).toContain("1 needs a manual follow-up");
  });
  it("says 'the current version' instead of inventing a number", () => {
    const n = renderPrBody(input({ plan: rustPlan, findings: [finding({ severity: "critical", code: "CLI_DEPRECATED", file: "ci.yml", line: 4 })], snapshot: { ...snapshot, stellarCli: { currentVersion: null, source: "x" } } }));
    expect(n).toContain("- [ ] Bump `stellar-cli` to the current version in `ci.yml:4`");
    expect(n).not.toContain("--version");
    expect(n).not.toContain("28.1.0");
  });
  it("sanitises a hostile CLI version", () => {
    const h = renderPrBody(input({ plan: rustPlan, findings: [finding({ severity: "critical", code: "CLI_BEHIND", file: "ci.yml", line: 4 })], snapshot: { ...snapshot, stellarCli: { currentVersion: "1.0.0`\n# x; rm -rf /", source: "x" } } }));
    for (const line of outsideFences(h)) expect(line).not.toMatch(/^# x/);
    expect(h).not.toContain("rm -rf");
  });
});
