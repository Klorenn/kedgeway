import { diagnose, type Finding } from "./diagnose.js";
import type { LockfileKind } from "./lockfile.js";
import { parseVersion, type RepoFacts } from "./repo-facts.js";
import type { EcosystemSnapshot } from "../ports/ecosystem.js";

export type MigrationKind = "bump-rust-dep" | "bump-js-dep" | "replace-legacy-package" | "manual";

export interface MigrationStep {
  /** Manifest to edit, relative to the plan root (the workspace root for inherited deps). */
  file: string;
  kind: MigrationKind;
  dependency: string;
  /** Current raw version/range. */
  from: string;
  /** New raw version/range (empty for manual steps with no concrete target). */
  to: string;
  /** For `replace-legacy-package`: the package that replaces `dependency`. */
  replacement?: string;
  reason: string;
  findingCode: string;
}

export interface MigrationPlan {
  root: string;
  steps: MigrationStep[];
  /** Commands the user should run afterwards; kedgeway never runs them. */
  followUp: string[];
  /** Lockfiles that pin dependencies this plan touches. The edits never update them. */
  lockfiles?: LockfileKind[];
}

const LEGACY_REPLACEMENT = "@stellar/stellar-sdk";

const PLAIN_VERSION = /^(\^|~|=|>=)?\d+(\.\d+){0,2}(-[0-9A-Za-z.-]+)?$/;

/** Returns the range prefix when `raw` is one plain version (no ranges, wildcards, `||`, `-`), else null. */
function prefixOf(raw: string, allowed: string): string | null {
  const m = PLAIN_VERSION.exec(raw);
  if (!m) return null;
  const p = m[1] ?? "";
  return p === "" || allowed.includes(p) ? p : null;
}

function importHints(name: string): string {
  return (
    `Update imports manually after replacing ${name} with ${LEGACY_REPLACEMENT}. ` +
    `Find them with rg -n -e <pattern> using the patterns: import .* from ['"]${name}['"] and require\\(['"]${name}['"]\\)`
  );
}

function refreshCommand(d: NonNullable<Finding["dependency"]>): string {
  switch (d.resolvedFrom) {
    case "Cargo.lock":
      return `cargo update -p ${d.name}`;
    case "pnpm-lock.yaml":
      return `pnpm update ${d.name}`;
    case "yarn.lock":
      return `yarn upgrade ${d.name}`;
    default:
      return `npm update ${d.name}`;
  }
}

/** The lockfile pins an older version than a manifest that already allows the current major: bumping the manifest would be a no-op. */
function lockHeldBack(d: NonNullable<Finding["dependency"]>, currentMajor: number | null): boolean {
  if (d.resolved === undefined || currentMajor === null) return false;
  const major = parseVersion(d.raw).major;
  return major !== null && major >= currentMajor;
}

function majorOfVersion(v: string | null): number | null {
  const m = v === null ? null : /^(\d+)/.exec(v);
  return m?.[1] === undefined ? null : Number.parseInt(m[1], 10);
}

