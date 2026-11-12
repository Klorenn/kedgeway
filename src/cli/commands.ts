import { Command, CommanderError } from "commander";
import { meetsThreshold, type Diagnosis, type Severity } from "../core/diagnose.js";
import type { RepoFacts } from "../core/repo-facts.js";
import { diagnoseDetailed, migrate, type MigrateOutcome } from "../sdk.js";
import type { EcosystemPort, EcosystemSnapshot } from "../ports/ecosystem.js";

export interface CliIo {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  createRavenPort: () => EcosystemPort;
  login: () => Promise<void>;
  logout: () => Promise<boolean>;
  /** Runs the stdio MCP server until the client disconnects. */
  startMcp: () => Promise<void>;
}

interface DiagnoseOptions {
  json?: boolean;
  fixture?: string;
  failOn?: string;
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
  const threshold = opts.failOn as Severity | undefined;
  try {
    const { facts, snapshot, diagnosis } = await diagnoseDetailed({
      path,
      ...(opts.fixture ? { fixture: opts.fixture } : { ecosystem: io.createRavenPort() }),
    });
    io.stdout(opts.json ? `${JSON.stringify(diagnosis, null, 2)}\n` : formatReport(facts, snapshot, diagnosis));
    if (threshold && meetsThreshold(diagnosis, threshold)) {
      return 2;
    }
    return 0;
  } catch (e) {
    io.stderr(`kedgeway: ${e instanceof Error ? e.message : String(e)}\n`);
    return 1;
  }
}

interface MigrateOptions {
  dryRun?: boolean;
  write?: boolean;
  fixture?: string;
}

export function formatMigration(o: MigrateOutcome, write: boolean): string {
  const { plan, result } = o;
  const lines: string[] = [];
  lines.push(`kedgeway migrate (${write ? "write" : "dry run"}): ${plan.root}`);
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
  const write = opts.write === true;
  try {
    const outcome = await migrate({
      path,
      write,
      ...(opts.fixture ? { fixture: opts.fixture } : { ecosystem: io.createRavenPort() }),
    });
    io.stdout(formatMigration(outcome, write));
    return !write && outcome.plan.steps.length > 0 ? 2 : 0;
  } catch (e) {
    io.stderr(`kedgeway: ${e instanceof Error ? e.message : String(e)}\n`);
    return 1;
  }
}

export async function runCli(argv: string[], io: CliIo): Promise<number> {
  let exitCode = 0;
  const program = new Command();
  program
    .name("kedgeway")
    .description("Diagnose how outdated a Stellar/Soroban toolchain is")
    .exitOverride()
    .configureOutput({ writeOut: (s) => io.stdout(s), writeErr: (s) => io.stderr(s) });

  program
    .command("diagnose [path]")
    .description("Scan a repo and report toolchain staleness")
    .option("--json", "print Diagnosis as JSON")
    .option("--fixture <file>", "use an ecosystem snapshot JSON instead of Raven")
    .option("--fail-on <severity>", "exit 2 if any finding is at or above: critical | warning | info")
    .action(async (path: string | undefined, opts: DiagnoseOptions) => {
      exitCode = await runDiagnose(path ?? ".", opts, io);
    });

  program
    .command("migrate [path]")
    .description("Plan (default, dry run) or apply (--write) SDK version bumps. Experimental.")
    .option("--dry-run", "print the planned edits as a diff without writing (default)")
    .option("--write", "apply the edits to the manifests")
    .option("--fixture <file>", "use an ecosystem snapshot JSON instead of Raven")
    .action(async (path: string | undefined, opts: MigrateOptions) => {
      exitCode = await runMigrate(path ?? ".", opts, io);
    });

  program
    .command("login")
    .description("Authenticate with Stellar Raven (OAuth)")
    .action(async () => {
      try {
        await io.login();
        io.stdout("Logged in to Stellar Raven.\n");
      } catch (e) {
        io.stderr(`kedgeway: ${e instanceof Error ? e.message : String(e)}\n`);
        exitCode = 1;
      }
    });

  program
    .command("mcp")
    .description("Run the kedgeway MCP server over stdio")
    .action(async () => {
      try {
        await io.startMcp();
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
