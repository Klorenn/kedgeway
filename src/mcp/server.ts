import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createRequire } from "node:module";
import { z } from "zod";
import { meetsThreshold, type Diagnosis, type Severity } from "../core/diagnose.js";
import { FINDINGS_REFERENCE } from "../core/findings-reference.js";
import type { EcosystemPort } from "../ports/ecosystem.js";
import { formatGuide } from "../core/guide.js";
import { diagnoseDetailed, diagnoseRemote, migrate, migrateRemote, resolveEcosystem, toSarif } from "../sdk.js";
import type { RemoteRepoOptions } from "../adapters/remote-repo.js";
import { openPr, type OpenPrDeps } from "../pr-flow.js";

export interface KedgewayServerOptions {
  /** Ecosystem used when a tool call has no fixture. Defaults to live Raven. */
  ecosystem?: EcosystemPort;
  /** Allow `migrate` with write=true to edit files. Off by default (`kedgeway mcp --allow-write`). */
  allowWrite?: boolean;
  /** Overrides for cloning remote sources (git exec, fetch, temp root). Tests inject fakes. */
  remote?: Omit<RemoteRepoOptions, "ref">;
  /** Environment the `pr` tool reads `GITHUB_TOKEN` / `GITHUB_REPOSITORY` from (default `process.env`). */
  env?: NodeJS.ProcessEnv;
  /** Overrides for the `pr` tool (GitHub fetch, git/refresh exec). Tests inject fakes. */
  pr?: OpenPrDeps;
}

const version = (createRequire(import.meta.url)("../../package.json") as { version: string }).version;

const SeveritySchema = z.enum(["critical", "warning", "info"]);

function text(...parts: string[]): { content: { type: "text"; text: string }[] } {
  return { content: parts.map((t) => ({ type: "text" as const, text: t })) };
}

function failure(e: unknown): { isError: true; content: { type: "text"; text: string }[] } {
  return { isError: true, ...text(`kedgeway: ${e instanceof Error ? e.message : String(e)}`) };
}

/** Exactly one of `path` / `url` must be given. */
function checkTarget(path: string | undefined, url: string | undefined): void {
  if ((path === undefined) === (url === undefined)) throw new Error("give either path or url (exactly one)");
}

function summarize(d: Diagnosis, failOn: Severity | undefined): string {
  const base = `${d.summary.critical} critical, ${d.summary.warning} warning, ${d.summary.info} info`;
  if (!failOn) return base;
  const met = meetsThreshold(d, failOn);
  return `${base}. fail-on ${failOn}: ${met ? "met (a finding is at or above the threshold)" : "not met"}`;
}

