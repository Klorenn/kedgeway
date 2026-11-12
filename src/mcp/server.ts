import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createRequire } from "node:module";
import { z } from "zod";
import { meetsThreshold, type Diagnosis, type Severity } from "../core/diagnose.js";
import { FINDINGS_REFERENCE } from "../core/findings-reference.js";
import type { EcosystemPort } from "../ports/ecosystem.js";
import { formatGuide } from "../core/guide.js";
import { diagnoseDetailed, migrate, resolveEcosystem, toSarif } from "../sdk.js";

export interface KedgewayServerOptions {
  /** Ecosystem used when a tool call has no fixture. Defaults to live Raven. */
  ecosystem?: EcosystemPort;
  /** Allow `migrate` with write=true to edit files. Off by default (`kedgeway mcp --allow-write`). */
  allowWrite?: boolean;
}

const version = (createRequire(import.meta.url)("../../package.json") as { version: string }).version;

const SeveritySchema = z.enum(["critical", "warning", "info"]);

function text(...parts: string[]): { content: { type: "text"; text: string }[] } {
  return { content: parts.map((t) => ({ type: "text" as const, text: t })) };
}

function failure(e: unknown): { isError: true; content: { type: "text"; text: string }[] } {
  return { isError: true, ...text(`kedgeway: ${e instanceof Error ? e.message : String(e)}`) };
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
        path: z.string().describe("Directory of the repository to scan"),
        fixture: z.string().optional().describe("Path to an ecosystem snapshot JSON (offline mode)"),
        failOn: SeveritySchema.optional().describe("Report whether any finding is at or above this severity"),
        format: z.enum(["json", "sarif"]).optional().describe('Second text part: the Diagnosis JSON (default) or a SARIF 2.1.0 log'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ path, fixture, failOn, format }) => {
      try {
        const detailed = await diagnoseDetailed({ path, ...ecosystemFor(fixture) });
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
        path: z.string().describe("Directory of the repository"),
        fixture: z.string().optional().describe("Path to an ecosystem snapshot JSON (offline mode)"),
        write: z.boolean().optional().default(false).describe("Apply the edits (default false: dry run). Requires the server to be started with --allow-write."),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async ({ path, fixture, write }) => {
      if (write && opts.allowWrite !== true) {
        return failure(new Error("write is disabled. Restart the server with `kedgeway mcp --allow-write` to let migrate edit files (dry run still works)."));
      }
      try {
        const { plan, result, guide } = await migrate({ path, write, ...ecosystemFor(fixture) });
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

  return server;
}

/** Serves MCP until the transport closes (client disconnect or stdin EOF). */
export async function runStdioServer(
  opts: KedgewayServerOptions = {},
  transport: Transport = new StdioServerTransport(),
): Promise<void> {
  const closed = new Promise<void>((resolve) => {
    const prev = transport.onclose;
    transport.onclose = () => {
      prev?.();
      resolve();
    };
  });
  await createKedgewayServer(opts).connect(transport);
  await closed;
}
