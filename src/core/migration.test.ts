import { describe, expect, it } from "vitest";
import { planMigration } from "./migration.js";
import type { DetectedDep, RepoFacts } from "./repo-facts.js";
import type { EcosystemSnapshot } from "../ports/ecosystem.js";

const snap = (over: Partial<EcosystemSnapshot> = {}): EcosystemSnapshot => ({
  observedAt: "2026-11-11T00:00:00.000Z",
  sorobanSdk: { currentMajor: 28, currentVersion: "28.0.0", deprecatedVersions: [], source: "s" },
  jsSdk: { currentVersion: "17.2.1", source: "j" },
  protocolCurrent: 29,
  degraded: [],
  notes: [],
  ...over,
});

const dep = (name: string, raw: string, file: string, declaredIn?: string): DetectedDep => {
  const m = /(\d+)(?:\.[\d.]+)?/.exec(raw);
  const bad = /^\s*[<*]|\|\|/.test(raw) || raw === "" || !m;
  return {
    name,
    raw,
    version: bad ? null : (m?.[0] ?? null),
    major: bad ? null : Number(m?.[1]),
    resolved: null,
    resolvedFrom: null,
    file,
    ...(declaredIn ? { declaredIn } : {}),
  };
};
const facts = (rustDeps: DetectedDep[], jsDeps: DetectedDep[] = [], manifestErrors: RepoFacts["manifestErrors"] = []): RepoFacts => ({
  root: "/r",
  rustDeps,
  jsDeps,
  manifestErrors,
});

describe("planMigration: rust", () => {
  it("bumps a deprecated soroban-sdk to the exact current version", () => {
    const plan = planMigration(facts([dep("soroban-sdk", "21.0.0", "a/Cargo.toml")]), snap());
    expect(plan.root).toBe("/r");
    expect(plan.steps).toEqual([
      expect.objectContaining({
        kind: "bump-rust-dep",
        file: "a/Cargo.toml",
        dependency: "soroban-sdk",
        from: "21.0.0",
        to: "28.0.0",
        findingCode: "SDK_DEPRECATED",
      }),
    ]);
    expect(plan.steps[0]?.reason).toMatch(/\S/);
    expect(plan.followUp).toEqual(["cargo update -p soroban-sdk"]);
  });

  it("bumps SDK_BEHIND and preserves = ~ ^ prefixes", () => {
    const plan = planMigration(
      facts([dep("soroban-sdk", "=27.0.1", "a/Cargo.toml"), dep("soroban-sdk", "~27.0.2", "b/Cargo.toml")]),
      snap(),
    );
    expect(plan.steps.map((s) => [s.findingCode, s.from, s.to])).toEqual([
      ["SDK_BEHIND", "=27.0.1", "=28.0.0"],
      ["SDK_BEHIND", "~27.0.2", "~28.0.0"],
    ]);
  });

  it("falls back to <major>.0.0 when the exact current version is unknown", () => {
    const s = snap({ sorobanSdk: { currentMajor: 28, deprecatedVersions: [], source: "s" } });
    expect(planMigration(facts([dep("soroban-sdk", "21.0.0", "Cargo.toml")]), s).steps[0]?.to).toBe("28.0.0");
  });

  it("targets the workspace root once for many workspace-inheriting members", () => {
    const plan = planMigration(
      facts([
        dep("soroban-sdk", "21.0.0", "contracts/a/Cargo.toml", "Cargo.toml"),
        dep("soroban-sdk", "21.0.0", "contracts/b/Cargo.toml", "Cargo.toml"),
      ]),
      snap(),
    );
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]).toMatchObject({ file: "Cargo.toml", from: "21.0.0", to: "28.0.0" });
  });

  it("makes a manual step for operator ranges and unknown versions", () => {
    const plan = planMigration(
      facts([dep("soroban-sdk", ">=21.0.0", "a/Cargo.toml"), dep("soroban-sdk", "<21", "b/Cargo.toml")]),
      snap(),
    );
    expect(plan.steps.map((s) => s.kind)).toEqual(["manual", "manual"]);
    expect(plan.steps[0]?.findingCode).toBe("SDK_DEPRECATED");
    expect(plan.steps[1]?.findingCode).toBe("SDK_UNKNOWN");
    expect(plan.followUp).toEqual([]);
  });

  it("plans nothing for current versions", () => {
    expect(planMigration(facts([dep("soroban-sdk", "28.1.0", "Cargo.toml")]), snap()).steps).toEqual([]);
  });
});

