import { describe, expect, it } from "vitest";
import { doctorOk, formatDoctor, judgeStellarCli, nodeSupported, parseStellarVersion, STELLAR_CLI_INSTALL_URL, type DoctorCheck } from "./doctor.js";

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

describe("parseStellarVersion", () => {
  it.each([
    ["stellar 23.1.4\n", "23.1.4"],
    ["stellar 23.1.4 (abc123def)\nstellar-xdr 23.0.0 (xyz)\nrust 1.84.0\n", "23.1.4"],
    ["stellar v22.0.0-rc.1\n", "22.0.0-rc.1"],
    ["\r\nstellar 21.5.0\r\n", "21.5.0"],
  ])("parses %j", (out, version) => {
    expect(parseStellarVersion(out)).toBe(version);
  });

  it.each(["", "command not found", "soroban 21.0.0", "stellar", "stellar-xdr 23.0.0"])("returns null for %j", (out) => {
    expect(parseStellarVersion(out)).toBeNull();
  });
});

describe("judgeStellarCli", () => {
  it("ok when on the current major or newer", () => {
    expect(judgeStellarCli("28.0.0", "28.1.0")).toMatchObject({ name: "stellar-cli", status: "ok", detail: expect.stringContaining("installed 28.0.0") });
    expect(judgeStellarCli("29.0.0", "28.1.0")).toMatchObject({ status: "ok" });
  });

  it("warn when exactly one major behind, fail when two or more", () => {
    const one = judgeStellarCli("27.9.0", "28.1.0");
    expect(one).toMatchObject({ status: "warn", detail: expect.stringContaining("one major behind") });
    expect(one.detail).toContain(STELLAR_CLI_INSTALL_URL);
    const two = judgeStellarCli("26.0.0", "28.1.0");
    expect(two).toMatchObject({ status: "fail", detail: expect.stringContaining("2 majors behind") });
    expect(two.detail).toContain("28.1.0");
  });

  it("ok with an explicit note when the current version is unknown", () => {
    expect(judgeStellarCli("23.1.4", null, "offline")).toEqual({ name: "stellar-cli", status: "ok", detail: "installed 23.1.4 (current unknown offline)" });
    expect(judgeStellarCli("23.1.4", null, "no snapshot")).toMatchObject({ status: "ok", detail: expect.stringContaining("current unknown") });
  });
});
