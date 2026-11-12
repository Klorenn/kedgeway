import { describe, expect, it } from "vitest";
import { unifiedDiff } from "./diff.js";

describe("unifiedDiff", () => {
  it("returns an empty string for identical text", () => {
    expect(unifiedDiff("a.txt", "x\ny\n", "x\ny\n")).toBe("");
  });

  it("renders a single changed line with context and hunk header", () => {
    const before = ["a", "b", "c", "d", "e", "f", "g", "h", ""].join("\n");
    const after = ["a", "b", "c", "d", "E", "f", "g", "h", ""].join("\n");
    expect(unifiedDiff("f.txt", before, after)).toBe(
      ["--- a/f.txt", "+++ b/f.txt", "@@ -2,7 +2,7 @@", " b", " c", " d", "-e", "+E", " f", " g", " h", ""].join("\n"),
    );
  });

  it("renders additions and removals and separates distant hunks", () => {
    const lines = Array.from({ length: 30 }, (_, i) => `l${i}`);
    const after = [...lines];
    after[1] = "changed";
    after.splice(28, 1);
    const out = unifiedDiff("f", lines.join("\n") + "\n", after.join("\n") + "\n");
    expect(out.match(/^@@/gm)).toHaveLength(2);
    expect(out).toContain("-l1\n+changed");
    expect(out).toContain("-l28");
  });

  it("marks a missing trailing newline", () => {
    expect(unifiedDiff("f", "a\nb", "a\nc")).toBe(
      ["--- a/f", "+++ b/f", "@@ -1,2 +1,2 @@", " a", "-b", "\\ No newline at end of file", "+c", "\\ No newline at end of file", ""].join("\n"),
    );
  });

  it("treats adding a trailing newline as a change", () => {
    const out = unifiedDiff("f", "a", "a\n");
    expect(out).toContain("-a\n\\ No newline at end of file\n+a\n");
  });

  it("handles large files with a small change quickly (common prefix/suffix trimmed)", () => {
    const lines = Array.from({ length: 30000 }, (_, i) => `line ${i}`);
    const after = [...lines];
    after[15000] = "changed";
    const t0 = Date.now();
    const out = unifiedDiff("big", lines.join("\n") + "\n", after.join("\n") + "\n");
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(out).toContain("-line 15000\n+changed");
  });
});
