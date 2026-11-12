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
});
