import type { Diagnosis, Severity } from "./diagnose.js";

const COMMAND: Record<Severity, string> = { critical: "error", warning: "warning", info: "notice" };

const data = (s: string): string => s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
const prop = (s: string): string => data(s).replace(/:/g, "%3A").replace(/,/g, "%2C");

function isRepoPath(file: string): boolean {
  return file !== "" && !file.startsWith("(") && !file.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(file);
}

/**
 * GitHub Actions workflow commands (`::error file=...,line=...,title=CODE::message`), one per finding.
 * `pathPrefix` is the scan root relative to the repository root; `omitFiles` drops file and line (the scan root
 * is outside the repository, so no path would resolve).
 */
export function formatAnnotations(diagnosis: Diagnosis, opts: { pathPrefix?: string; omitFiles?: boolean } = {}): string[] {
  const prefix = (opts.pathPrefix ?? "").replace(/\/+$/, "");
  return diagnosis.findings.map((f) => {
    const props: string[] = [];
    if (opts.omitFiles !== true && isRepoPath(f.file)) {
      props.push(`file=${prop(prefix === "" ? f.file : `${prefix}/${f.file}`)}`);
      if (f.line !== undefined) props.push(`line=${f.line}`);
    }
    props.push(`title=${prop(f.code)}`);
    return `::${COMMAND[f.severity]} ${props.join(",")}::${data(f.message)}`;
  });
}
