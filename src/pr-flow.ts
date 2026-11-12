import { createRequire } from "node:module";
import { basename } from "node:path";
import { createGithubClient, GithubError, type GhFetch, type GithubClient } from "./adapters/github.js";
import { createGitOps, type GitExec, type GitOps } from "./adapters/git-ops.js";
import { refreshLockfiles, type RefreshExec } from "./adapters/lockfile-refresh.js";
import { applyMigration } from "./adapters/migration-apply.js";
import type { Finding } from "./core/diagnose.js";
import type { LockfileKind } from "./core/lockfile.js";
import type { MigrationPlan } from "./core/migration.js";
import { branchNameFor, checkBranchPolicy, decidePr, githubHostFor, hasEdits, httpRemote, prTitleFor, renderPrBody, repoFromRemoteUrl, validateBranchName, validateRepoSlug } from "./core/pr.js";
import type { EcosystemPort, EcosystemSnapshot } from "./ports/ecosystem.js";
import { migrate, resolveEcosystem, type MigrateOutcome } from "./sdk.js";

const packageVersion = (createRequire(import.meta.url)("../package.json") as { version: string }).version;

/** A usage or precondition error (the CLI exits 2): bad flag value, dirty tree, missing token or repository. */
export class PrUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrUsageError";
  }
}

export interface PlanPrOptions {
  path: string;
  /** Ecosystem source. Defaults to live Raven. Ignored when `fixture` is set. */
  ecosystem?: EcosystemPort;
  fixture?: string;
  /** Head branch override (default `branchNameFor(plan)`). */
  branch?: string;
  /** kedgeway version for the PR footer (default: this package's version). */
  version?: string;
  /** Repository name shown in the PR body. */
  display?: string;
}

export interface PrPlan {
  branch: string;
  title: string;
  /** PR body without lockfile-refresh results. */
  body: string;
  plan: MigrationPlan;
  hasEdits: boolean;
  lockfilesTouched: LockfileKind[];
  findings: Finding[];
  outcome: MigrateOutcome;
}

function relevantFindings(outcome: MigrateOutcome): Finding[] {
  const codes = new Set(outcome.plan.steps.map((s) => s.findingCode));
  return outcome.diagnosis.findings.filter((f) => f.severity !== "info" || codes.has(f.code));
}

async function planWith(opts: PlanPrOptions, port: EcosystemPort): Promise<PrPlan> {
  const outcome = await migrate({ path: opts.path, write: false, ecosystem: port });
  const branch = opts.branch === undefined ? branchNameFor(outcome.plan) : validateBranchName(opts.branch);
  const findings = relevantFindings(outcome);
  const lockfilesTouched = outcome.plan.lockfiles ?? [];
  const body = renderPrBody({
    plan: outcome.plan,
    findings,
    guide: outcome.guide,
    snapshot: outcome.snapshot,
    ...(opts.display === undefined ? {} : { display: opts.display }),
    lockfilesTouched,
    version: opts.version ?? packageVersion,
  });
  return { branch, title: prTitleFor(outcome.plan), body, plan: outcome.plan, hasEdits: hasEdits(outcome.plan), lockfilesTouched, findings, outcome };
}

async function memoPort(opts: PlanPrOptions): Promise<{ port: EcosystemPort; snapshot: EcosystemSnapshot }> {
  const snapshot = await (await resolveEcosystem({ ...(opts.ecosystem ? { ecosystem: opts.ecosystem } : {}), ...(opts.fixture ? { fixture: opts.fixture } : {}) })).fetchSnapshot();
  return { snapshot, port: { fetchSnapshot: () => Promise.resolve(snapshot) } };
}

/** Plans the migration and renders the PR title, body and branch. Reads only; no git, no network beyond the ecosystem source. */
export async function planPr(opts: PlanPrOptions): Promise<PrPlan> {
  return planWith(opts, (await memoPort(opts)).port);
}

