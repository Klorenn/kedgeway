import type { EcosystemSnapshot } from "../ports/ecosystem.js";
import type { MigrationPlan, MigrationStep } from "./migration.js";
import type { SourceHit } from "./source-hits.js";

export interface GuideDoc {
  title: string;
  url: string;
  snippet: string;
}

/** Lines of a migration guide. Empty when the plan has nothing to do. */
export interface MigrationGuide {
  lines: string[];
}

const MIGRATION_WORD = /migrat|breaking change|release notes|changelog/i;
const DROP_URL = /\/validators\/|admin-guide|\/audits\//i;

/**
 * Notes whose own title or url is a migration document. A snippet that merely
 * mentions a migration guide does not make the page one: Raven's search often
 * returns a signing how-to that links an XDR migration page in passing.
 * Validator admin guides and audits are dropped.
 */
export function migrationDocs(notes: EcosystemSnapshot["notes"]): GuideDoc[] {
  return notes.filter((n) => !DROP_URL.test(n.url) && MIGRATION_WORD.test(`${n.title}\n${n.url}`));
}

function quote(step: MigrationStep): string {
  return `${step.dependency} ${step.from} → ${step.to}`;
}

function editLine(step: MigrationStep): string {
  if (step.kind === "replace-legacy-package") {
    return `kedgeway edits ${step.file}: replaces ${step.dependency} with ${step.replacement ?? "@stellar/stellar-sdk"} at ${step.to}. Only that dependency entry changes.`;
  }
  return `kedgeway edits ${step.file}: ${quote(step)}. Only the version string on that line changes.`;
}

function positionLine(step: MigrationStep, snapshot: EcosystemSnapshot): string {
  const published =
    step.kind === "bump-rust-dep" || step.dependency === "soroban-sdk"
      ? (snapshot.sorobanSdk.currentVersion ??
        (snapshot.sorobanSdk.currentMajor === null ? "unknown" : String(snapshot.sorobanSdk.currentMajor)))
      : (snapshot.jsSdk.currentVersion ?? "unknown");
  const protocol = snapshot.protocolCurrent === null ? "protocol unknown" : `protocol ${snapshot.protocolCurrent}`;
  return `${step.dependency} ${step.from} in ${step.file}. Stellar publishes ${published}, ${protocol}, observed ${snapshot.observedAt}.`;
}

function hitsFor(name: string, hits: readonly SourceHit[]): string {
  const found = hits.filter((h) => h.name === name);
  if (found.length === 0) return "";
  return ` Found at ${found.map((h) => `${h.file}:${h.line}`).join(", ")}.`;
}

/**
 * A guide for one migration plan. It states the published version and protocol from the snapshot,
 * what kedgeway will edit, what the user must do, and which Raven notes are migration documents.
 * It does not invent API rewrites.
 */
export function buildGuide(
  plan: MigrationPlan,
  snapshot: EcosystemSnapshot,
  hits: readonly SourceHit[],
  opts: { importsTruncated?: boolean } = {},
): MigrationGuide {
  if (plan.steps.length === 0) return { lines: [] };

  const lines: string[] = ["Guide"];
  const edits = plan.steps.filter((s) => s.kind !== "manual");
  const manuals = plan.steps.filter((s) => s.kind === "manual");
  const positioned = edits.length > 0 ? edits : manuals;
  for (const step of positioned) lines.push(`  ${positionLine(step, snapshot)}`);

  let n = 1;
  const push = (text: string): void => {
    lines.push(`  ${n}. ${text}`);
    n += 1;
  };

  for (const step of edits) push(editLine(step));
  for (const cmd of plan.followUp) push(`You run \`${cmd}\`. kedgeway does not run it.`);
  for (const step of manuals) push(`You: ${step.reason}${hitsFor(step.dependency, hits)}`);
  if (opts.importsTruncated) push("Import search stopped after 20 matches. Look through the rest of the repo yourself.");

  if (snapshot.protocolCurrent === null) {
    push("This snapshot has no protocol number. Confirm the Stellar CLI and the network you deploy to yourself. kedgeway does not read either.");
  } else {
    push(
      `You confirm the Stellar CLI and the network you deploy to both target protocol ${snapshot.protocolCurrent}. kedgeway does not read the CLI or the network.`,
    );
  }
  push("A major bump can change the API. kedgeway does not rewrite source. Run your tests after the commands above.");

  const docs = migrationDocs(snapshot.notes);
  lines.push("", "Docs");
  if (docs.length === 0) {
    lines.push("  No upgrade guide came back in this snapshot. Current versions come from the software-versions page recorded on the snapshot.");
  } else {
    for (const doc of docs) {
      lines.push(`  ${doc.title}`);
      lines.push(`  ${doc.url}`);
      if (doc.snippet) lines.push(`  ${doc.snippet}`);
    }
  }
  return { lines };
}

export function formatGuide(guide: MigrationGuide): string {
  if (guide.lines.length === 0) return "";
  return `${guide.lines.join("\n")}\n`;
}
