export {
  diagnose,
  diagnoseDetailed,
  diagnoseRepo,
  scanRepo,
  createRavenEcosystem,
  migrate,
  planMigration,
  applyMigration,
  type MigrateOptions,
  type MigrateOutcome,
  type DiagnoseOptions,
  type DetailedDiagnosis,
  type RavenOptions,
} from "./sdk.js";
export { FakeEcosystem, loadFixture } from "./adapters/fake-ecosystem.js";
export type { Diagnosis, Finding, Severity } from "./core/diagnose.js";
export type { DetectedDep, ManifestError, RepoFacts } from "./core/repo-facts.js";
export type { EcosystemPort, EcosystemSnapshot } from "./ports/ecosystem.js";
export type { MigrationPlan, MigrationStep, MigrationKind } from "./core/migration.js";
export type { MigrationResult, FileChange } from "./adapters/migration-apply.js";
