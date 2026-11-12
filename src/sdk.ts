import { diagnose as diagnoseRepo, type Diagnosis } from "./core/diagnose.js";
import type { RepoFacts } from "./core/repo-facts.js";
import { scanRepo } from "./adapters/fs-repo-scanner.js";
import { loadFixture } from "./adapters/fake-ecosystem.js";
import { AuthStore } from "./adapters/raven-auth.js";
import { RavenEcosystem, openRavenSession } from "./adapters/raven-ecosystem.js";
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
    openRavenSession(new AuthStore(opts.authPath), undefined, undefined, { interactive: opts.interactive !== false }),
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

export { diagnoseRepo, scanRepo, planMigration, applyMigration };
