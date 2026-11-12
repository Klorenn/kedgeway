import { describe, expect, it } from "vitest";
import { buildGuide, formatGuide, migrationDocs } from "./guide.js";
import { planMigration } from "./migration.js";
import type { DetectedDep, RepoFacts } from "./repo-facts.js";
import type { EcosystemSnapshot } from "../ports/ecosystem.js";

const snap = (over: Partial<EcosystemSnapshot> = {}): EcosystemSnapshot => ({
  observedAt: "2026-11-11T00:00:00.000Z",
  sorobanSdk: { currentMajor: 28, currentVersion: "28.0.0", deprecatedVersions: [], source: "docs" },
  jsSdk: { currentVersion: "17.2.1", source: "docs" },
  protocolCurrent: 29,
  degraded: [],
  notes: [],
  ...over,
});

const dep = (name: string, raw: string, file: string): DetectedDep => {
  const m = /(\d+)/.exec(raw);
  return {
    name,
    raw,
    version: m ? raw : null,
    major: m ? Number(m[1]) : null,
    resolved: null,
    resolvedFrom: null,
    file,
  };
};

const facts = (rustDeps: DetectedDep[], jsDeps: DetectedDep[] = []): RepoFacts => ({
  root: "/r",
  rustDeps,
  jsDeps,
  manifestErrors: [],
});

describe("buildGuide", () => {
  it("states where the repo is, what Stellar publishes, and that only the version string changes", () => {
    const s = snap();
    const plan = planMigration(facts([dep("soroban-sdk", "21.0.0", "a/Cargo.toml")]), s);
    const text = formatGuide(buildGuide(plan, s, []));
    expect(text).toContain("soroban-sdk 21.0.0");
    expect(text).toContain("a/Cargo.toml");
    expect(text).toContain("28.0.0");
    expect(text).toContain("protocol 29");
    expect(text).toContain("2026-11-11T00:00:00.000Z");
    expect(text).toContain("kedgeway edits");
    expect(text).toContain("version string");
    expect(text).toContain("cargo update -p soroban-sdk");
    expect(text).toMatch(/does not read/i);
    expect(text).toMatch(/does not rewrite/i);
  });

  it("says the snapshot has no protocol number when protocolCurrent is null", () => {
    const s = snap({ protocolCurrent: null });
    const plan = planMigration(facts([dep("soroban-sdk", "21.0.0", "a/Cargo.toml")]), s);
    expect(formatGuide(buildGuide(plan, s, []))).toMatch(/no protocol number/i);
  });

  it("is empty when there is nothing to migrate", () => {
    const s = snap();
    const plan = planMigration(facts([dep("soroban-sdk", "28.1.0", "Cargo.toml")]), s);
    expect(formatGuide(buildGuide(plan, s, []))).toBe("");
  });

  it("points at source lines that import a legacy package", () => {
    const s = snap();
    const plan = planMigration(facts([], [dep("soroban-client", "1.0.0", "package.json")]), s);
    const text = formatGuide(
      buildGuide(plan, s, [{ file: "src/app.ts", line: 4, name: "soroban-client" }]),
    );
    expect(text).toContain("src/app.ts:4");
    expect(text).toContain("soroban-client");
  });

  it("says so when the snapshot has no migration document", () => {
    const s = snap({
      notes: [{ title: "Audits", url: "https://developers.stellar.org/docs/networks/audits/soroban-sdk", snippet: "Audits of soroban-sdk" }],
    });
    const plan = planMigration(facts([dep("soroban-sdk", "21.0.0", "Cargo.toml")]), s);
    expect(formatGuide(buildGuide(plan, s, []))).toMatch(/no upgrade guide/i);
  });
});

describe("migrationDocs", () => {
  it("keeps a page whose url is a migration guide, and drops a how-to that only mentions one", () => {
    const docs = migrationDocs([
      {
        title: "XDR migration",
        url: "https://stellar.github.io/js-stellar-sdk/migration/xdr-migration/",
        snippet: "Changes in the XDR layer",
      },
      {
        title: "Signing Soroban contract invocations",
        url: "https://developers.stellar.org/docs/build/guides/transactions/signing-soroban-invocations",
        snippet: "For the v17 XDR changes, see the XDR migration guide",
      },
      {
        title: "Soroban Settings",
        url: "https://developers.stellar.org/docs/validators/admin-guide/soroban-settings",
        snippet: "schedule the upgrade",
      },
      {
        title: "Soroban Rust SDK",
        url: "https://developers.stellar.org/docs/networks/audits/soroban-sdk",
        snippet: "Audits of soroban-sdk",
      },
    ]);
    expect(docs.map((d) => d.title)).toEqual(["XDR migration"]);
  });
});