export function planMigration(facts: RepoFacts, snapshot: EcosystemSnapshot): MigrationPlan {
  const { findings } = diagnose(facts, snapshot);
  const steps: MigrationStep[] = [];
  const seen = new Set<string>();
  const add = (step: MigrationStep): void => {
    const key = [step.file, step.kind, step.dependency, step.from, step.to, step.findingCode].join("\u0000");
    if (seen.has(key)) return;
    seen.add(key);
    steps.push(step);
  };

  const rustTarget =
    snapshot.sorobanSdk.currentVersion ??
    (snapshot.sorobanSdk.currentMajor === null ? null : `${snapshot.sorobanSdk.currentMajor}.0.0`);
  const jsTarget = snapshot.jsSdk.currentVersion;

  const manual = (f: Finding, reason: string): void => {
    const d = f.dependency;
    add({
      file: d?.file ?? f.file,
      kind: "manual",
      dependency: d?.name ?? "",
      from: d?.raw ?? "",
      to: "",
      reason,
      findingCode: f.code,
    });
  };

  for (const f of findings) {
    const d = f.dependency;
    switch (f.code) {
      case "SDK_DEPRECATED":
      case "SDK_BEHIND": {
        if (d && lockHeldBack(d, snapshot.sorobanSdk.currentMajor)) {
          manual(f, `${f.message} The manifest (${d.raw}) already allows the current major but ${d.resolvedFrom ?? "the lockfile"} pins ${d.resolved}. Refresh the lockfile: ${refreshCommand(d)}`);
          break;
        }
        const prefix = d ? prefixOf(d.raw, "=~^") : null;
        if (!d || prefix === null || rustTarget === null) {
          manual(f, `${f.message} The version constraint is not a plain version, so it is left for you to update.`);
          break;
        }
        const to = `${prefix}${rustTarget}`;
        if (to === d.raw) break;
        add({
          file: d.file,
          kind: "bump-rust-dep",
          dependency: d.name,
          from: d.raw,
          to,
          reason: `${f.message} Evidence: ${f.evidence}`,
          findingCode: f.code,
        });
        break;
      }
      case "JS_SDK_DEPRECATED":
      case "JS_SDK_BEHIND": {
        if (!d) break;
        if (d.name !== "@stellar/stellar-sdk") {
          manual(
            f,
            `${f.message} The snapshot has no current ${d.name} version; upgrading @stellar/stellar-sdk pulls a compatible @stellar/stellar-base, otherwise pick the version yourself.`,
          );
          break;
        }
        if (lockHeldBack(d, majorOfVersion(jsTarget))) {
          manual(f, `${f.message} The manifest (${d.raw}) already allows the current major but ${d.resolvedFrom ?? "the lockfile"} pins ${d.resolved}. Refresh the lockfile: ${refreshCommand(d)}`);
          break;
        }
        const prefix = prefixOf(d.raw, "^~");
        if (prefix === null || jsTarget === null) {
          manual(f, `${f.message} The version constraint is not a plain version, so it is left for you to update.`);
          break;
        }
        const aliased = d.declaredKey !== undefined && d.declaredRaw !== undefined;
        add({
          file: d.file,
          kind: "bump-js-dep",
          dependency: d.declaredKey ?? d.name,
          from: d.declaredRaw ?? d.raw,
          to: aliased ? `npm:${d.name}@${prefix}${jsTarget}` : `${prefix}${jsTarget}`,
          reason: `${f.message} Evidence: ${f.evidence}`,
          findingCode: f.code,
        });
        break;
      }
      case "JS_LEGACY_PACKAGE": {
        if (!d) break;
        if (jsTarget === null) {
          manual(f, `${f.message} The current ${LEGACY_REPLACEMENT} version is unavailable, so the replacement is left for you.`);
          break;
        }
        add({
          file: d.file,
          kind: "replace-legacy-package",
          dependency: d.declaredKey ?? d.name,
          from: d.declaredRaw ?? d.raw,
          to: `^${jsTarget}`,
          replacement: LEGACY_REPLACEMENT,
          reason: f.message,
          findingCode: f.code,
        });
        add({
          file: d.file,
          kind: "manual",
          dependency: d.name,
          from: d.name,
          to: LEGACY_REPLACEMENT,
          reason: importHints(d.name),
          findingCode: f.code,
        });
        break;
      }
      case "SDK_UNKNOWN":
      case "JS_SDK_UNKNOWN":
      case "MANIFEST_UNPARSEABLE":
        manual(f, f.message);
        break;
      default:
        break; // *_CURRENT, NO_SDK_FOUND, DATA_DEGRADED: nothing to migrate
    }
  }

  const lockOf = new Map<string, LockfileKind>();
  for (const dd of [...facts.rustDeps, ...facts.jsDeps]) {
    if (dd.resolvedFrom !== null) lockOf.set(`${dd.declaredIn ?? dd.file}\u0000${dd.name}`, dd.resolvedFrom);
  }
  const touched = new Set<LockfileKind>();
  for (const st of steps) {
    const k = lockOf.get(`${st.file}\u0000${st.dependency}`);
    if (k) touched.add(k);
  }
  const lockfiles = [...touched].sort();

  const followUp: string[] = [];
  if (steps.some((s) => s.kind === "bump-rust-dep")) followUp.push("cargo update -p soroban-sdk");
  if (steps.some((s) => s.kind === "bump-js-dep" || s.kind === "replace-legacy-package")) {
    followUp.push(touched.has("pnpm-lock.yaml") ? "pnpm install" : touched.has("yarn.lock") ? "yarn install" : "npm install");
  }
  return { root: facts.root, steps, followUp, ...(lockfiles.length > 0 ? { lockfiles } : {}) };
}
