import { diagnose as diagnoseRepo, type Diagnosis } from "./core/diagnose.js";
import type { RepoFacts } from "./core/repo-facts.js";
import { scanRepo } from "./adapters/fs-repo-scanner.js";
import { loadFixture } from "./adapters/fake-ecosystem.js";
import { AuthStore } from "./adapters/raven-auth.js";
import { RavenEcosystem, openRavenSession } from "./adapters/raven-ecosystem.js";
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
}

export function createRavenEcosystem(opts: RavenOptions = {}): EcosystemPort {
  return new RavenEcosystem(() => openRavenSession(new AuthStore(opts.authPath)));
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

export { diagnoseRepo, scanRepo };
