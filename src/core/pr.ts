import { SEVERITY_RANK, type Finding } from "./diagnose.js";
import { formatGuide, type MigrationGuide } from "./guide.js";
import type { LockfileKind } from "./lockfile.js";
import type { MigrationPlan, MigrationStep } from "./migration.js";
import { RUST_MIN_VERSION } from "./toolchain.js";
import type { EcosystemSnapshot } from "../ports/ecosystem.js";

const TITLE_MAX = 72;
const TOOLCHAIN_TITLE = "chore(toolchain): kedgeway migration";

/** The steps kedgeway can apply by itself (everything but `manual`). */
function edits(plan: MigrationPlan): MigrationStep[] {
  return plan.steps.filter((s) => s.kind !== "manual");
}

export function hasEdits(plan: MigrationPlan): boolean {
  return edits(plan).length > 0;
}

/** The edit that names the PR: the Rust SDK first, then a JS bump, then a legacy replacement. */
function primaryStep(plan: MigrationPlan): MigrationStep | undefined {
  const e = edits(plan);
  return e.find((s) => s.kind === "bump-rust-dep") ?? e.find((s) => s.kind === "bump-js-dep") ?? e[0];
}

/** Major of a target such as `28.0.0`, `^17.2.1` or `npm:@stellar/stellar-sdk@^17.2.1`; digits only. */
function targetMajor(to: string): string | null {
  const m = /^[^0-9]*(\d{1,6})/.exec(to.slice(to.lastIndexOf("@") + 1));
  return m?.[1] ?? null;
}

/** `kedgeway/migrate-<targetMajor>` or `kedgeway/migrate-toolchain`. Safe ref characters only. */
export function branchNameFor(plan: MigrationPlan): string {
  const step = primaryStep(plan);
  const major = step === undefined ? null : targetMajor(step.to);
  return `kedgeway/migrate-${major ?? "toolchain"}`;
}

/** At most 72 characters, one line, e.g. `chore(deps): migrate soroban-sdk to 28`. */
export function prTitleFor(plan: MigrationPlan): string {
  const step = primaryStep(plan);
  const major = step === undefined ? null : targetMajor(step.to);
  if (step === undefined || major === null) return TOOLCHAIN_TITLE;
  const prefix = "chore(deps): migrate ";
  const suffix = ` to ${major}`;
  const name = (step.replacement ?? step.dependency).replace(/[^A-Za-z0-9@/._-]/g, "");
  if (name === "") return TOOLCHAIN_TITLE;
  return `${prefix}${name.slice(0, Math.max(1, TITLE_MAX - prefix.length - suffix.length))}${suffix}`;
}

export interface PrRef {
  number: number;
  state: string;
  /** Head branch name (without `owner:`). */
  headRef: string;
  /** Base branch of the PR, when known. */
  baseRef?: string;
}

export type PrDecision = { action: "skip"; reason: string } | { action: "create" } | { action: "update"; number: number };

/**
 * What to do with the plan: nothing when kedgeway has no automatic edit, update the OPEN PR whose head branch is
 * ours (the lowest number when several match, so there are never two), or create one.
 */
export function decidePr(input: { plan: MigrationPlan; existing: readonly PrRef[]; branch?: string; base?: string }): PrDecision {
  if (!hasEdits(input.plan)) return { action: "skip", reason: "no automatic edits to make (nothing to migrate, or only manual steps)" };
  const branch = input.branch ?? branchNameFor(input.plan);
  const open = input.existing.filter((p) => p.state.toLowerCase() === "open" && p.headRef === branch && (input.base === undefined || p.baseRef === input.base)).sort((a, b) => a.number - b.number);
  const first = open[0];
  return first === undefined ? { action: "create" } : { action: "update", number: first.number };
}

/**
 * kedgeway force-pushes its branch, so it must never be a branch somebody else owns: refuses the base, the default
 * branch and the checked-out branch outright, and anything outside `kedgeway/` unless `allowAny` (CLI only).
 */