export interface OpenPrDeps {
  fetch?: GhFetch;
  gitExec?: GitExec;
  refreshExec?: RefreshExec;
  sleep?: (ms: number) => Promise<void>;
  /** Fully injected clients (tests). */
  github?: GithubClient;
  git?: GitOps;
}

export interface OpenPrOptions extends PlanPrOptions {
  /** Base branch (default: the repository's default branch from the API, else the current branch). */
  base?: string;
  /** `owner/repo` (default `GITHUB_REPOSITORY`, else parsed from the `origin` remote). */
  repo?: string;
  /** GitHub token (default `GITHUB_TOKEN`). Never printed. */
  token?: string;
  /** Print only: no git or network writes (and no network at all). */
  dryRun?: boolean;
  refreshLockfiles?: boolean;
  /** PR label (default `kedgeway`). */
  label?: string;
  draft?: boolean;
  /**
   * Allow a head branch outside `kedgeway/`. CLI only (`--allow-any-branch`); never exposed through MCP or the action.
   * The base, the default branch and the checked-out branch stay refused regardless.
   */
  allowAnyBranch?: boolean;
  /** Override the GitHub API base (default `GITHUB_API_URL`, else https://api.github.com). */
  apiBase?: string;
  /** Git remote to push to (default `origin`). */
  remote?: string;
  env?: NodeJS.ProcessEnv;
  deps?: OpenPrDeps;
}

export interface PrOutcome {
  action: "create" | "update" | "skip" | "dry-run";
  branch: string;
  title: string;
  body?: string;
  url?: string;
  number?: number;
  base?: string;
  /** Why a run was skipped. */
  reason?: string;
  /** Non-fatal problems (label failure, default-branch fallback). */
  warnings: string[];
}

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

function validated<T>(f: () => T): T {
  try {
    return f();
  } catch (e) {
    throw new PrUsageError(msg(e));
  }
}

/**
 * Turns the migration plan into a pull request: plan on a clean tree, decide, branch from the base, apply the edits,
 * optionally refresh lockfiles, commit, force-push our branch and create or update the PR. Never opens a second PR
 * for the same branch. With `dryRun` nothing is written and the network is not touched.
 */
