import { resolve } from "node:path";
import { Command, CommanderError, Option } from "commander";
import { renderWorkflow, workflowPathFor, type WorkflowMode } from "../core/workflow-template.js";
import { openPr, PrUsageError, type OpenPrDeps, type PrOutcome } from "../pr-flow.js";
import type { WorkflowWriteResult } from "../adapters/workflow-writer.js";
import { meetsThreshold, type Diagnosis, type Severity } from "../core/diagnose.js";
import type { RepoFacts } from "../core/repo-facts.js";
import { doctorOk, formatDoctor, type DoctorCheck } from "../core/doctor.js";
import { parseDuration } from "../core/duration.js";
import { CachingEcosystem, SnapshotCache, DEFAULT_MAX_AGE_MS } from "../adapters/snapshot-cache.js";
import { formatGuide } from "../core/guide.js";
import { diagnoseDetailed, diagnoseRemote, migrate, migrateRemote, resolveRepoSource, toAnnotations, toSarif, type DetailedDiagnosis, type MigrateOutcome } from "../sdk.js";
import type { RemoteRepoOptions } from "../adapters/remote-repo.js";
import type { RemoteSource } from "../core/remote-source.js";
import type { EcosystemPort, EcosystemSnapshot } from "../ports/ecosystem.js";

export interface CliIo {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  createRavenPort: () => EcosystemPort;
  /** `preserve` keeps any stored registration/tokens (used by `login --export`). */
  login: (opts?: { preserve?: boolean; noBrowser?: boolean }) => Promise<void>;
  logout: () => Promise<boolean>;
  /** Base64 blob of the stored credentials, or null when none are stored. */
  exportAuth: () => Promise<string | null>;
  /** Runs the self-check (see `kedgeway doctor`). */
  doctor: (opts: { offline: boolean }) => Promise<DoctorCheck[]>;
  writeFile: (path: string, text: string) => Promise<void>;
  /** The kedgeway version (package.json); also pins the action tag in the generated workflow. */
  version: string;
  /** Writes `<root>/<relPath>`; without `force` it must never overwrite an existing file. */
  writeWorkflow: (root: string, relPath: string, text: string, opts: { force: boolean }) => Promise<WorkflowWriteResult>;
  /** Snapshot cache directory (default `$XDG_CACHE_HOME/kedgeway`). Tests pass a temp dir. */
  cacheDir?: string;
  /** Repository root used to make SARIF uris relative (default `process.cwd()`). */
  cwd?: () => string;
  /** Environment for warnings (default `process.env`). */
  env?: NodeJS.ProcessEnv;
  /** Runs the stdio MCP server until the client disconnects. */
  startMcp: (opts: { allowWrite: boolean }) => Promise<void>;
  /** Overrides for cloning remote sources (git exec, fetch, temp root). Tests inject fakes. */
  remote?: Omit<RemoteRepoOptions, "ref">;
  /** Overrides for `kedgeway pr` (GitHub fetch, git/refresh exec). Tests inject fakes. */
  prDeps?: OpenPrDeps;
}

interface CacheFlags {
  offline?: boolean;
  /** Commander sets this to false for `--no-cache`. */
  cache?: boolean;
  maxAge?: string;
}

interface DiagnoseOptions extends CacheFlags {
  ref?: string;
  json?: boolean;
  fixture?: string;
  failOn?: string;
  sarif?: string;
  annotations?: string;
  format?: string;
}

/** The ecosystem source for a run: a fixture, or live Raven behind the snapshot cache. */
function ecosystemFor(opts: CacheFlags & { fixture?: string }, io: CliIo): { fixture: string } | { ecosystem: EcosystemPort } {
  if (opts.fixture) return { fixture: opts.fixture };
  const maxAgeMs = opts.maxAge === undefined ? DEFAULT_MAX_AGE_MS : (parseDuration(opts.maxAge) ?? DEFAULT_MAX_AGE_MS);
  return {
    ecosystem: new CachingEcosystem(io.createRavenPort(), new SnapshotCache(io.cacheDir), {
      offline: opts.offline === true,
      noCache: opts.cache === false,
      maxAgeMs,
    }),
  };
}

