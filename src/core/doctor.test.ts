import { describe, expect, it } from "vitest";
import { doctorOk, formatDoctor, nodeSupported, type DoctorCheck } from "./doctor.js";

describe("nodeSupported", () => {
  it.each([
    ["22.12.0", true],
    ["22.13.1", true],
    ["24.0.0", true],
    ["22.11.9", false],
    ["20.18.0", false],
    ["garbage", false],
  ])("%s", (v, ok) => {
    expect(nodeSupported(v)).toBe(ok);
  });
});

describe("formatDoctor / doctorOk", () => {
  const checks: DoctorCheck[] = [
    { name: "node", status: "ok", detail: "v22.12.0" },
    { name: "auth", status: "warn", detail: "none" },
    { name: "raven", status: "skip", detail: "skipped (--offline)" },
  ];
  it("renders one aligned line per check and a verdict", () => {
    const text = formatDoctor(checks);
    expect(text).toMatch(/ok\s+node\s+v22\.12\.0/);
    expect(text).toMatch(/warn\s+auth\s+none/);
    expect(text).toMatch(/skip\s+raven/);
    expect(text).toMatch(/healthy|0 failed/i);
  });
  it("is ok unless a check failed", () => {
    expect(doctorOk(checks)).toBe(true);
    expect(doctorOk([...checks, { name: "raven", status: "fail", detail: "down" }])).toBe(false);
    expect(formatDoctor([{ name: "raven", status: "fail", detail: "down" }])).toMatch(/1 failed/);
  });
});
