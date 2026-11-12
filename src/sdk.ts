import { diagnose as diagnoseRepo, type Diagnosis } from "./core/diagnose.js";
import type { RepoFacts } from "./core/repo-facts.js";
import { scanRepo } from "./adapters/fs-repo-scanner.js";
import { loadFixture } from "./adapters/fake-ecosystem.js";
import { AuthStore, defaultAuthStore } from "./adapters/raven-auth.js";
import { RavenEcosystem, openRavenSession } from "./adapters/raven-ecosystem.js";
import { createRequire } from "node:module";
import { realpathSync } from "node:fs";
import { posix, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { buildSarif, type SarifLog } from "./core/sarif.js";
import { planMigration, type MigrationPlan } from "./core/migration.js";
import { applyMigration, type MigrationResult } from "./adapters/migration-apply.js";
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

export interface MigrateOutcome extends DetailedDiagnosis {
  plan: MigrationPlan;
  result: MigrationResult;
}

export async function migrate(opts: MigrateOptions): Promise<MigrateOutcome> {
  const detailed = await diagnoseDetailed(opts);
  const plan = planMigration(detailed.facts, detailed.snapshot);
  const result = await applyMigration(plan, { write: opts.write === true });
  return { ...detailed, plan, result };
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
 * Builds the SARIF log for a diagnosis. The repository root is assumed to be `cwd`; manifest uris are
 * relative to it (both paths are realpath'd first). If the scan root lies outside `cwd`, uris are absolute
 * `file://` URIs without a `uriBaseId`.
 */
export function toSarif(detailed: Pick<DetailedDiagnosis, "facts" | "diagnosis">, opts: { cwd?: string } = {}): SarifLog {
  const cwd = real(opts.cwd ?? process.cwd());
  const root = real(detailed.facts.root);
  const rel = relative(cwd, root);
  if (rel.startsWith("..") || posix.isAbsolute(rel) || /^[A-Za-z]:/.test(rel)) {
    const href = pathToFileURL(root).href;
    return buildSarif(detailed.diagnosis, { version: packageVersion, absoluteRootUri: href.endsWith("/") ? href : `${href}/` });
  }
  return buildSarif(detailed.diagnosis, { version: packageVersion, uriPrefix: rel.split(sep).join("/") });
}

export { diagnoseRepo, scanRepo, planMigration, applyMigration };
