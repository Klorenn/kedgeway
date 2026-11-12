export type DoctorStatus = "ok" | "warn" | "fail" | "skip";

export interface DoctorCheck {
  name: string;
  status: DoctorStatus;
  detail: string;
}

/** Node >= 22.12 (the package's engines range). */
export function nodeSupported(version: string): boolean {
  const m = /^v?(\d+)\.(\d+)/.exec(version);
  if (!m?.[1] || !m[2]) return false;
  const major = Number.parseInt(m[1], 10);
  const minor = Number.parseInt(m[2], 10);
  return major > 22 || (major === 22 && minor >= 12);
}

export function doctorOk(checks: readonly DoctorCheck[]): boolean {
  return !checks.some((c) => c.status === "fail");
}

export function formatDoctor(checks: readonly DoctorCheck[]): string {
  const width = Math.max(...checks.map((c) => c.name.length), 0);
  const lines = ["kedgeway doctor", ""];
  for (const c of checks) lines.push(`${c.status.padEnd(4)}  ${c.name.padEnd(width)}  ${c.detail}`);
  const failed = checks.filter((c) => c.status === "fail").length;
  const warned = checks.filter((c) => c.status === "warn").length;
  lines.push("", failed === 0 ? `healthy (0 failed, ${warned} warning${warned === 1 ? "" : "s"})` : `${failed} failed, ${warned} warning${warned === 1 ? "" : "s"}`);
  return `${lines.join("\n")}\n`;
}

export const STELLAR_CLI_INSTALL_URL = "https://developers.stellar.org/docs/tools/cli/install-cli";

/** `stellar 23.1.4 (abc...)` (possibly followed by more build lines) to `23.1.4`; null when it does not look like that. */
export function parseStellarVersion(output: string): string | null {
  const m = /^\s*stellar\s+v?(\d+\.\d+\.\d+[0-9A-Za-z.+-]*)/m.exec(output);
  return m?.[1] ?? null;
}

const majorOf = (v: string): number => Number.parseInt(v, 10);

/**
 * Verdict for an installed Stellar CLI. `unknownWhy` explains a missing current version ("offline", "no snapshot"):
 * the check is then `ok`, because nothing can be compared.
 */
export function judgeStellarCli(installed: string, current: string | null, unknownWhy = "no snapshot"): DoctorCheck {
  const name = "stellar-cli";
  if (current === null) return { name, status: "ok", detail: `installed ${installed} (current unknown${unknownWhy === "offline" ? " offline" : `: ${unknownWhy}`})` };
  const behind = majorOf(current) - majorOf(installed);
  if (behind <= 0) return { name, status: "ok", detail: `installed ${installed} (current ${current})` };
  if (behind === 1) return { name, status: "warn", detail: `installed ${installed} is one major behind current ${current}: ${STELLAR_CLI_INSTALL_URL}` };
  return { name, status: "fail", detail: `installed ${installed} is ${behind} majors behind current ${current}: ${STELLAR_CLI_INSTALL_URL}` };
}
