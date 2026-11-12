export {
  diagnose,
  diagnoseDetailed,
  diagnoseRepo,
  scanRepo,
  createRavenEcosystem,
  toSarif,
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
export { buildSarif, type SarifLog, type SarifOptions } from "./core/sarif.js";
export { CachingEcosystem, SnapshotCache, defaultCacheDir, type CachingOptions } from "./adapters/snapshot-cache.js";
export type { LockfileKind } from "./core/lockfile.js";
export type { Diagnosis, Finding, Severity } from "./core/diagnose.js";
export type { DetectedDep, ManifestError, RepoFacts } from "./core/repo-facts.js";
export type { EcosystemPort, EcosystemSnapshot } from "./ports/ecosystem.js";
export type { MigrationPlan, MigrationStep, MigrationKind } from "./core/migration.js";
export type { MigrationResult, FileChange } from "./adapters/migration-apply.js";
