import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { indexLockfile, type LockfileKind } from "./lockfile.js";
import { JS_PACKAGES, RUST_PACKAGES } from "./repo-facts.js";

// Real lockfiles from public repositories (see fixtures/lockfiles/SOURCES.md for repo + commit).
const dir = resolve(import.meta.dirname, "../../fixtures/lockfiles");
const load = (file: string, kind: LockfileKind) =>
  indexLockfile(kind, readFileSync(resolve(dir, file), "utf8"), kind === "Cargo.lock" ? RUST_PACKAGES : JS_PACKAGES);

const SDK = "@stellar/stellar-sdk";
const q = (name: string, raw: string, importer = ".") => ({ name, raw, importer });

describe("real lockfile corpus", () => {
  it("Cargo.lock (version = 4, stellar/soroban-examples): soroban-sdk 28.0.0", () => {
    const idx = load("cargo-v4.Cargo.lock", "Cargo.lock");
    expect(idx.resolve(q("soroban-sdk", "28.0.0"))).toEqual({ version: "28.0.0" });
    expect(idx.resolve(q("soroban-sdk", "^28"))).toEqual({ version: "28.0.0" });
    expect(idx.resolve(q("soroban-sdk", "^21"))).toEqual({ note: expect.stringContaining("ambiguous in Cargo.lock") });
  });

  it("package-lock.json (lockfileVersion 3, syronlabs/stellar-mcp): @stellar/stellar-sdk 13.1.0", () => {
    expect(load("package-lock-v3.json", "package-lock.json").resolve(q(SDK, "^13.1.0"))).toEqual({ version: "13.1.0" });
  });

  it("pnpm-lock.yaml v9 (Kaizenode/SafeSwap): importer entry for ^16.1.0 is 16.2.0", () => {
    const idx = load("pnpm-v9-safeswap.yaml", "pnpm-lock.yaml");
    expect(idx.resolve(q(SDK, "^16.1.0"))).toEqual({ version: "16.2.0" });
  });

  it("pnpm-lock.yaml v9 (Creit-Tech/Stellar-Wallets-Kit): peer-dependency suffix is stripped", () => {
    const idx = load("pnpm-v9-walletskit.yaml", "pnpm-lock.yaml");
    expect(idx.resolve(q(SDK, "17.0.0", "."))).toEqual({ version: "17.0.0" });
  });

  it("pnpm-lock.yaml v9: unknown importer falls back to the satisfying packages/snapshots entry", () => {
    const idx = load("pnpm-v9-safeswap.yaml", "pnpm-lock.yaml");
    expect(idx.resolve(q(SDK, "^16.1.0", "packages/elsewhere"))).toEqual({ version: "16.2.0" });
  });

  it("yarn.lock classic (paltalabs/soroban-react): descriptor @stellar/stellar-sdk@12.2.0", () => {
    expect(load("yarn-classic-soroban-react.lock", "yarn.lock").resolve(q(SDK, "12.2.0"))).toEqual({ version: "12.2.0" });
  });

  it("yarn.lock classic (stellar-disbursement-platform-frontend): descriptor ^14.6.1", () => {
    const idx = load("yarn-classic-disbursement.lock", "yarn.lock");
    expect(idx.resolve(q(SDK, "^14.6.1"))).toEqual({ version: "14.6.1" });
    expect(idx.resolve(q(SDK, "^99.0.0"))).toBeNull();
  });

  it("yarn.lock berry (stellar/freighter): npm: descriptors, multi-descriptor blocks and aliases", () => {
    const idx = load("yarn-berry-freighter.lock", "yarn.lock");
    expect(idx.resolve(q(SDK, "17.4.0"))).toEqual({ version: "17.4.0" });
    expect(idx.resolve(q("stellar-sdk", "npm:@stellar/stellar-sdk@17.4.0"))).toEqual({ version: "17.4.0" });
    expect(idx.resolve(q("@stellar/stellar-base", "^11.0.1"))).toEqual({ version: "11.0.1" });
    expect(idx.resolve(q("@stellar/stellar-base", "13.1.0"))).toEqual({ version: "13.1.0" });
  });
});