describe("planMigration: js", () => {
  it("bumps @stellar/stellar-sdk preserving ^ and ~, and exact pins stay exact", () => {
    const plan = planMigration(
      facts(
        [],
        [
          dep("@stellar/stellar-sdk", "^12.0.0", "a/package.json"),
          dep("@stellar/stellar-sdk", "~16.0.0", "b/package.json"),
          dep("@stellar/stellar-sdk", "13.0.0", "c/package.json"),
        ],
      ),
      snap(),
    );
    expect(plan.steps.map((s) => [s.kind, s.findingCode, s.from, s.to])).toEqual([
      ["bump-js-dep", "JS_SDK_DEPRECATED", "^12.0.0", "^17.2.1"],
      ["bump-js-dep", "JS_SDK_BEHIND", "~16.0.0", "~17.2.1"],
      ["bump-js-dep", "JS_SDK_DEPRECATED", "13.0.0", "17.2.1"],
    ]);
    expect(plan.followUp).toEqual(["npm install"]);
  });

  it("does not guess a stellar-base version: manual step", () => {
    const plan = planMigration(facts([], [dep("@stellar/stellar-base", "^12.0.0", "package.json")]), snap());
    expect(plan.steps).toEqual([expect.objectContaining({ kind: "manual", dependency: "@stellar/stellar-base" })]);
    expect(plan.steps[0]?.reason).toMatch(/stellar-sdk/);
  });

  it("replaces soroban-client and unscoped stellar-sdk, plus a manual import step with rg hints", () => {
    const plan = planMigration(
      facts([], [dep("soroban-client", "^1.0.0", "package.json"), dep("stellar-sdk", "10.0.0", "web/package.json")]),
      snap(),
    );
    const replace = plan.steps.filter((s) => s.kind === "replace-legacy-package");
    expect(replace.map((s) => [s.dependency, s.replacement, s.from, s.to, s.file])).toEqual([
      ["soroban-client", "@stellar/stellar-sdk", "^1.0.0", "^17.2.1", "package.json"],
      ["stellar-sdk", "@stellar/stellar-sdk", "10.0.0", "^17.2.1", "web/package.json"],
    ]);
    const manual = plan.steps.filter((s) => s.kind === "manual");
    expect(manual).toHaveLength(2);
    expect(manual[0]?.reason).toContain(`import .* from ['"]soroban-client['"]`);
    expect(manual[1]?.reason).toContain(`import .* from ['"]stellar-sdk['"]`);
    expect(plan.followUp).toEqual(["npm install"]);
  });

  it("legacy replacement is manual when the current JS version is unknown", () => {
    const s = snap({ jsSdk: { currentVersion: null, source: "j" } });
    const plan = planMigration(facts([], [dep("soroban-client", "1.0.0", "package.json")]), s);
    expect(plan.steps.every((x) => x.kind === "manual")).toBe(true);
  });

  it("JS unknown version is a manual step", () => {
    const plan = planMigration(facts([], [dep("@stellar/stellar-sdk", "latest", "package.json")]), snap());
    expect(plan.steps).toEqual([expect.objectContaining({ kind: "manual", findingCode: "JS_SDK_UNKNOWN" })]);
  });
});

describe("planMigration: misc", () => {
  it("turns unparseable manifests into manual steps", () => {
    const plan = planMigration(facts([], [], [{ file: "bad/Cargo.toml", message: "oops" }]), snap());
    expect(plan.steps).toEqual([
      expect.objectContaining({ kind: "manual", file: "bad/Cargo.toml", findingCode: "MANIFEST_UNPARSEABLE" }),
    ]);
  });

  it("is empty when nothing is actionable", () => {
    expect(planMigration(facts([]), snap())).toEqual({ root: "/r", steps: [], followUp: [] });
  });
});