export function createKedgewayServer(opts: KedgewayServerOptions = {}): McpServer {
  const server = new McpServer({ name: "kedgeway", version });
  const ecosystemFor = (fixture: string | undefined) =>
    fixture ? { fixture } : opts.ecosystem ? { ecosystem: opts.ecosystem } : {};

  server.registerTool(
    "diagnose",
    {
      description:
        "Scan a Stellar/Soroban repo for outdated soroban-sdk and JS SDK dependencies, grounded on live ecosystem data. Returns a text summary and the Diagnosis JSON.",
      inputSchema: {
        path: z.string().optional().describe("Directory of the repository to scan (give this or url)"),
        url: z.string().optional().describe("Remote repository to scan: https/ssh git URL or owner/repo (shallow-cloned to a temp dir, then deleted). Give this or path"),
        ref: z.string().optional().describe("Branch or tag to scan (url only)"),
        fixture: z.string().optional().describe("Path to an ecosystem snapshot JSON (offline mode)"),
        failOn: SeveritySchema.optional().describe("Report whether any finding is at or above this severity"),
        format: z.enum(["json", "sarif"]).optional().describe('Second text part: the Diagnosis JSON (default) or a SARIF 2.1.0 log'),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ path, url, ref, fixture, failOn, format }) => {
      try {
        checkTarget(path, url);
        const detailed =
          url !== undefined
            ? await diagnoseRemote({ source: url, ...(ref === undefined ? {} : { ref }), ...opts.remote, allowHttp: false, ...ecosystemFor(fixture) })
            : await diagnoseDetailed({ path: path as string, ...ecosystemFor(fixture) });
        const body = format === "sarif" ? toSarif(detailed) : detailed.diagnosis;
        return text(summarize(detailed.diagnosis, failOn), JSON.stringify(body, null, 2));
      } catch (e) {
        return failure(e);
      }
    },
  );

  server.registerTool(
    "findings_reference",
    {
      description: "List every finding code kedgeway can emit, with its severity, meaning and migration behaviour.",
      annotations: { readOnlyHint: true },
    },
    () => text(JSON.stringify(FINDINGS_REFERENCE, null, 2)),
  );

  server.registerTool(
    "ecosystem_snapshot",
    {
      description: "Return the ecosystem snapshot (current SDK versions, protocol, deprecated sample), live via Raven unless a fixture is given.",
      inputSchema: { fixture: z.string().optional().describe("Path to an ecosystem snapshot JSON (offline mode)") },
      annotations: { readOnlyHint: true },
    },
    async ({ fixture }) => {
      try {
        const port = await resolveEcosystem(ecosystemFor(fixture));
        return text(JSON.stringify(await port.fetchSnapshot(), null, 2));
      } catch (e) {
        return failure(e);
      }
    },
  );

  server.registerTool(
    "migrate",
    {
      description:
        "Print a migration guide and plan SDK version bumps for a Stellar/Soroban repo. Dry run by default: returns a summary (including the guide), the plan JSON and a unified diff. With write=true (only if the server runs with --allow-write) it edits the manifests, refusing if they have uncommitted git changes. Never runs cargo or npm, and never rewrites source.",
      inputSchema: {
        path: z.string().optional().describe("Directory of the repository (give this or url)"),
        url: z.string().optional().describe("Remote repository (https/ssh git URL or owner/repo): dry run only, never written. Give this or path"),
        ref: z.string().optional().describe("Branch or tag (url only)"),
        fixture: z.string().optional().describe("Path to an ecosystem snapshot JSON (offline mode)"),
        write: z.boolean().optional().default(false).describe("Apply the edits (default false: dry run). Requires the server to be started with --allow-write."),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async ({ path, url, ref, fixture, write }) => {
      try {
        checkTarget(path, url);
      } catch (e) {
        return failure(e);
      }
      if (url !== undefined && write) {
        return failure(new Error("remote sources are dry-run only (write is never applied to a url); clone it and run migrate locally."));
      }
      if (write && opts.allowWrite !== true) {
        return failure(new Error("write is disabled. Restart the server with `kedgeway mcp --allow-write` to let migrate edit files (dry run still works)."));
      }
      try {
        const { plan, result, guide } =
          url !== undefined
            ? await migrateRemote({ source: url, ...(ref === undefined ? {} : { ref }), ...opts.remote, allowHttp: false, ...ecosystemFor(fixture) })
            : await migrate({ path: path as string, write, ...ecosystemFor(fixture) });
        const edits = plan.steps.filter((s) => s.kind !== "manual").length;
        const skipped =
          result.skipped.length > 0
            ? ` Could not apply: ${result.skipped.map((s) => `${s.step.file}: ${s.reason}`).join("; ")}.`
            : "";
        // `written` is false for a dry run and for a write that changed nothing. Only the request distinguishes them.
        const head = write
          ? result.written
            ? `Updated ${result.changes.length} file(s): ${result.changes.map((c) => c.file).join(", ")}.${skipped}`
            : `${edits} edit(s), ${result.manual.length} manual step(s).${skipped}`
          : `Dry run: ${edits} edit(s), ${result.manual.length} manual step(s).${skipped}`;
        const follow =
          result.followUp.length > 0 && (result.changes.length > 0 || result.written)
            ? ` Next run: ${result.followUp.join("; ")}.`
            : "";
        const locks = plan.lockfiles && plan.lockfiles.length > 0 ? ` Lockfile(s) present (${plan.lockfiles.join(", ")}): refresh them yourself.` : "";
        const guideText = formatGuide(guide).trimEnd();
        return text(`${head}${follow}${locks}${guideText ? `\n\n${guideText}` : ""}`, JSON.stringify(plan, null, 2), result.diff);
      } catch (e) {
        return failure(e);
      }
    },
  );

  server.registerTool(
    "pr",
    {
      description:
        "Open (or update) a pull request with the migration edits for a Stellar/Soroban repo: creates the branch kedgeway/migrate-<major> from the base, applies the manifest edits, commits, force-pushes that branch and creates or updates one PR (never two). Needs a local checkout (path; url is refused), a clean working tree, the server started with --allow-write, and GITHUB_TOKEN in the server's environment (it is never a parameter). dry_run=true only renders the title and body and works without --allow-write.",
      inputSchema: {
        path: z.string().optional().describe("Directory of the local git checkout (give this or url; url is refused)"),
        url: z.string().optional().describe("Not supported: pull requests need a local checkout. Give path"),
        fixture: z.string().optional().describe("Path to an ecosystem snapshot JSON (offline mode)"),
        base: z.string().optional().describe("Branch the PR targets (default: the repository default branch)"),
        branch: z.string().optional().describe("Head branch to push (default kedgeway/migrate-<major>); it is force-pushed"),
        repo: z.string().optional().describe("owner/repo (default GITHUB_REPOSITORY, else the origin remote)"),
        dry_run: z.boolean().optional().default(false).describe("Render the title and body only: no git or network writes (works without --allow-write)"),
        refresh_lockfiles: z.boolean().optional().default(false).describe("Refresh the lockfiles the plan touched (cargo/npm/pnpm/yarn, only when installed)"),
        label: z.string().optional().describe("Label to apply (default kedgeway)"),
        draft: z.boolean().optional().default(false).describe("Open the PR as a draft"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async ({ path, url, fixture, base, branch, repo, dry_run, refresh_lockfiles, label, draft }) => {
      const env = opts.env ?? process.env;
      const token = env["GITHUB_TOKEN"];
      const scrub = (m: string): string => (token === undefined || token === "" ? m : m.split(token).join("***"));
      try {
        checkTarget(path, url);
        if (url !== undefined) throw new Error("pull requests need a local checkout: clone the repository and give its path (url is not supported)");
        if (!dry_run && opts.allowWrite !== true) {
          throw new Error("opening a pull request is disabled. Restart the server with `kedgeway mcp --allow-write` (dry_run still works).");
        }
        const o = await openPr({
          path: path as string,
          ...ecosystemFor(fixture),
          version,
          env,
          dryRun: dry_run,
          ...(base === undefined ? {} : { base }),
          ...(branch === undefined ? {} : { branch }),
          ...(repo === undefined ? {} : { repo }),
          ...(refresh_lockfiles ? { refreshLockfiles: true } : {}),
          ...(label === undefined ? {} : { label }),
          ...(draft ? { draft: true } : {}),
          ...(opts.pr === undefined ? {} : { deps: opts.pr }),
        });
        const warn = o.warnings.length > 0 ? ` Warnings: ${scrub(o.warnings.join("; "))}.` : "";
        if (o.action === "skip") return text(`kedgeway pr: skipped: ${o.reason ?? "nothing to do"}.${warn}`);
        if (o.action === "dry-run") {
          return text(`Dry run (nothing written or sent): branch ${o.branch}, title "${o.title}". Run without dry_run to open it.${warn}`, o.body ?? "");
        }
        const verb = o.action === "create" ? "Created" : "Updated";
        return text(`${verb} pull request #${o.number ?? "?"} on branch ${o.branch}: ${o.url ?? ""}${warn}`, JSON.stringify({ action: o.action, url: o.url, branch: o.branch, title: o.title }, null, 2));
      } catch (e) {
        return { isError: true, ...text(`kedgeway: ${scrub(e instanceof Error ? e.message : String(e))}`) };
      }
    },
  );

  return server;
}

/** Serves MCP until the transport closes (client disconnect or stdin EOF). */
/**
 * Serves until the transport closes. With stdio, the client going away only ends stdin (the SDK's stdio
 * transport does not notice), so `input` ending or closing closes the transport; by default that is
 * `process.stdin` when the stdio transport is created here.
 */
export async function runStdioServer(
  opts: KedgewayServerOptions = {},
  transport?: Transport,
  input?: NodeJS.ReadableStream,
): Promise<void> {
  const t = transport ?? new StdioServerTransport();
  const watched: NodeJS.ReadableStream | undefined = input ?? (transport === undefined ? process.stdin : undefined);
  const closed = new Promise<void>((resolve) => {
    const prev = t.onclose;
    t.onclose = () => {
      prev?.();
      resolve();
    };
  });
  const stop = (): void => void t.close().catch(() => undefined);
  watched?.once("end", stop);
  watched?.once("close", stop);
  try {
    await createKedgewayServer(opts).connect(t);
    await closed;
  } finally {
    watched?.removeListener("end", stop);
    watched?.removeListener("close", stop);
  }
}
