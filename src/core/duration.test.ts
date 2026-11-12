import { describe, expect, it } from "vitest";
import { parseDuration } from "./duration.js";

describe("parseDuration", () => {
  it.each([
    ["30s", 30_000],
    ["15m", 900_000],
    ["24h", 86_400_000],
    ["2d", 172_800_000],
    ["0h", 0],
  ])("parses %s", (input, ms) => {
    expect(parseDuration(input)).toBe(ms);
  });

  it.each(["", "h", "1.5h", "-1h", "10", "10w", "1h30m", " 1h"])("rejects %j", (input) => {
    expect(parseDuration(input)).toBeNull();
  });
});