describe("planMigration: only plain versions are edited", () => {
  it.each(["12.x", "12 || 13", "12.0.0, <13", "12 - 13", "^12 || ^13", "12.*"])("JS range %s becomes a manual step", (raw) => {
    const plan = planMigration(facts([], [dep("@stellar/stellar-sdk", raw, "package.json")]), snap());
    expect(plan.steps.map((s) => s.kind)).toEqual(["manual"]);
  });

  it.each(["21.x", "21.0.0, <22", "21 || 22", "21.*"])("Rust range %s becomes a manual step", (raw) => {
    const plan = planMigration(facts([dep("soroban-sdk", raw, "Cargo.toml")]), snap());
    expect(plan.steps.map((s) => s.kind)).toEqual(["manual"]);
  });

  it("still edits plain versions with prerelease tags and short forms", () => {
    const plan = planMigration(
      facts([dep("soroban-sdk", "21", "a/Cargo.toml"), dep("soroban-sdk", "21.0.0-rc.1", "b/Cargo.toml")]),
      snap(),
    );
    expect(plan.steps.map((s) => [s.kind, s.to])).toEqual([
      ["bump-rust-dep", "28.0.0"],
      ["bump-rust-dep", "28.0.0"],
    ]);
  });
});

describe("planMigration: lockfile resolution", () => {
  it("still edits the manifest, bumping based on the resolved verdict", () => {
    const d: DetectedDep = { ...dep("soroban-sdk", "^21", "a/Cargo.toml"), resolved: "21.7.6", resolvedFrom: "Cargo.lock" };
    const plan = planMigration(facts([d]), snap());
    expect(plan.steps).toEqual([
      expect.objectContaining({ kind: "bump-rust-dep", file: "a/Cargo.toml", from: "^21", to: "^28.0.0" }),
    ]);
  });

  it("does nothing when the resolved version is already current", () => {
    const d: DetectedDep = { ...dep("soroban-sdk", "^21", "a/Cargo.toml"), resolved: "28.0.1", resolvedFrom: "Cargo.lock" };
    expect(planMigration(facts([d]), snap()).steps).toEqual([]);
  });
});

describe("planMigration: lockfile follow-ups", () => {
  const locked = (name: string, raw: string, file: string, resolved: string, from: DetectedDep["resolvedFrom"]): DetectedDep => ({
    ...dep(name, raw, file),
    resolved,
    resolvedFrom: from,
  });

  it("emits a refresh-the-lockfile manual step instead of a no-op bump when the manifest already allows the current major (Rust)", () => {
    const plan = planMigration(facts([locked("soroban-sdk", "^28", "a/Cargo.toml", "27.0.5", "Cargo.lock")]), snap());
    expect(plan.steps).toEqual([
      expect.objectContaining({ kind: "manual", file: "a/Cargo.toml", findingCode: "SDK_BEHIND", reason: expect.stringContaining("cargo update -p soroban-sdk") }),
    ]);
    expect(plan.steps.some((s) => s.kind !== "manual")).toBe(false);
  });

  it("does the same for JS with the matching package manager command", () => {
    const plan = planMigration(facts([], [locked("@stellar/stellar-sdk", "^17.0.0", "w/package.json", "16.5.0", "pnpm-lock.yaml")]), snap());
    expect(plan.steps).toEqual([
      expect.objectContaining({ kind: "manual", reason: expect.stringContaining("pnpm update @stellar/stellar-sdk") }),
    ]);
  });

  it("still bumps the manifest when its own major is behind, and notes the lockfiles involved", () => {
    const plan = planMigration(
      facts([locked("soroban-sdk", "^21", "a/Cargo.toml", "21.7.6", "Cargo.lock")], [locked("@stellar/stellar-sdk", "^12.0.0", "w/package.json", "12.1.0", "yarn.lock")]),
      snap(),
    );
    expect(plan.steps.map((s) => s.kind)).toEqual(["bump-rust-dep", "bump-js-dep"]);
    expect(plan.lockfiles).toEqual(["Cargo.lock", "yarn.lock"]);
    expect(plan.followUp).toEqual(["cargo update -p soroban-sdk", "yarn install"]);
  });

  it("omits lockfiles when no touched dependency has one", () => {
    expect(planMigration(facts([dep("soroban-sdk", "21.0.0", "a/Cargo.toml")]), snap()).lockfiles).toBeUndefined();
  });
});
