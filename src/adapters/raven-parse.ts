import { z } from "zod";
import type { EcosystemSnapshot } from "../ports/ecosystem.js";

export const EXECUTE_SCRIPT = `async () => {
  const [page, tc, notes] = await Promise.all([
    stellarDocs.get_doc_page({ path: "/docs/networks/software-versions" }),
    scout.analyzeEcosystem({ dimension: "toolchain" }),
    stellarDocs.search_docs({ query: "soroban sdk upgrade migration breaking changes release notes", hitsPerPage: 5 })
  ]);
  const degraded = [];
  let rustSdk = null, jsSdk = null, protocol = null;
  if (page.ok) {
    const c = page.data.content;
    const rust = c.match(/\\|\\s*Smart Contract Rust SDK\\s*\\|\\s*\`v?([0-9]+\\.[0-9]+\\.[0-9]+)\`/);
    const js = c.match(/\\|\\s*Stellar JS Stellar SDK\\s*\\|\\s*\`v?([0-9]+\\.[0-9]+\\.[0-9]+)\`/);
    const proto = c.match(/Protocol\\s+([0-9]+)/);
    rustSdk = rust ? rust[1] : null; jsSdk = js ? js[1] : null; protocol = proto ? Number(proto[1]) : null;
    if (!rustSdk) degraded.push("software-versions: rust sdk row not found");
  } else degraded.push("stellarDocs.get_doc_page: " + page.error.message);
  const t = tc.ok ? tc.data.toolchain : null;
  if (!tc.ok) degraded.push("scout.analyzeEcosystem: " + tc.error.message);
  const deprecated = [...new Set((t?.deprecatedRepos || []).map(r => r.sorobanSdkVersion).filter(Boolean))];
  const hits = r => (r.ok && Array.isArray(r.data.hits)) ? r.data.hits.map(h => ({ title: h.title || "", url: h.url || "", snippet: (h.snippet || "").slice(0, 300) })) : [];
  if (!notes.ok) degraded.push("stellarDocs.search_docs: " + notes.error.message);
  return { observedAt: new Date().toISOString(), rustSdkCurrent: rustSdk, jsSdkCurrent: jsSdk, protocolCurrent: protocol, deprecatedVersions: deprecated, scoutGeneratedAt: tc.ok ? (tc.data.meta?.generatedAt ?? null) : null, notes: hits(notes), degraded };
}`;

const FOOTER_MARKER = /^--- SOURCE METADATA ---/m;

/** Scan a brace-balanced object starting at `start`; returns the end index (exclusive) or null if unbalanced. */
function balancedEnd(body: string, start: number): number | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < body.length; i += 1) {
    const ch = body[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return null;
}

/** Parse the first brace-balanced JSON object in `text`, ignoring a trailing metadata footer. */
export function extractLeadingJson(text: string): unknown {
  const m = FOOTER_MARKER.exec(text);
  const body = m ? text.slice(0, m.index) : text;
  let from = 0;
  for (;;) {
    const start = body.indexOf("{", from);
    if (start === -1) throw new Error("No JSON object found in Raven response");
    const end = balancedEnd(body, start);
    if (end === null) throw new Error("Unbalanced JSON object in Raven response");
    try {
      return JSON.parse(body.slice(start, end)) as unknown;
    } catch {
      from = end; // balanced but not JSON (e.g. a "{script}" preface): keep looking
    }
  }
}

const HitSchema = z.object({
  title: z.string().optional(),
  url: z.string().optional(),
  snippet: z.string().optional(),
});

export const RavenPayloadSchema = z.object({
  observedAt: z.string(),
  rustSdkCurrent: z.string().nullable(),
  jsSdkCurrent: z.string().nullable(),
  protocolCurrent: z.number().nullable(),
  deprecatedVersions: z.array(z.string()),
  scoutGeneratedAt: z.string().nullable().optional(),
  notes: z.array(HitSchema),
  degraded: z.array(z.string()),
});
export type RavenPayload = z.infer<typeof RavenPayloadSchema>;

function majorOf(version: string | null): number | null {
  if (version === null) return null;
  const m = /^v?(\d+)\./.exec(version);
  return m?.[1] === undefined ? null : Number.parseInt(m[1], 10);
}

export function snapshotFromPayload(p: RavenPayload): EcosystemSnapshot {
  return {
    observedAt: p.observedAt,
    sorobanSdk: {
      currentMajor: majorOf(p.rustSdkCurrent),
      deprecatedVersions: p.deprecatedVersions,
      source: `raven: stellarDocs.get_doc_page /docs/networks/software-versions (current); scout.analyzeEcosystem toolchain deprecated-repo sample${
        p.scoutGeneratedAt ? ` generated ${p.scoutGeneratedAt}` : ""
      }`,
    },
    jsSdk: {
      currentVersion: p.jsSdkCurrent,
      source: "raven: stellarDocs.get_doc_page /docs/networks/software-versions",
    },
    protocolCurrent: p.protocolCurrent,
    degraded: p.degraded,
    notes: p.notes.map((n) => ({ title: n.title ?? "", url: n.url ?? "", snippet: n.snippet ?? "" })),
  };
}

export function parseRavenResult(text: string): EcosystemSnapshot {
  const parsed = RavenPayloadSchema.safeParse(extractLeadingJson(text));
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    throw new Error(`Unexpected Raven response shape: ${detail}`);
  }
  return snapshotFromPayload(parsed.data);
}
