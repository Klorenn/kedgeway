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
