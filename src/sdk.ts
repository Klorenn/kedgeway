import { diagnose as diagnoseRepo, type Diagnosis } from "./core/diagnose.js";
import type { RepoFacts } from "./core/repo-facts.js";
import { scanRepo } from "./adapters/fs-repo-scanner.js";
import { loadFixture } from "./adapters/fake-ecosystem.js";
import { AuthStore, defaultAuthStore } from "./adapters/raven-auth.js";
import { RavenEcosystem, openRavenSession } from "./adapters/raven-ecosystem.js";
import { createRequire } from "node:module";
import { realpathSync } from "node:fs";
import { stat } from "node:fs/promises";
import { isAbsolute, posix, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { formatAnnotations } from "./core/annotations.js";
import { buildSarif, type SarifLog } from "./core/sarif.js";
import { planMigration, type MigrationPlan } from "./core/migration.js";
import { buildGuide, type MigrationGuide } from "./core/guide.js";
import { applyMigration, type MigrationResult } from "./adapters/migration-apply.js";
import { scanImportHits } from "./adapters/source-scan.js";
import type { EcosystemPort, EcosystemSnapshot } from "./ports/ecosystem.js";
import { parseRepoSource, validateRef, type RemoteSource, type RepoSource } from "./core/remote-source.js";
import { withRemoteRepo, type RemoteRepoOptions } from "./adapters/remote-repo.js";

export interface DiagnoseOptions {
  path: string;
  /** Ecosystem source. Defaults to live Raven. Ignored when `fixture` is set. */
  ecosystem?: EcosystemPort;
  /** Path to an ecosystem snapshot JSON; takes precedence over `ecosystem`. */
  fixture?: string;
}

export interface DetailedDiagnosis {
  /** Set for remote sources: the name shown instead of the (deleted) temp dir, e.g. `github.com/o/r@main`. */
  display?: string;
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
export function toSarif(detailed: Pick<DetailedDiagnosis, "facts" | "diagnosis" | "display">, opts: { cwd?: string } = {}): SarifLog {
  const prefix = detailed.display === undefined ? repoPrefix(detailed.facts.root, opts.cwd) : ""; // remote: files are already repo-relative
  if (prefix === null) {
    const href = pathToFileURL(real(detailed.facts.root)).href;
    return buildSarif(detailed.diagnosis, { version: packageVersion, absoluteRootUri: href.endsWith("/") ? href : `${href}/` });
  }
  return buildSarif(detailed.diagnosis, { version: packageVersion, uriPrefix: prefix });
}

/** GitHub Actions annotation lines for a diagnosis (paths relative to `cwd`, the repository root). */
export function toAnnotations(detailed: Pick<DetailedDiagnosis, "facts" | "diagnosis" | "display">, opts: { cwd?: string } = {}): string[] {
  const prefix = detailed.display === undefined ? repoPrefix(detailed.facts.root, opts.cwd) : "";
  return formatAnnotations(detailed.diagnosis, prefix === null ? { omitFiles: true } : { pathPrefix: prefix });
}

export interface RemoteDiagnoseOptions extends RemoteRepoOptions {
  /** A repository URL or `owner/repo` shorthand (see `parseRepoSource`). */
  source: string | RemoteSource;
  /** Ecosystem source. Defaults to live Raven. Ignored when `fixture` is set. */
  ecosystem?: EcosystemPort;
  fixture?: string;
  /** Accept `http://` sources (default true; the MCP server sets false). */
  allowHttp?: boolean;
}

/** Resolves a user argument: an existing local path always wins over the `owner/repo` shorthand. */
export async function resolveRepoSource(input: string, opts: { cwd?: string; allowHttp?: boolean } = {}): Promise<RepoSource> {
  try {
    await stat(resolve(opts.cwd ?? process.cwd(), input));
    return { kind: "local" };
  } catch {
    return parseRepoSource(input, { ...(opts.allowHttp === undefined ? {} : { allowHttp: opts.allowHttp }) });
  }
}

function toRemote(source: string | RemoteSource, allowHttp?: boolean): RemoteSource {
  const parsed = typeof source === "string" ? parseRepoSource(source, allowHttp === undefined ? {} : { allowHttp }) : source;
  if (parsed.kind !== "remote") throw new Error("not a remote repository source (expected a URL or owner/repo)");
  return parsed;
}

/** Replaces `from` by `to` in every string of `value` (the temp dir must never reach output). */
function scrub<T>(value: T, from: string, to: string): T {
  if (typeof value === "string") return value.split(from).join(to) as T;
  if (Array.isArray(value)) return value.map((v) => scrub(v, from, to)) as T;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, scrub(v, from, to)])) as T;
  }
  return value;
}

function hideRoot<T extends DetailedDiagnosis>(d: T, dir: string, display: string): T {
  const out = scrub(d, dir, display);
  const findings = out.diagnosis.findings.map((f) => (f.file === display ? { ...f, file: "." } : f));
  return { ...out, display, diagnosis: { ...out.diagnosis, findings } };
}

/** Shallow-clones a remote repository, diagnoses it and removes the clone. `facts.root` is the display name. */
export async function diagnoseRemote(opts: RemoteDiagnoseOptions): Promise<DetailedDiagnosis> {
  const source = toRemote(opts.source, opts.allowHttp);
  const { source: _s, ecosystem, fixture, allowHttp: _h, ...remote } = opts;
  return withRemoteRepo(source, remote, async (dir) => {
    const detailed = await diagnoseDetailed({ path: dir, ...(ecosystem ? { ecosystem } : {}), ...(fixture ? { fixture } : {}) });
    const display = source.ref === undefined && opts.ref !== undefined ? `${source.display}@${validateRef(opts.ref)}` : source.display;
    return hideRoot(detailed, resolve(dir), display);
  });
}

/** Dry-run migration plan for a remote repository. Never writes (the clone is deleted anyway). */
export async function migrateRemote(opts: RemoteDiagnoseOptions): Promise<MigrateOutcome> {
  const source = toRemote(opts.source, opts.allowHttp);
  const { source: _s, ecosystem, fixture, allowHttp: _h, ...remote } = opts;
  return withRemoteRepo(source, remote, async (dir) => {
    const outcome = await migrate({ path: dir, write: false, ...(ecosystem ? { ecosystem } : {}), ...(fixture ? { fixture } : {}) });
    const display = source.ref === undefined && opts.ref !== undefined ? `${source.display}@${validateRef(opts.ref)}` : source.display;
    return hideRoot(outcome, resolve(dir), display);
  });
}

export { diagnoseRepo, scanRepo, planMigration, applyMigration, parseRepoSource };
export type { RemoteSource, RepoSource };
export type { CliPin, CliPinSource, RustTargetDecl, RustTargetName, RustToolchainPin, ToolchainFacts } from "./core/toolchain.js";
