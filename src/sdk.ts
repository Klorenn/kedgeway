import { diagnose as diagnoseRepo, type Diagnosis } from "./core/diagnose.js";
import type { RepoFacts } from "./core/repo-facts.js";
import { scanRepo } from "./adapters/fs-repo-scanner.js";
import { loadFixture } from "./adapters/fake-ecosystem.js";
import { AuthStore, defaultAuthStore } from "./adapters/raven-auth.js";
import { RavenEcosystem, openRavenSession } from "./adapters/raven-ecosystem.js";
import { createRequire } from "node:module";
import { realpathSync } from "node:fs";
import { isAbsolute, posix, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { formatAnnotations } from "./core/annotations.js";
import { buildSarif, type SarifLog } from "./core/sarif.js";
import { planMigration, type MigrationPlan } from "./core/migration.js";
import { buildGuide, type MigrationGuide } from "./core/guide.js";
import { applyMigration, type MigrationResult } from "./adapters/migration-apply.js";
import { scanImportHits } from "./adapters/source-scan.js";
import type { EcosystemPort, EcosystemSnapshot } from "./ports/ecosystem.js";

export interface DiagnoseOptions {
  path: string;
  /** Ecosystem source. Defaults to live Raven. Ignored when `fixture` is set. */
  ecosystem?: EcosystemPort;
  /** Path to an ecosystem snapshot JSON; takes precedence over `ecosystem`. */
  fixture?: string;
}

export interface DetailedDiagnosis {
  facts: RepoFacts;
  snapshot: EcosystemSnapshot;
  diagnosis: Diagnosis;
}

export interface RavenOptions {
  /** Override the auth file location (default `~/.config/kedgeway/auth.json`). */
  authPath?: string;
  /** When false, never start an OAuth flow: fail fast telling the user to run `kedgeway login`. Default true. */
  interactive?: boolean;
}

export function createRavenEcosystem(opts: RavenOptions = {}): EcosystemPort {
  return new RavenEcosystem(() =>
    openRavenSession(opts.authPath === undefined ? defaultAuthStore() : new AuthStore(opts.authPath), undefined, undefined, { interactive: opts.interactive !== false }),
  );
}

export async function resolveEcosystem(opts: Pick<DiagnoseOptions, "ecosystem" | "fixture">): Promise<EcosystemPort> {
  if (opts.fixture) return loadFixture(opts.fixture);
  return opts.ecosystem ?? createRavenEcosystem();
}

export async function diagnoseDetailed(opts: DiagnoseOptions): Promise<DetailedDiagnosis> {
  const facts = await scanRepo(opts.path);
  const port = await resolveEcosystem(opts);
  const snapshot = await port.fetchSnapshot();
  return { facts, snapshot, diagnosis: diagnoseRepo(facts, snapshot) };
}

export async function diagnose(opts: DiagnoseOptions): Promise<Diagnosis> {
  return (await diagnoseDetailed(opts)).diagnosis;
}

export interface MigrateOptions extends DiagnoseOptions {
  /** Apply the edits. Default false (dry run). */
  write?: boolean;
}

const LEGACY_PACKAGES = new Set(["soroban-client", "stellar-sdk"]);

export interface MigrateOutcome extends DetailedDiagnosis {
  plan: MigrationPlan;
  result: MigrationResult;
  guide: MigrationGuide;
}

export async function migrate(opts: MigrateOptions): Promise<MigrateOutcome> {
  const detailed = await diagnoseDetailed(opts);
  const plan = planMigration(detailed.facts, detailed.snapshot);
  const names = [...new Set(plan.steps.map((s) => s.dependency).filter((n) => LEGACY_PACKAGES.has(n)))];
  const imports = names.length === 0 ? { hits: [], truncated: false } : await scanImportHits(detailed.facts.root, names);
  const guide = buildGuide(plan, detailed.snapshot, imports.hits, { importsTruncated: imports.truncated });
  const result = await applyMigration(plan, { write: opts.write === true });
  return { ...detailed, plan, result, guide };
}

const packageVersion = (createRequire(import.meta.url)("../package.json") as { version: string }).version;

const real = (p: string): string => {
  try {
    return realpathSync(p);
  } catch {
    return resolve(p);
  }
};

/**
 * The scan root relative to the repository root (assumed to be `cwd`, both realpath'd), as a posix path
 * ("" when equal); null when the scan root lies outside it.
 */
export function repoPrefix(root: string, cwd: string = process.cwd()): string | null {
  const rel = relative(real(cwd), real(root));
  const escapes = rel === ".." || rel.startsWith(`..${sep}`) || rel.startsWith("../");
  if (escapes || posix.isAbsolute(rel) || isAbsolute(rel) || /^[A-Za-z]:/.test(rel)) return null;
  return rel.split(sep).join("/");
}

/**
 * Builds the SARIF log for a diagnosis. Manifest uris are relative to the repository root (`cwd`); if the
 * scan root lies outside it, uris are absolute `file://` URIs without a `uriBaseId`.
 */
export function toSarif(detailed: Pick<DetailedDiagnosis, "facts" | "diagnosis">, opts: { cwd?: string } = {}): SarifLog {
  const prefix = repoPrefix(detailed.facts.root, opts.cwd);
  if (prefix === null) {
    const href = pathToFileURL(real(detailed.facts.root)).href;
    return buildSarif(detailed.diagnosis, { version: packageVersion, absoluteRootUri: href.endsWith("/") ? href : `${href}/` });
  }
  return buildSarif(detailed.diagnosis, { version: packageVersion, uriPrefix: prefix });
}

/** GitHub Actions annotation lines for a diagnosis (paths relative to `cwd`, the repository root). */
export function toAnnotations(detailed: Pick<DetailedDiagnosis, "facts" | "diagnosis">, opts: { cwd?: string } = {}): string[] {
  const prefix = repoPrefix(detailed.facts.root, opts.cwd);
  return formatAnnotations(detailed.diagnosis, prefix === null ? { omitFiles: true } : { pathPrefix: prefix });
}

export { diagnoseRepo, scanRepo, planMigration, applyMigration };
export type { CliPin, CliPinSource, RustTargetDecl, RustTargetName, RustToolchainPin, ToolchainFacts } from "./core/toolchain.js";
