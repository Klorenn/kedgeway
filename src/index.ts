export {
  diagnose,
  diagnoseDetailed,
  diagnoseRepo,
  scanRepo,
  createRavenEcosystem,
  toSarif,
  toAnnotations,
  migrate,
  diagnoseRemote,
  migrateRemote,
  parseRepoSource,
  resolveRepoSource,
  planMigration,
  applyMigration,
  type MigrateOptions,
  type RemoteDiagnoseOptions,
  type RemoteSource,
  type RepoSource,
  type MigrateOutcome,
  type DiagnoseOptions,
  type DetailedDiagnosis,
  type RavenOptions,
  type CliPin,
  type CliPinSource,
  type RustTargetDecl,
  type RustTargetName,
  type RustToolchainPin,
  type ToolchainFacts,
} from "./sdk.js";
export { FakeEcosystem, loadFixture } from "./adapters/fake-ecosystem.js";
export { formatAnnotations } from "./core/annotations.js";
export { buildSarif, type SarifLog, type SarifOptions } from "./core/sarif.js";
export { CachingEcosystem, SnapshotCache, defaultCacheDir, type CachingOptions } from "./adapters/snapshot-cache.js";
export type { LockfileKind } from "./core/lockfile.js";
export type { Diagnosis, Finding, Severity } from "./core/diagnose.js";
export type { DetectedDep, ManifestError, RepoFacts } from "./core/repo-facts.js";
export type { EcosystemPort, EcosystemSnapshot } from "./ports/ecosystem.js";
export type { MigrationPlan, MigrationStep, MigrationKind } from "./core/migration.js";
export { buildGuide, formatGuide, migrationDocs, type MigrationGuide, type GuideDoc } from "./core/guide.js";
export { findImportHits, type SourceHit } from "./core/source-hits.js";
export type { MigrationResult, FileChange } from "./adapters/migration-apply.js";
export type { RemoteExec, RemoteFetch, RemoteRepoOptions } from "./adapters/remote-repo.js";