/** Validates the cache flags; false means the run must stop with exit 1 (a message was printed). */
function checkMaxAge(opts: CacheFlags & { fixture?: string }, io: CliIo): boolean {
  if (opts.maxAge !== undefined && parseDuration(opts.maxAge) === null) {
    io.stderr(`Invalid --max-age value "${opts.maxAge}" (expected e.g. 30m, 24h or 2d)\n`);
    return false;
  }
  if (opts.offline === true && opts.cache === false) {
    io.stderr("kedgeway: --offline and --no-cache contradict each other (offline reads only the cache)\n");
    return false;
  }
  if (opts.offline === true && opts.fixture) io.stderr("kedgeway: --offline is ignored because --fixture is set\n");
  return true;
}

function withCacheFlags(cmd: Command): Command {
  return cmd
    .option("--offline", "use the cached ecosystem snapshot only; error if there is none")
    .option("--no-cache", "ignore the cached snapshot (a fresh fetch is still written to the cache)")
    .option("--max-age <duration>", "how old a cached snapshot may be before it is refetched (e.g. 30m, 24h, 2d)", "24h");
}

type Target = { kind: "local"; path: string } | { kind: "remote"; source: RemoteSource };

/** A local path (always wins when it exists) or a remote repository; throws with a user-facing message otherwise. */
async function resolveTarget(input: string, ref: string | undefined, io: CliIo): Promise<Target> {
  const source = await resolveRepoSource(input) // relative to process.cwd(), like the local scanner;
  if (source.kind === "local") {
    if (ref !== undefined) throw new Error("--ref only applies to a remote repository (a URL or owner/repo)");
    return { kind: "local", path: input };
  }
  if (ref !== undefined && source.ref !== undefined && source.ref !== ref) {
    throw new Error(`--ref ${ref} conflicts with the ref in the URL (${source.ref})`);
  }
  if (!/[:@]/.test(input)) io.stderr(`kedgeway: treating '${input}' as ${source.display}\n`); // a typo'd local path must be visible
  return { kind: "remote", source };
}

function isSeverity(v: string): v is Severity {
  return v === "critical" || v === "warning" || v === "info";
}

export function formatReport(facts: RepoFacts, snapshot: EcosystemSnapshot, d: Diagnosis): string {
  const lines: string[] = [];
  lines.push(`kedgeway: ${facts.root}`);
  const major = snapshot.sorobanSdk.currentMajor;
  lines.push(
    `Ecosystem: soroban-sdk current major ${major === null ? "unknown" : major}, observed ${snapshot.observedAt}`,
  );
  for (const h of facts.hints ?? []) lines.push(`hint: ${h}`);
  lines.push("");
  for (const f of d.findings) {
    lines.push(`[${f.severity.toUpperCase()}] ${f.code}  ${f.file}`);
    lines.push(`  ${f.message}`);
    lines.push(`  evidence: ${f.evidence}`);
  }
  lines.push("");
  lines.push(`Summary: ${d.summary.critical} critical, ${d.summary.warning} warning, ${d.summary.info} info`);
  return `${lines.join("\n")}\n`;
}

