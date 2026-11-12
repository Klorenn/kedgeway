import { describe, expect, it } from "vitest";
import { formatAnnotations } from "./annotations.js";
import type { Diagnosis, Finding } from "./diagnose.js";

const f = (over: Partial<Finding> = {}): Finding => ({
  severity: "critical",
  code: "SDK_DEPRECATED",
  message: "soroban-sdk 21.0.0 is deprecated",
  file: "contracts/a/Cargo.toml",
  line: 7,
  evidence: "e",
  ...over,
});
const diag = (findings: Finding[]): Diagnosis => ({ findings, summary: { critical: 0, warning: 0, info: 0 } });

describe("formatAnnotations", () => {
  it("emits error/warning/notice workflow commands with file, line and title", () => {
    const out = formatAnnotations(
      diag([f(), f({ severity: "warning", code: "SDK_BEHIND", message: "behind", line: 9 }), f({ severity: "info", code: "SDK_CURRENT", message: "ok", line: undefined })]),
    );
    expect(out).toEqual([
      "::error file=contracts/a/Cargo.toml,line=7,title=SDK_DEPRECATED::soroban-sdk 21.0.0 is deprecated",
      "::warning file=contracts/a/Cargo.toml,line=9,title=SDK_BEHIND::behind",
      "::notice file=contracts/a/Cargo.toml,title=SDK_CURRENT::ok",
    ]);
  });

  it("prefixes the path when the scan root is below the repo root", () => {
    expect(formatAnnotations(diag([f({ file: "a/Cargo.toml" })]), { pathPrefix: "contracts" })[0]).toContain("file=contracts/a/Cargo.toml,");
  });

  it("omits file and line for findings that are not about a repo file", () => {
    const out = formatAnnotations(
      diag([f({ code: "DATA_DEGRADED", severity: "warning", file: "(ecosystem data)", line: undefined, message: "degraded" }), f({ code: "NO_SDK_FOUND", severity: "info", file: "/abs/repo", message: "none" })]),
    );
    expect(out).toEqual(["::warning title=DATA_DEGRADED::degraded", "::notice title=NO_SDK_FOUND::none"]);
  });

  it("escapes message and property values per the workflow-command rules", () => {
    const [line] = formatAnnotations(diag([f({ file: "a,b:c/Cargo.toml", message: "100%\nnext\rline" })]));
    expect(line).toBe("::error file=a%2Cb%3Ac/Cargo.toml,line=7,title=SDK_DEPRECATED::100%25%0Anext%0Dline");
  });

  it("returns nothing for an empty diagnosis", () => {
    expect(formatAnnotations(diag([]))).toEqual([]);
  });

  it("omits file and line for every finding when the scan root is outside the repository", () => {
    const out = formatAnnotations(diag([f()]), { omitFiles: true });
    expect(out).toEqual(["::error title=SDK_DEPRECATED::soroban-sdk 21.0.0 is deprecated"]);
  });
});

describe("formatAnnotations: toolchain findings", () => {
  it("points CLI and Rust findings at the workflow or toolchain file and line", () => {
    const out = formatAnnotations(
      diag([
        f({ code: "CLI_DEPRECATED", file: ".github/workflows/ci.yml", line: 23, message: "stellar-cli 21.5.0 is 7 majors behind" }),
        f({ severity: "warning", code: "RUST_TOOLCHAIN_OLD", file: "rust-toolchain.toml", line: 2, message: "old" }),
      ]),
      { pathPrefix: "contracts" },
    );
    expect(out).toEqual([
      "::error file=contracts/.github/workflows/ci.yml,line=23,title=CLI_DEPRECATED::stellar-cli 21.5.0 is 7 majors behind",
      "::warning file=contracts/rust-toolchain.toml,line=2,title=RUST_TOOLCHAIN_OLD::old",
    ]);
  });
});
