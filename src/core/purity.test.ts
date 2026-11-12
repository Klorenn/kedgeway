import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("core purity", () => {
  it("imports no node: builtins (core must stay free of I/O)", async () => {
    const dir = import.meta.dirname;
    const files = (await readdir(dir)).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
    expect(files.length).toBeGreaterThan(3);
    for (const f of files) {
      const text = await readFile(join(dir, f), "utf8");
      expect(text, f).not.toMatch(/from\s+["']node:/);
    }
  });
});