async function runDiagnose(path: string, opts: DiagnoseOptions, io: CliIo): Promise<number> {
  if (opts.failOn !== undefined && !isSeverity(opts.failOn)) {
    io.stderr(`Invalid --fail-on value "${opts.failOn}" (expected critical, warning or info)\n`);
    return 1;
  }
  if (opts.json && opts.format !== undefined) {
    io.stderr("kedgeway: --json and --format cannot be combined (--json is --format json)\n");
    return 1;
  }
  const format = opts.format ?? (opts.json ? "json" : "text");
  if (format !== "text" && format !== "json" && format !== "sarif" && format !== "annotations") {
    io.stderr(`Invalid --format value "${format}" (expected text, json, sarif or annotations)\n`);
    return 1;
  }
  if (!checkMaxAge(opts, io)) return 1;
  const threshold = opts.failOn as Severity | undefined;
  try {
    const target = await resolveTarget(path, opts.ref, io);
    const detailed: DetailedDiagnosis =
      target.kind === "local"
        ? await diagnoseDetailed({ path, ...ecosystemFor(opts, io) })
        : await diagnoseRemote({ source: target.source, ...(opts.ref === undefined ? {} : { ref: opts.ref }), ...io.remote, ...ecosystemFor(opts, io) });
    const { facts, snapshot, diagnosis } = detailed;
    const sarif =
      opts.sarif !== undefined || format === "sarif"
        ? `${JSON.stringify(toSarif(detailed, { cwd: io.cwd?.() ?? process.cwd() }), null, 2)}\n`
        : "";
    if (opts.sarif !== undefined) await io.writeFile(opts.sarif, sarif);
    const cwd = io.cwd?.() ?? process.cwd();
    const annotations = opts.annotations !== undefined || format === "annotations" ? toAnnotations(detailed, { cwd }) : [];
    if (opts.annotations !== undefined) await io.writeFile(opts.annotations, annotations.length > 0 ? `${annotations.join("\n")}\n` : "");
    const annotationText = format === "annotations" && annotations.length > 0 ? `${annotations.join("\n")}\n` : "";
    io.stdout(
      format === "sarif"
        ? sarif
        : format === "json"
          ? `${JSON.stringify(diagnosis, null, 2)}\n`
          : `${annotationText}${formatReport(facts, snapshot, diagnosis)}`,
    );
    if (threshold && meetsThreshold(diagnosis, threshold)) {
      return 2;
    }
    return 0;
  } catch (e) {
    io.stderr(`kedgeway: ${e instanceof Error ? e.message : String(e)}\n`);
    return 1;
  }
}

interface MigrateOptions extends CacheFlags {
  ref?: string;
  dryRun?: boolean;
  write?: boolean;
  fixture?: string;
}

export function formatMigration(o: MigrateOutcome, write: boolean): string {
  const { plan, result } = o;
  const lines: string[] = [];
  lines.push(`kedgeway migrate (${write ? "write" : "dry run"}): ${plan.root}`);
  const guideText = formatGuide(o.guide).trimEnd();
  if (guideText) lines.push("", guideText);
  if (plan.steps.length === 0) {
    lines.push("", "Nothing to migrate.");
    return `${lines.join("\n")}\n`;
  }
  if (result.diff) lines.push("", result.diff.trimEnd());
  if (result.written) {
    lines.push("", `Updated ${result.changes.length} file(s): ${result.changes.map((c) => c.file).join(", ")}`);
  }
  if (result.skipped.length > 0) {
    lines.push("", "Could not apply (do these by hand):");
    for (const s of result.skipped) lines.push(`  - ${s.step.file}: ${s.reason}`);
  }
  if (result.manual.length > 0) {
    lines.push("", "Manual steps:");
    for (const m of result.manual) lines.push(`  - ${m.file}${m.dependency ? ` (${m.dependency})` : ""}: ${m.reason}`);
  }
  if (result.followUp.length > 0 && (result.changes.length > 0 || result.written)) {
    lines.push("", "Next, run:");
    for (const c of result.followUp) lines.push(`  ${c}`);
  }
  if (plan.lockfiles && plan.lockfiles.length > 0) {
    lines.push("", `Lockfile(s) present (${plan.lockfiles.join(", ")}): these edits change manifests only; refresh the lockfile(s) with the commands above or the manual steps, then re-run kedgeway diagnose.`);
  }
  const edits = plan.steps.filter((s) => s.kind !== "manual").length;
  lines.push(
    "",
    `Plan: ${edits} edit(s), ${result.manual.length} manual step(s).${write ? "" : " Re-run with --write to apply."}`,
  );
  return `${lines.join("\n")}\n`;
}

async function runMigrate(path: string, opts: MigrateOptions, io: CliIo): Promise<number> {
  if (opts.dryRun && opts.write) {
    io.stderr("kedgeway: --dry-run and --write are mutually exclusive\n");
    return 1;
  }
  if (!checkMaxAge(opts, io)) return 1;
  const write = opts.write === true;
  try {
    const target = await resolveTarget(path, opts.ref, io);
    if (target.kind === "remote" && write) {
      io.stderr("kedgeway: remote sources are dry-run only; clone it and run migrate locally\n");
      return 2;
    }
    const outcome =
      target.kind === "local"
        ? await migrate({ path, write, ...ecosystemFor(opts, io) })
        : await migrateRemote({ source: target.source, ...(opts.ref === undefined ? {} : { ref: opts.ref }), ...io.remote, ...ecosystemFor(opts, io) });
    io.stdout(formatMigration(outcome, write));
    if (write) return outcome.result.skipped.length > 0 ? 2 : 0;
    return outcome.plan.steps.some((s) => s.kind !== "manual") ? 2 : 0;
  } catch (e) {
    io.stderr(`kedgeway: ${e instanceof Error ? e.message : String(e)}\n`);
    return 1;
  }
}