export async function openPr(opts: OpenPrOptions): Promise<PrOutcome> {
  const env = opts.env ?? process.env;
  const warnings: string[] = [];
  const branchOverride = opts.branch === undefined ? undefined : validated(() => validateBranchName(opts.branch as string));
  const base = opts.base === undefined ? undefined : validated(() => validateBranchName(opts.base as string));
  const allowAny = opts.allowAnyBranch === true;
  if (branchOverride !== undefined) validated(() => checkBranchPolicy({ branch: branchOverride, base: "\u0000", defaultBranch: null, startBranch: null, allowAny }));
  const label = opts.label ?? "kedgeway";
  if (!/^[^\r\n,]{1,50}$/.test(label)) throw new PrUsageError("Invalid --label (1 to 50 characters, no commas or newlines)");
  const remote = opts.remote ?? "origin";
  const git = opts.deps?.git ?? createGitOps({ cwd: opts.path, env, ...(opts.deps?.gitExec ? { exec: opts.deps.gitExec } : {}) });
  const dry = opts.dryRun === true;
  const knownRepo = opts.repo ?? env["GITHUB_REPOSITORY"];
  if (opts.repo !== undefined) validated(() => validateRepoSlug(opts.repo as string));

  if (!dry && !(await git.isClean())) {
    throw new PrUsageError("the working tree has uncommitted changes; commit or stash them first (or use --dry-run)");
  }

  const planOpts: PlanPrOptions = { ...opts, ...(branchOverride === undefined ? {} : { branch: branchOverride }), ...(knownRepo === undefined ? {} : { display: knownRepo }) };
  const { port } = await memoPort(opts);
  const planned = await planWith(planOpts, port);
  const first = decidePr({ plan: planned.plan, existing: [], branch: planned.branch });
  // An explicit base other than the checked-out branch is planned again after checkout, so the checked-out tree cannot veto it.
  const otherBase = !dry && base !== undefined && base !== (await git.currentBranch());
  if (first.action === "skip" && !otherBase) return { action: "skip", branch: planned.branch, title: planned.title, reason: first.reason, warnings };
  if (dry) return { action: "dry-run", branch: planned.branch, title: planned.title, body: planned.body, warnings };

  const token = opts.token ?? env["GITHUB_TOKEN"];
  if (token === undefined || token.trim() === "") throw new PrUsageError("a GitHub token is required: pass --token or set GITHUB_TOKEN");
  const slug = knownRepo ?? repoFromRemoteUrl(await git.remoteUrl(remote).catch(() => ""));
  if (slug === null || slug === undefined) throw new PrUsageError("cannot tell which repository to open the PR in: pass --repo owner/repo (or set GITHUB_REPOSITORY)");
  validated(() => validateRepoSlug(slug));
  const apiBase = opts.apiBase ?? env["GITHUB_API_URL"] ?? "https://api.github.com";
  const gh =
    opts.deps?.github ??
    validated(() =>
      createGithubClient({
        token,
        repo: slug,
        apiBase,
        ...(opts.deps?.fetch ? { fetch: opts.deps.fetch } : {}),
        ...(opts.deps?.sleep ? { sleep: opts.deps.sleep } : {}),
      }),
    );
  const allowedHost = validated(() => githubHostFor(apiBase));
  const pushTarget = httpRemote(await git.pushUrl(remote));
  if (pushTarget !== null && pushTarget.host !== allowedHost) {
    throw new PrUsageError(`the ${remote} push URL points at ${pushTarget.host}, not the GitHub host ${allowedHost}; the token is only ever sent to the GitHub host. Fix the remote or the API base`);
  }

  const startBranch = await git.currentBranch();
  const startSha = await git.headSha();
  let baseBranch = base;
  let defaultBranch: string | null = null;
  if (baseBranch === undefined) {
    try {
      baseBranch = await gh.getDefaultBranch();
      defaultBranch = baseBranch;
    } catch (e) {
      if (startBranch === null) throw new PrUsageError("cannot determine the base branch (detached HEAD and the default branch could not be read); pass --base");
      baseBranch = startBranch;
      warnings.push(`could not read the default branch (${msg(e)}); using the current branch ${startBranch} as the base`);
    }
  } else {
    defaultBranch = await gh.getDefaultBranch().catch(() => null);
  }
  const baseName: string = baseBranch;
  validated(() => validateBranchName(baseName));
  if (allowAny && defaultBranch === null) {
    throw new PrUsageError("--allow-any-branch needs the repository default branch to protect it, but it could not be read from the API; fix the token or network, or drop the flag");
  }
  const policy = (branch: string): void => validated(() => checkBranchPolicy({ branch, base: baseName, defaultBranch, startBranch, allowAny }));
  policy(planned.branch);

  let current = planned;

  let result: PrOutcome | undefined;
  let failure: unknown;
  try {
    if (!(await git.fetchBranch(remote, baseName, { token, allowedHost }))) warnings.push(`could not fetch ${remote}/${baseName}; branching from the last known ${remote}/${baseName}`);
    await git.checkoutNewBranch(planned.branch, baseName, remote);
    if ((await git.headSha()) !== startSha) {
      current = await planWith(planOpts, port); // the tree is no longer the one that was planned (other base, or local commits that were never pushed): plan again
      const again = decidePr({ plan: current.plan, existing: [], branch: current.branch });
      if (again.action === "skip") return await finish({ action: "skip", branch: current.branch, title: current.title, reason: again.reason, base: baseName, warnings });
      if (current.branch !== planned.branch) {
        policy(current.branch);
        await git.checkoutNewBranch(current.branch, baseName, remote); // the branch name follows the target major
      }
    }
    const existing = await gh.findOpenPr(current.branch, baseName);
    const decision = decidePr({
      plan: current.plan,
      existing: existing === null ? [] : [{ number: existing.number, state: existing.state, headRef: existing.headRef, baseRef: existing.baseRef }],
      branch: current.branch,
      base: baseName,
    });
    if (decision.action === "skip") return await finish({ action: "skip", branch: current.branch, title: current.title, reason: decision.reason, base: baseName, warnings });

    const applied = await applyMigration(current.plan, { write: true });
    const notes: string[] = applied.skipped.map((s) => `Could not apply ${s.step.file} (${s.step.dependency}): ${s.reason}`);
    if (applied.changes.length === 0) {
      return await finish({ action: "skip", branch: current.branch, title: current.title, reason: `no edit could be applied${notes.length > 0 ? ` (${notes[0]})` : ""}`, base: baseName, warnings });
    }
    const stage = applied.changes.map((c) => c.file);
    let refreshed: readonly LockfileKind[] = [];
    if (opts.refreshLockfiles === true && current.lockfilesTouched.length > 0) {
      const r = await refreshLockfiles(current.plan.root, current.lockfilesTouched, { env, ...(opts.deps?.refreshExec ? { exec: opts.deps.refreshExec } : {}) });
      refreshed = r.refreshed;
      notes.push(...r.notes);
      const names = new Set<string>(r.refreshed);
      stage.push(...(await git.changedFiles()).filter((f) => names.has(basename(f.replace(/^:\(top\)/, "")))));
    }
    const body = renderPrBody({
      plan: current.plan,
      findings: current.findings,
      guide: current.outcome.guide,
      snapshot: current.outcome.snapshot,
      ...(knownRepo === undefined ? {} : { display: knownRepo }),
      lockfilesTouched: current.lockfilesTouched,
      lockfilesRefreshed: refreshed,
      notes,
      version: opts.version ?? packageVersion,
    });
    await git.commitAll(current.title, stage); // only what kedgeway changed, never `git add -A`
    await git.pushBranch(remote, current.branch, { force: true, token, allowedHost });
    let action: "create" | "update" = decision.action;
    let pr;
    if (decision.action === "update") {
      pr = await gh.updatePr(decision.number, { title: current.title, body });
    } else {
      try {
        pr = await gh.createPr({ title: current.title, body, head: current.branch, base: baseName, ...(opts.draft === true ? { draft: true } : {}) });
      } catch (e) {
        // A run that raced us opened the PR between our lookup and the create: treat it as an update.
        const raced = e instanceof GithubError && e.status === 422 && /already exists/i.test(e.message) ? await gh.findOpenPr(current.branch, baseName) : null;
        if (raced === null) throw e;
        pr = await gh.updatePr(raced.number, { title: current.title, body });
        action = "update";
      }
    }
    try {
      await gh.addLabels(pr.number, [label]);
    } catch (e) {
      warnings.push(`the pull request was opened but could not be labeled "${label}": ${msg(e)}`);
    }
    result = { action, branch: current.branch, title: current.title, body, url: pr.url, number: pr.number, base: baseName, warnings };
  } catch (e) {
    failure = e;
  }
  return finish(result, failure);

  /** Puts the checkout back (discarding anything we changed) and reports a restore failure instead of swallowing it. */
  async function finish(r?: PrOutcome, err?: unknown): Promise<PrOutcome> {
    try {
      await git.checkout(startBranch ?? startSha, { force: true });
    } catch (re) {
      const note = `could not restore ${startBranch ?? startSha}: ${msg(re)}`;
      if (err instanceof Error) err.message = `${err.message} (additionally, ${note})`;
      else warnings.push(note);
    }
    if (err !== undefined) throw err;
    return r as PrOutcome;
  }
}