export function checkBranchPolicy(i: { branch: string; base: string; defaultBranch: string | null; startBranch: string | null; allowAny?: boolean }): void {
  const same = (a: string | null): boolean => a !== null && a.toLowerCase() === i.branch.toLowerCase(); // case-folding filesystems treat Main and main as one ref
  if (/^(refs|heads)\//i.test(i.branch)) throw new Error(`invalid PR branch ${i.branch}: it must not start with refs/ or heads/`);
  if (same(i.base)) throw new Error(`refusing to use ${i.branch} as the PR branch: it is the base branch, and kedgeway force-pushes its branch`);
  if (same(i.defaultBranch)) throw new Error(`refusing to use ${i.branch} as the PR branch: it is the repository default branch, and kedgeway force-pushes its branch`);
  if (same(i.startBranch)) throw new Error(`refusing to use ${i.branch} as the PR branch: it is the checked-out branch`);
  if (i.allowAny !== true && !i.branch.startsWith("kedgeway/")) {
    throw new Error(`the PR branch must start with kedgeway/ (it is force-pushed, so it must be a branch only kedgeway writes); got ${i.branch}. The CLI flag --allow-any-branch lifts this for other names`);
  }
}

/** The git host that owns the API at `apiBase`: `github.com` for api.github.com, else the API host itself (GHES, tests). */
export function githubHostFor(apiBase: string): string {
  const u = new URL(apiBase);
  return u.hostname === "api.github.com" ? "github.com" : u.host.toLowerCase();
}

/** Scheme and host (with port) of an http(s) remote URL; null for ssh, file and local-path remotes. */
export function httpRemote(url: string): { scheme: "http" | "https"; host: string } | null {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return { scheme: u.protocol === "https:" ? "https" : "http", host: u.host.toLowerCase() };
  } catch {
    return null;
  }
}

/** Throws unless `name` is a conservative git branch name (letters, digits, `._/-`). */
export function validateBranchName(name: string): string {
  const bad =
    name.length === 0 ||
    name.length > 100 ||
    !/^[A-Za-z0-9._/-]+$/.test(name) ||
    /^[-/.]/.test(name) ||
    /[/.]$/.test(name) ||
    name.includes("..") ||
    name.includes("//") ||
    name.includes("/.") ||
    name.endsWith(".lock") ||
    name.includes(".lock/");
  if (bad) throw new Error("Invalid branch name (use letters, digits and ._/- only, e.g. kedgeway/migrate-28)");
  return name;
}

/** Throws unless `slug` is `owner/repo`. */
export function validateRepoSlug(slug: string): { owner: string; repo: string } {
  const m = /^([A-Za-z0-9_][A-Za-z0-9_.-]{0,99})\/([A-Za-z0-9_.-]{1,100})$/.exec(slug);
  if (!m || m[2] === "." || m[2] === ".." || m[1] === "..") throw new Error("Invalid repository: expected owner/repo");
  return { owner: m[1] as string, repo: m[2] as string };
}

/** `owner/repo` from a git remote URL (https, ssh or scp-like); null for local paths and anything else. Credentials are never returned. */
export function repoFromRemoteUrl(url: string): string | null {
  const t = url.trim();
  const m =
    /^[A-Za-z0-9._-]{1,64}@[A-Za-z0-9.-]{1,253}:([^/\s]{1,100})\/([^/\s]{1,100}?)(?:\.git)?\/?$/.exec(t) ??
    /^(?:https?|ssh|git):\/\/[^/\s]{1,300}\/([^/\s]{1,100})\/([^/\s]{1,100}?)(?:\.git)?\/?$/.exec(t);
  if (!m) return null;
  const slug = `${m[1]}/${m[2]}`;
  try {
    validateRepoSlug(slug);
    return slug;
  } catch {
    return null;
  }
}

export interface PrBodyInput {
  plan: MigrationPlan;
  findings: readonly Finding[];
  guide: MigrationGuide;
  snapshot: EcosystemSnapshot;
  /** Repository name shown in the header (never a temp path). */
  display?: string;
  /** Lockfiles that pin dependencies the plan touches. */
  lockfilesTouched: readonly LockfileKind[];
  /** Subset of `lockfilesTouched` that `--refresh-lockfiles` refreshed. */
  lockfilesRefreshed?: readonly LockfileKind[];
  /** Free-text notes (refresh failures, edits that could not be applied). Rendered in code spans. */
  notes?: readonly string[];
  /** kedgeway version for the footer. */
  version: string;
}

const CONTROL = new RegExp("[\\u0000-\\u0008\\u000b-\\u001f\\u007f-\\u009f\\u2028\\u2029]", "g");
const MAX_CELL = 200;
const MAX_REASON = 400;
const MAX_FINDINGS = 50;