interface PrOptions extends CacheFlags {
  fixture?: string;
  base?: string;
  branch?: string;
  repo?: string;
  token?: string;
  dryRun?: boolean;
  refreshLockfiles?: boolean;
  label?: string;
  draft?: boolean;
  allowAnyBranch?: boolean;
  json?: boolean;
  apiBase?: string;
}

export function formatPr(o: PrOutcome): string {
  if (o.action === "skip") return `kedgeway pr: skipped: ${o.reason ?? "nothing to do"}\n`;
  if (o.action === "dry-run") {
    return `kedgeway pr (dry run): nothing was written or sent\nBranch: ${o.branch}\nTitle:  ${o.title}\n\n${o.body ?? ""}`;
  }
  const verb = o.action === "create" ? "created" : "updated";
  return `kedgeway pr: ${verb} pull request #${o.number ?? "?"} on branch ${o.branch}\n${o.url ?? ""}\n`;
}

async function runPr(path: string, opts: PrOptions, io: CliIo): Promise<number> {
  if (!checkMaxAge(opts, io)) return 2;
  const env = io.env ?? process.env;
  const secret = opts.token ?? env["GITHUB_TOKEN"] ?? "";
  const scrub = (text: string): string => (secret === "" ? text : text.split(secret).join("***"));
  try {
    const target = await resolveTarget(path, undefined, io).catch((e: unknown) => {
      throw new PrUsageError(e instanceof Error ? e.message : String(e));
    });
    if (target.kind === "remote") throw new PrUsageError("pr needs a local checkout: clone the repository and run kedgeway pr inside it");
    const outcome = await openPr({
      path,
      ...ecosystemFor(opts, io),
      version: io.version,
      env,
      dryRun: opts.dryRun === true,
      ...(opts.base === undefined ? {} : { base: opts.base }),
      ...(opts.branch === undefined ? {} : { branch: opts.branch }),
      ...(opts.repo === undefined ? {} : { repo: opts.repo }),
      ...(opts.token === undefined ? {} : { token: opts.token }),
      ...(opts.refreshLockfiles === true ? { refreshLockfiles: true } : {}),
      ...(opts.label === undefined ? {} : { label: opts.label }),
      ...(opts.draft === true ? { draft: true } : {}),
      ...(opts.allowAnyBranch === true ? { allowAnyBranch: true } : {}),
      ...(opts.apiBase === undefined ? {} : { apiBase: opts.apiBase }),
      ...(io.prDeps === undefined ? {} : { deps: io.prDeps }),
    });
    for (const w of outcome.warnings) io.stderr(`kedgeway: warning: ${scrub(w)}\n`);
    if (opts.json) {
      const j = outcome.action === "dry-run" ? { action: outcome.action, branch: outcome.branch, title: outcome.title, body: outcome.body } : outcome.action === "skip" ? { action: outcome.action, branch: outcome.branch, title: outcome.title, reason: outcome.reason } : { action: outcome.action, url: outcome.url, branch: outcome.branch, title: outcome.title };
      io.stdout(`${JSON.stringify(j, null, 2)}\n`);
    } else {
      io.stdout(formatPr(outcome));
    }
    return 0;
  } catch (e) {
    io.stderr(`kedgeway: ${scrub(e instanceof Error ? e.message : String(e))}\n`);
    return e instanceof PrUsageError ? 2 : 1;
  }
}

