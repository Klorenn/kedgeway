export interface SourceHit {
  file: string;
  line: number;
  /** Package name the line imports. */
  name: string;
}

function specifier(name: string): RegExp {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`['"]${escaped}(?:/[^'"]*)?['"]`);
}

/** Lines that import one of `names` as a module specifier. A longer name that merely contains another is not a hit. */
export function findImportHits(files: readonly { file: string; text: string }[], names: readonly string[]): SourceHit[] {
  const patterns = names.map((name) => ({ name, re: specifier(name) }));
  const hits: SourceHit[] = [];
  for (const file of files) {
    const lines = file.text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? "";
      for (const { name, re } of patterns) {
        if (re.test(line)) hits.push({ file: file.file, line: i + 1, name });
      }
    }
  }
  return hits;
}