function oneLine(s: string, max: number): string {
  const flat = String(s).replace(new RegExp("[\\r\\n\\u2028\\u2029]+", "g"), " ").replace(/\t/g, " ").replace(CONTROL, "");
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function longestRun(s: string, ch: string): number {
  let best = 0;
  let cur = 0;
  for (const c of s) {
    cur = c === ch ? cur + 1 : 0;
    if (cur > best) best = cur;
  }
  return best;
}

/** One line inside a code span whose delimiter is longer than any backtick run inside it. */
function code(s: string, max = MAX_CELL): string {
  const t = oneLine(s, max).trim();
  if (t === "") return "(none)";
  const ticks = "`".repeat(longestRun(t, "`") + 1);
  const pad = t.startsWith("`") || t.endsWith("`") ? " " : "";
  return `${ticks}${pad}${t}${pad}${ticks}`;
}

/** A code span safe inside a table cell: no pipes or backslashes that could end the cell. */
function cell(s: string): string {
  return code(oneLine(s, MAX_CELL).replace(/\\/g, "/").replace(/\|/g, "\\|"));
}

/** A fenced block whose fence is longer than any backtick run inside, with control characters removed. */
function fenced(lines: readonly string[], lang: string): string[] {
  const body = lines.map((l) => String(l).replace(/\r/g, "").replace(CONTROL, ""));
  const fence = "`".repeat(Math.max(3, longestRun(body.join("\n"), "`") + 1));
  return [`${fence}${lang}`, ...body, fence];
}

function stepSummary(s: MigrationStep): string {
  return s.kind === "replace-legacy-package"
    ? `replaces ${code(s.dependency)} ${code(s.from)} with ${code(s.replacement ?? s.dependency)} ${code(s.to)}`
    : `moves ${code(s.dependency)} from ${code(s.from)} to ${code(s.to)}`;
}

function safeVersion(v: string): string {
  return v.replace(/[^0-9A-Za-z.+-]/g, "").slice(0, 40);
}


type FindingStatus = "fixed" | "manual" | "info";

const FIXABLE_CODES = new Set(["SDK_DEPRECATED", "SDK_BEHIND", "JS_SDK_DEPRECATED", "JS_SDK_BEHIND"]);
const INFO_CODES = new Set(["SDK_CURRENT", "JS_SDK_CURRENT", "CLI_CURRENT", "NO_SDK_FOUND"]);
const STATUS_ORDER: Record<FindingStatus, number> = { fixed: 0, manual: 1, info: 2 };

/** `fixed` when an edit of the plan changes the manifest line the finding is about; `info` for notes; else `manual`. */
function statusOf(f: Finding, editSteps: readonly MigrationStep[]): FindingStatus {
  if (f.severity === "info" || INFO_CODES.has(f.code)) return "info";
  if (!FIXABLE_CODES.has(f.code)) return "manual";
  const d = f.dependency;
  const file = d?.file ?? f.file;
  const fixed = editSteps.some((s) => s.file === file && s.findingCode === f.code && (d === undefined || s.dependency === d.name || s.dependency === d.declaredKey));
  return fixed ? "fixed" : "manual";
}

function location(f: Finding): string {
  return f.line === undefined ? f.file : `${f.file}:${f.line}`;
}

/** The checkbox for a manual finding the plan has no step for; every value is a code span. */
function followUpFor(f: Finding, cliVersion: string): string {
  const where = code(location(f));
  switch (f.code) {
    case "CLI_DEPRECATED":
    case "CLI_BEHIND":
    case "CLI_UNKNOWN":
      return cliVersion === ""
        ? `Bump ${code("stellar-cli")} to the current version in ${where}`
        : `Bump ${code("stellar-cli")} to ${code(cliVersion)} in ${where} (${code(`cargo install --locked stellar-cli --version ${cliVersion}`)})`;
    case "RUST_TARGET_LEGACY":
      return `Replace ${code("wasm32-unknown-unknown")} with ${code("wasm32v1-none")} in ${where} and run ${code("rustup target add wasm32v1-none")}`;
    case "RUST_TOOLCHAIN_OLD":
      return `Raise the Rust channel in ${code(f.file)} to ${code(RUST_MIN_VERSION)} or newer`;
    case "JS_LEGACY_PACKAGE":
      return `Replace ${f.dependency === undefined ? "the legacy package" : code(f.dependency.name)} with ${code("@stellar/stellar-sdk")} in ${code(f.dependency?.file ?? f.file)}`;
    case "DATA_DEGRADED":
      return `Re-run kedgeway once the ecosystem data is reachable: ${code(f.message, MAX_REASON)}`;
    default:
      return `${code(f.code)} in ${where}: ${code(f.message, MAX_REASON)}`;
  }
}

/**
 * Markdown for the pull request body. Every string that can come from the scanned repo or from Raven (file names,
 * messages, evidence, snapshot text) sits inside a code span or a code fence, so it can never start a heading,
 * list item, table row, quote or workflow command.
 */
export function renderPrBody(input: PrBodyInput): string {
  const { plan, snapshot } = input;
  const out: string[] = [];
  const editSteps = edits(plan);
  const manuals = plan.steps.filter((s) => s.kind === "manual");

  const classified = input.findings
    .map((f, i) => ({ f, i, status: statusOf(f, editSteps) }))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || SEVERITY_RANK[b.f.severity] - SEVERITY_RANK[a.f.severity] || a.i - b.i);
  const fixedCount = classified.filter((c) => c.status === "fixed").length;

  // Plan manual steps keep their text; a manual finding gets its own checkbox only when no plan step covers it.
  const planManual = manuals.map((m) => `${code(m.file)}${m.dependency ? ` (${code(m.dependency)})` : ""}: ${code(m.reason, MAX_REASON)}`);
  const covered = (f: Finding): boolean => manuals.some((m) => m.findingCode === f.code && m.file === (f.dependency?.file ?? f.file));
  const cliVersion = safeVersion(snapshot.stellarCli.currentVersion ?? "");
  const derived = classified.filter((c) => c.status === "manual" && !covered(c.f)).map((c) => followUpFor(c.f, cliVersion));
  const followUps = [...planManual, ...derived];

  const shown = editSteps.slice(0, 3).map(stepSummary);
  const more = editSteps.length > 3 ? `; and ${editSteps.length - 3} more` : "";
  const base = editSteps.length === 0 ? "kedgeway found nothing it can edit automatically." : `kedgeway ${shown.join("; ")}${more}.`;
  const counts = followUps.length === 0 ? "" : ` It fixes ${fixedCount} finding${fixedCount === 1 ? "" : "s"}; ${followUps.length} need${followUps.length === 1 ? "s" : ""} a manual follow-up.`;
  out.push(`${base}${counts}`);
  if (input.display !== undefined) out.push("", `Repository: ${code(input.display)}`);

  const findings = classified.slice(0, MAX_FINDINGS);
  if (findings.length > 0) {
    out.push("", "## Findings", "", "| Code | Severity | Location | Status |", "| --- | --- | --- | --- |");
    for (const { f, status } of findings) {
      const label = status === "fixed" ? "`fixed by this PR`" : status === "manual" ? "`manual`" : "—";
      out.push(`| ${cell(f.code)} | ${cell(f.severity)} | ${cell(location(f))} | ${label} |`);
    }
    if (classified.length > findings.length) out.push("", `And ${classified.length - findings.length} more finding(s); run \`kedgeway diagnose\` for the full list.`);
  }

  if (editSteps.length > 0) {
    out.push("", "## Edits", "");
    for (const s of editSteps) out.push(`- ${code(s.file)}: ${stepSummary(s)}`);
    out.push("", "Only the version strings change; no source file is rewritten.");
  }

  if (followUps.length > 0) {
    out.push("", "## Manual follow-ups", "");
    for (const l of followUps) out.push(`- [ ] ${l}`);
  }

  if (input.lockfilesTouched.length > 0) {
    const refreshed = new Set(input.lockfilesRefreshed ?? []);
    const pending = input.lockfilesTouched.filter((l) => !refreshed.has(l));
    out.push("", "## Lockfiles", "");
    if (refreshed.size > 0) out.push(`kedgeway refreshed ${[...refreshed].map((l) => code(l)).join(", ")} (\`--refresh-lockfiles\`). Review that diff.`);
    if (pending.length > 0) {
      out.push(`${pending.map((l) => code(l)).join(", ")} pin${pending.length === 1 ? "s" : ""} dependencies this PR changes and ${pending.length === 1 ? "was" : "were"} not updated. Refresh ${pending.length === 1 ? "it" : "them"} before merging${plan.followUp.length > 0 ? `: ${plan.followUp.map((c) => code(c)).join(", ")}` : ""}.`);
    }
  }

  const guide = formatGuide(input.guide).trimEnd();
  if (guide !== "") out.push("", "## Migration guide", "", ...fenced(guide.split("\n"), "text"));

  const notes = input.notes ?? [];
  if (notes.length > 0) {
    out.push("", "## Notes", "");
    for (const n of notes) out.push(`- ${code(n, MAX_REASON)}`);
  }

  out.push(
    "",
    "## Provenance",
    "",
    `Snapshot source: ${code(snapshot.sorobanSdk.source)}`,
    "",
    `Observed at: ${code(snapshot.observedAt)}`,
    "",
    "---",
    `Opened by kedgeway ${safeVersion(input.version)}`,
  );
  return `${out.join("\n")}\n`;
}