export async function runCli(argv: string[], io: CliIo): Promise<number> {
  let exitCode = 0;
  const program = new Command();
  program
    .name("kedgeway")
    .description("Diagnose how outdated a Stellar/Soroban toolchain is")
    .version(io.version, "-V, --version", "print the kedgeway version")
    .exitOverride()
    .configureOutput({ writeOut: (s) => io.stdout(s), writeErr: (s) => io.stderr(s) });

  withCacheFlags(program.command("diagnose [path-or-url]"))
    .description("Scan a repo (a local path, a git URL or owner/repo) and report toolchain staleness")
    .option("--ref <ref>", "branch or tag to scan when the source is a remote repository")
    .option("--json", "print Diagnosis as JSON (same as --format json)")
    .option("--format <format>", "stdout format: text | json | sarif | annotations (GitHub annotations, then the text report)")
    .option("--annotations <file>", "also write GitHub Actions annotations to <file>")
    .option("--sarif <file>", "also write a SARIF 2.1.0 report to <file>")
    .option("--fixture <file>", "use an ecosystem snapshot JSON instead of Raven")
    .option("--fail-on <severity>", "exit 2 if any finding is at or above: critical | warning | info")
    .action(async (path: string | undefined, opts: DiagnoseOptions) => {
      exitCode = await runDiagnose(path ?? ".", opts, io);
    });

  withCacheFlags(program.command("migrate [path-or-url]"))
    .description("Print a migration guide and plan SDK version bumps (dry run). --write applies the manifest edits (local paths only).")
    .option("--ref <ref>", "branch or tag to scan when the source is a remote repository (dry run only)")
    .option("--dry-run", "print the planned edits as a diff without writing (default)")
    .option("--write", "apply the edits to the manifests")
    .option("--fixture <file>", "use an ecosystem snapshot JSON instead of Raven")
    .action(async (path: string | undefined, opts: MigrateOptions) => {
      exitCode = await runMigrate(path ?? ".", opts, io);
    });

  withCacheFlags(program.command("pr [path]"))
    .description("Open (or update) a pull request with the migration edits. Run it inside the repository; it pushes the branch kedgeway/migrate-<major>. Exit 0 ok or skipped, 1 git/API failure, 2 usage.")
    .option("--base <branch>", "branch the PR targets (default: the repository default branch from the API, else the current branch)")
    .option("--branch <name>", "head branch to force-push (default kedgeway/migrate-<major>; must start with kedgeway/ unless --allow-any-branch; never the base, default or checked-out branch)")
    .option("--allow-any-branch", "allow a --branch outside kedgeway/ (it is force-pushed, so it must be a branch only kedgeway writes)")
    .option("--repo <owner/repo>", "GitHub repository (default GITHUB_REPOSITORY, else the origin remote)")
    .option("--token <token>", "GitHub token (default GITHUB_TOKEN; prefer the environment variable, argv is visible to other users)")
    .option("--dry-run", "print the title and body; no git or network writes")
    .option("--refresh-lockfiles", "refresh the lockfiles the plan touched (cargo/npm/pnpm/yarn, only when installed)")
    .option("--label <name>", "label to apply to the PR", "kedgeway")
    .option("--draft", "open the PR as a draft")
    .option("--json", "print { action, url?, branch, title } as JSON")
    .option("--fixture <file>", "use an ecosystem snapshot JSON instead of Raven")
    .addOption(new Option("--api-base <url>", "GitHub API base URL (tests, GitHub Enterprise)").hideHelp())
    .action(async (path: string | undefined, opts: PrOptions) => {
      exitCode = await runPr(path ?? ".", opts, io);
    });

  program
    .command("init [path]")
    .description("Write .github/workflows/kedgeway.yml (the kedgeway GitHub Action) into a repo; --mode pr writes kedgeway-pr.yml (the weekly migration PR bot). Exits 1 if the file exists, unless --force.")
    .option("--force", "overwrite an existing workflow file")
    .option("--print", "print the workflow YAML to stdout instead of writing a file")
    .addOption(new Option("--mode <mode>", "which workflow to write: diagnose (default) or pr").choices(["diagnose", "pr"]).default("diagnose"))
    .action(async (path: string | undefined, opts: { force?: boolean; print?: boolean; mode?: WorkflowMode }) => {
      try {
        const mode: WorkflowMode = opts.mode === "pr" ? "pr" : "diagnose";
        const yaml = renderWorkflow({ version: io.version, mode });
        if (opts.print) {
          io.stdout(yaml);
          return;
        }
        const root = resolve((io.cwd ?? process.cwd)(), path ?? ".");
        const r = await io.writeWorkflow(root, workflowPathFor(mode), yaml, { force: opts.force === true });
        if (r.status === "exists") {
          io.stderr(`kedgeway: ${r.path} already exists; use --force to overwrite it.\n`);
          exitCode = 1;
          return;
        }
        io.stdout(
          `Wrote ${r.path}\nNext: add your Raven credentials as a repository secret named KEDGEWAY_AUTH (from \`kedgeway login --export\`).\n` +
            (mode === "pr"
              ? "Then allow the bot to open pull requests: Settings > Actions > General > Workflow permissions > \"Allow GitHub Actions to create and approve pull requests\" (organizations must allow it first).\n"
              : ""),
        );
      } catch (e) {
        io.stderr(`kedgeway: ${e instanceof Error ? e.message : String(e)}\n`);
        exitCode = 1;
      }
    });

  program
    .command("login")
    .description("Authenticate with Stellar Raven (OAuth)")
    .option("--no-browser", "do not open a browser: print the URL and accept the redirect URL or code pasted on stdin")
    .option("--export", "print the stored credentials as a base64 blob for CI (KEDGEWAY_AUTH); logs in first if needed")
    .action(async (opts: { export?: boolean; browser?: boolean }) => {
      const noBrowser = opts.browser === false;
      try {
        if (opts.export) {
          if ((io.env ?? process.env)["KEDGEWAY_AUTH"]?.trim()) {
            io.stderr("kedgeway: KEDGEWAY_AUTH is set in this environment; it is ignored here. Exporting the credentials stored by `kedgeway login`.\n");
          }
          let blob = await io.exportAuth();
          if (blob === null) {
            await io.login({ preserve: true, ...(noBrowser ? { noBrowser: true } : {}) });
            blob = await io.exportAuth();
          }
          if (blob === null) throw new Error("No credentials were stored after login; nothing to export.");
          io.stderr("kedgeway: the blob on stdout is a SECRET (it contains Raven tokens). Store it as a CI secret; never commit or log it.\n");
          io.stdout(`${blob}\n`);
          return;
        }
        await io.login(noBrowser ? { noBrowser: true } : undefined);
        io.stdout("Logged in to Stellar Raven.\n");
      } catch (e) {
        io.stderr(`kedgeway: ${e instanceof Error ? e.message : String(e)}\n`);
        exitCode = 1;
      }
    });

  program
    .command("doctor")
    .description("Self-check: Node version, auth state, snapshot cache and Raven reachability. Exits 1 if a check fails.")
    .option("--offline", "skip the Raven reachability call")
    .action(async (opts: { offline?: boolean }) => {
      try {
        const checks = await io.doctor({ offline: opts.offline === true });
        io.stdout(formatDoctor(checks));
        exitCode = doctorOk(checks) ? 0 : 1;
      } catch (e) {
        io.stderr(`kedgeway: ${e instanceof Error ? e.message : String(e)}\n`);
        exitCode = 1;
      }
    });

  program
    .command("mcp")
    .description("Run the kedgeway MCP server over stdio")
    .option("--allow-write", "let the migrate tool edit files (off by default)")
    .action(async (opts: { allowWrite?: boolean }) => {
      try {
        await io.startMcp({ allowWrite: opts.allowWrite === true });
      } catch (e) {
        io.stderr(`kedgeway: ${e instanceof Error ? e.message : String(e)}\n`);
        exitCode = 1;
      }
    });

  program
    .command("logout")
    .description("Delete stored Raven credentials")
    .action(async () => {
      const removed = await io.logout();
      io.stdout(removed ? "Logged out (stored credentials deleted).\n" : "Logged out (no stored credentials).\n");
    });

  try {
    await program.parseAsync(argv);
  } catch (e) {
    if (e instanceof CommanderError) return e.exitCode === 0 ? 0 : 1;
    io.stderr(`kedgeway: ${e instanceof Error ? e.message : String(e)}\n`);
    return 1;
  }
  return exitCode;
}
