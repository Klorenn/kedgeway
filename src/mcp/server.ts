import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { SEVERITY_RANK, type Diagnosis, type Severity } from "../core/diagnose.js";
import { FINDINGS_REFERENCE } from "../core/findings-reference.js";
import type { EcosystemPort } from "../ports/ecosystem.js";
import { diagnoseDetailed, resolveEcosystem } from "../sdk.js";

export interface KedgewayServerOptions {
  /** Ecosystem used when a tool call has no fixture. Defaults to live Raven. */
  ecosystem?: EcosystemPort;
}

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
  const met = d.findings.some((f) => SEVERITY_RANK[f.severity] >= SEVERITY_RANK[failOn]);
  return `${base}. fail-on ${failOn}: ${met ? "met (a finding is at or above the threshold)" : "not met"}`;
}

export function createKedgewayServer(opts: KedgewayServerOptions = {}): McpServer {
  const server = new McpServer({ name: "kedgeway", version: "0.1.0" });
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
      },
    },
    async ({ path, fixture, failOn }) => {
      try {
        const { diagnosis } = await diagnoseDetailed({ path, ...ecosystemFor(fixture) });
        return text(summarize(diagnosis, failOn), JSON.stringify(diagnosis, null, 2));
      } catch (e) {
        return failure(e);
      }
    },
  );

  server.registerTool(
    "findings_reference",
    { description: "List every finding code kedgeway can emit, with its severity and meaning." },
    () => text(JSON.stringify(FINDINGS_REFERENCE, null, 2)),
  );

  server.registerTool(
    "ecosystem_snapshot",
    {
      description: "Return the ecosystem snapshot (current SDK versions, protocol, deprecated sample), live via Raven unless a fixture is given.",
      inputSchema: { fixture: z.string().optional().describe("Path to an ecosystem snapshot JSON (offline mode)") },
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

  return server;
}

export async function runStdioServer(opts: KedgewayServerOptions = {}): Promise<void> {
  await createKedgewayServer(opts).connect(new StdioServerTransport());
}
