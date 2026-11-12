export {
  diagnose,
  diagnoseDetailed,
  diagnoseRepo,
  scanRepo,
  createRavenEcosystem,
  type DiagnoseOptions,
  type DetailedDiagnosis,
  type RavenOptions,
} from "./sdk.js";
export { FakeEcosystem, loadFixture } from "./adapters/fake-ecosystem.js";
export type { Diagnosis, Finding, Severity } from "./core/diagnose.js";
export type { DetectedDep, ManifestError, RepoFacts } from "./core/repo-facts.js";
export type { EcosystemPort, EcosystemSnapshot } from "./ports/ecosystem.js";
