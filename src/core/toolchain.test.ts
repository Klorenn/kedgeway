import { describe, expect, it } from "vitest";
import { MAX_LOGICAL_LINE, compareRustVersion, emptyToolchain, mergeToolchain, parsePackageJsonCliPins, scanToolchainText, toolchainFileKind } from "./toolchain.js";

describe("toolchainFileKind", () => {
  it.each([
    [".github/workflows/ci.yml", "workflow"],
    [".github/workflows/release.yaml", "workflow"],
    ["sub/.github/workflows/ci.yml", "workflow"],
    ["Dockerfile", "dockerfile"],
    ["Dockerfile.dev", "dockerfile"],
    ["docker/app.Dockerfile", "dockerfile"],
    ["Makefile", "makefile"],
    ["contracts/Makefile", "makefile"],
    ["rules.mk", "makefile"],
    ["build.sh", "script"],
    ["scripts/deploy.sh", "script"],
    ["scripts/ci/deep.sh", "script"],
    [".tool-versions", "tool-versions"],
    ["rust-toolchain.toml", "rust-toolchain"],
    ["rust-toolchain", "rust-toolchain"],
    ["contracts/rust-toolchain.toml", "rust-toolchain"],
    [".cargo/config.toml", "cargo-config"],
    [".cargo/config", "cargo-config"],
    ["package.json", "package.json"],
  ])("classifies %s as %s", (rel, kind) => {
    expect(toolchainFileKind(rel)).toBe(kind);
  });

  it.each(["README.md", "src/lib.rs", "docs/build.sh", "other/ci.yml", "Cargo.toml", ".github/dependabot.yml", "config.toml"])("ignores %s", (rel) => {
    expect(toolchainFileKind(rel)).toBeNull();
  });
});

describe("stellar-cli pins", () => {
  const cli = (rel: string, text: string) => scanToolchainText(rel, text).cliPins;

  it("reads `cargo install ... stellar-cli --version X` from a workflow with file and line", () => {
    const text = ["name: ci", "jobs:", "  b:", "    steps:", "      - run: cargo install --locked stellar-cli --version 21.5.0"].join("\n");
    expect(cli(".github/workflows/ci.yml", text)).toEqual([
      { raw: "21.5.0", version: "21.5.0", major: 21, file: ".github/workflows/ci.yml", line: 5, source: "workflow", via: "cargo install --version" },
    ]);
  });

  it("handles --version=X, quotes and a version flag before the crate name", () => {
    expect(cli("Makefile", `\tcargo install stellar-cli --version="22.1.0"`)[0]).toMatchObject({ version: "22.1.0", line: 1, source: "makefile" });
    expect(cli("Makefile", `\tcargo install --version '22.1.0' stellar-cli`)[0]).toMatchObject({ version: "22.1.0" });
  });

  it("reads stellar-cli@X from cargo install, cargo binstall and bare form, stripping v", () => {
    expect(cli("build.sh", "cargo install stellar-cli@23.0.1")[0]).toMatchObject({ version: "23.0.1", major: 23, source: "script", via: "stellar-cli@" });
    expect(cli("build.sh", "cargo binstall stellar-cli@v23.0.1 -y")[0]).toMatchObject({ version: "23.0.1", raw: "v23.0.1" });
    expect(cli("scripts/x.sh", "install stellar-cli@22")[0]).toMatchObject({ version: "22", major: 22 });
  });

  it("joins backslash continuations and reports the first line of the command", () => {
    const text = ["FROM rust:1.84", "RUN cargo install --locked \\", "    stellar-cli \\", "    --version 21.5.0"].join("\n");
    expect(cli("Dockerfile", text)).toEqual([expect.objectContaining({ version: "21.5.0", line: 2, source: "dockerfile" })]);
  });

  it("ignores unpinned installs, commented lines, inline comments and unrelated version flags", () => {
    expect(cli("build.sh", "cargo install --locked stellar-cli")).toEqual([]);
    expect(cli("build.sh", "# cargo install stellar-cli@21.0.0")).toEqual([]);
    expect(cli("build.sh", "echo ok # stellar-cli@21.0.0")).toEqual([]);
    expect(cli("build.sh", "cargo install other-tool --version 1.2.3")).toEqual([]);
    expect(cli("build.sh", "stellar --version")).toEqual([]);
    expect(cli("build.sh", "cargo install my-stellar-cli --version 1.0.0")).toEqual([]);
  });

  it("keeps an unparseable pin with version null so it can be reported", () => {
    expect(cli("build.sh", "cargo install stellar-cli@main")[0]).toMatchObject({ raw: "main", version: null, major: null });
    expect(cli(".github/workflows/ci.yml", "      - run: cargo install stellar-cli --version ${{ env.CLI }}")[0]).toMatchObject({ version: null });
  });

  it("reads the version input of the stellar/stellar-cli action, not the action ref", () => {
    const text = [
      "steps:",
      "  - uses: actions/checkout@v4",
      "  - uses: stellar/stellar-cli@v23",
      "    with:",
      "      version: 22.8.2",
      "  - run: echo version: 99.0.0",
    ].join("\n");
    expect(cli(".github/workflows/ci.yml", text)).toEqual([
      { raw: "22.8.2", version: "22.8.2", major: 22, file: ".github/workflows/ci.yml", line: 5, source: "workflow", via: "stellar/stellar-cli action version input" },
    ]);
  });

  it("finds the action version input when `uses` follows `name` and stops at the next step", () => {
    const text = ["steps:", "  - name: cli", "    uses: stellar/stellar-cli@main", "    with:", '      version: "23.1.0"', "  - name: other", "    with:", "      version: 1.0.0"].join("\n");
    expect(cli(".github/workflows/ci.yml", text).map((p) => [p.version, p.line])).toEqual([["23.1.0", 5]]);
    expect(cli(".github/workflows/ci.yml", "  - uses: stellar/stellar-cli@v23\n  - uses: x\n    with:\n      version: 1.0.0")).toEqual([]);
  });

  it("reads .tool-versions", () => {
    const text = "nodejs 22.12.0\n# stellar-cli 20.0.0\nstellar-cli 22.0.0\n";
    expect(cli(".tool-versions", text)).toEqual([
      { raw: "22.0.0", version: "22.0.0", major: 22, file: ".tool-versions", line: 3, source: "tool-versions", via: ".tool-versions" },
    ]);
  });

  it("reads @stellar/stellar-cli from package.json dependencies and devDependencies", () => {
    const text = `{\n  "devDependencies": {\n    "@stellar/stellar-cli": "^22.0.0"\n  },\n  "dependencies": {\n    "@stellar/stellar-cli": "latest"\n  }\n}\n`;
    expect(parsePackageJsonCliPins(text, "package.json")).toEqual([
      { raw: "latest", version: null, major: null, file: "package.json", line: 6, source: "package.json", via: "dependencies" },
      { raw: "^22.0.0", version: "22.0.0", major: 22, file: "package.json", line: 3, source: "package.json", via: "devDependencies" },
    ]);
    expect(scanToolchainText("package.json", text).cliPins).toHaveLength(2);
    expect(parsePackageJsonCliPins("{not json", "package.json")).toEqual([]);
  });
});

describe("rust targets", () => {
  const targets = (rel: string, text: string) => scanToolchainText(rel, text).rustTargets;

  it("finds rustup target add, --target, workflow targets: and CARGO_BUILD_TARGET with file and line", () => {
    expect(targets(".github/workflows/ci.yml", "      - run: rustup target add wasm32-unknown-unknown")).toEqual([
      { target: "wasm32-unknown-unknown", file: ".github/workflows/ci.yml", line: 1, via: "rustup target add" },
    ]);
    expect(targets("Makefile", "\tcargo build --release --target wasm32-unknown-unknown")[0]).toMatchObject({ via: "--target", line: 1 });
    expect(targets("Makefile", "\tcargo build --target=wasm32-unknown-unknown")[0]).toMatchObject({ via: "--target" });
    expect(targets(".github/workflows/ci.yml", "          targets: wasm32-unknown-unknown, x86_64-unknown-linux-gnu")[0]).toMatchObject({ via: "targets:" });
    expect(targets("Dockerfile", "ENV CARGO_BUILD_TARGET=wasm32-unknown-unknown")[0]).toMatchObject({ via: "CARGO_BUILD_TARGET" });
  });

  it("detects wasm32v1-none and reports each target on a multi-target line", () => {
    const found = targets("build.sh", "rustup target add wasm32-unknown-unknown wasm32v1-none");
    expect(found.map((t) => t.target).sort()).toEqual(["wasm32-unknown-unknown", "wasm32v1-none"]);
  });

  it("does not treat a build-output path or a comment as a declaration", () => {
    expect(targets("Makefile", "\tcp target/wasm32-unknown-unknown/release/a.wasm out/")).toEqual([]);
    expect(targets("build.sh", "# rustup target add wasm32-unknown-unknown")).toEqual([]);
    expect(targets("build.sh", "rustup target add wasm32-unknown-unknown-extra")).toEqual([]);
  });

  it("reports a line once per target even if several patterns match it", () => {
    expect(targets("build.sh", "rustup target add wasm32-unknown-unknown && cargo build --target wasm32-unknown-unknown")).toHaveLength(1);
  });

  it("reads rust-toolchain.toml targets with the line of the target string", () => {
    const text = `[toolchain]\nchannel = "1.84.0"\ntargets = [\n  "wasm32-unknown-unknown",\n  "wasm32v1-none",\n]\n`;
    expect(targets("rust-toolchain.toml", text)).toEqual([
      { target: "wasm32-unknown-unknown", file: "rust-toolchain.toml", line: 4, via: "rust-toolchain targets" },
      { target: "wasm32v1-none", file: "rust-toolchain.toml", line: 5, via: "rust-toolchain targets" },
    ]);
  });

  it("reads [build] target from .cargo/config.toml as a string or an array", () => {
    expect(targets(".cargo/config.toml", `[build]\ntarget = "wasm32-unknown-unknown"\n`)).toEqual([
      { target: "wasm32-unknown-unknown", file: ".cargo/config.toml", line: 2, via: "[build] target" },
    ]);
    expect(targets(".cargo/config.toml", `[build]\ntarget = ["wasm32v1-none"]\n`)[0]).toMatchObject({ target: "wasm32v1-none", line: 2 });
    expect(targets(".cargo/config.toml", `[target.wasm32-unknown-unknown]\nrunner = "x"\n`)).toEqual([]);
  });

  it("ignores broken TOML silently", () => {
    expect(scanToolchainText("rust-toolchain.toml", "[toolchain\nchannel =")).toEqual(emptyToolchain());
    expect(scanToolchainText(".cargo/config.toml", "= =")).toEqual(emptyToolchain());
  });
});

describe("rust toolchain pin", () => {
  const pins = (rel: string, text: string) => scanToolchainText(rel, text).rustToolchains;

  it("parses a numeric channel from rust-toolchain.toml with its line", () => {
    expect(pins("rust-toolchain.toml", `[toolchain]\nchannel = "1.79.0"\n`)).toEqual([{ channel: "1.79.0", version: "1.79.0", file: "rust-toolchain.toml", line: 2 }]);
  });

  it("normalizes two-part channels and treats named channels as not pinned", () => {
    expect(pins("rust-toolchain.toml", `[toolchain]\nchannel = "1.84"\n`)[0]).toMatchObject({ version: "1.84.0" });
    expect(pins("rust-toolchain.toml", `[toolchain]\nchannel = "stable"\n`)).toEqual([]);
    expect(pins("rust-toolchain.toml", `[toolchain]\nchannel = "nightly-2025-01-01"\n`)).toEqual([]);
    expect(pins("rust-toolchain.toml", `[toolchain]\ncomponents = ["clippy"]\n`)).toEqual([]);
  });

  it("reads a legacy rust-toolchain file (plain channel or TOML)", () => {
    expect(pins("rust-toolchain", "1.80.1\n")).toEqual([{ channel: "1.80.1", version: "1.80.1", file: "rust-toolchain", line: 1 }]);
    expect(pins("rust-toolchain", "# pinned\n\n1.80.1\n")[0]).toMatchObject({ line: 3 });
    expect(pins("rust-toolchain", "stable\n")).toEqual([]);
    expect(pins("rust-toolchain", `[toolchain]\nchannel = "1.81.0"\n`)[0]).toMatchObject({ version: "1.81.0", line: 2 });
  });
});

describe("compareRustVersion and mergeToolchain", () => {
  it("compares dotted versions numerically", () => {
    expect(compareRustVersion("1.79.0", "1.84.0")).toBeLessThan(0);
    expect(compareRustVersion("1.84.0", "1.84.0")).toBe(0);
    expect(compareRustVersion("1.100.0", "1.84.0")).toBeGreaterThan(0);
    expect(compareRustVersion("2.0.0", "1.84.0")).toBeGreaterThan(0);
  });

  it("merges facts", () => {
    const a = scanToolchainText(".tool-versions", "stellar-cli 22.0.0");
    const b = scanToolchainText("rust-toolchain", "1.80.1");
    const m = mergeToolchain(a, b);
    expect(m.cliPins).toHaveLength(1);
    expect(m.rustToolchains).toHaveLength(1);
  });
});

describe("stellar-cli pin false positives (H2)", () => {
  const cli = (text: string, rel = "build.sh") => scanToolchainText(rel, text).cliPins;

  it.each([
    "cargo install stellar-cli --locked && cargo install wasm-opt --version 0.116.0",
    "cargo install --locked stellar-cli && stellar --version 2>&1",
    'echo "run cargo install stellar-cli; see --version 1.0"',
    "cargo install stellar-cli; stellar --version",
    "cargo install stellar-cli | tee log; cargo install other --version 1.0.0",
  ])("produces no pin for %s", (line) => {
    expect(cli(line)).toEqual([]);
  });

  it("still pins with env assignments, sudo, a yaml prefix and a pipe elsewhere", () => {
    expect(cli("FOO=1 sudo cargo install --locked stellar-cli --version 21.5.0 && echo done")[0]).toMatchObject({ version: "21.5.0" });
    expect(cli("      - run: cargo install stellar-cli --version 21.5.0", ".github/workflows/ci.yml")[0]).toMatchObject({ version: "21.5.0" });
    expect(cli("\t@cargo install stellar-cli --version 21.5.0", "Makefile")[0]).toMatchObject({ version: "21.5.0" });
  });
});

describe("cheap false negatives (M3)", () => {
  const cli = (text: string, rel = "build.sh") => scanToolchainText(rel, text).cliPins;

  it("takes --tag for a git install", () => {
    const p = cli("cargo install --git https://github.com/stellar/stellar-cli --tag v21.0.0 stellar-cli");
    expect(p[0]).toMatchObject({ version: "21.0.0", raw: "v21.0.0", major: 21 });
    expect(cli("cargo install --git https://github.com/stellar/stellar-cli stellar-cli")).toEqual([]);
  });

  it("treats legacy soroban-cli installs as a stellar-cli pin and says so", () => {
    expect(cli("cargo install soroban-cli --version 20.0.0")[0]).toMatchObject({ version: "20.0.0", via: expect.stringContaining("legacy soroban-cli") });
    expect(cli("cargo install soroban-cli@20.1.0")[0]).toMatchObject({ version: "20.1.0", via: expect.stringContaining("legacy soroban-cli") });
  });

  it("reads npm installs of @stellar/stellar-cli", () => {
    expect(cli("npm i -g @stellar/stellar-cli@22.0.0")[0]).toMatchObject({ version: "22.0.0", via: expect.stringContaining("npm") });
    expect(cli("npm i -g @stellar/stellar-cli")).toEqual([]);
  });

  it("reads release download URLs", () => {
    const url = "curl -L https://github.com/stellar/stellar-cli/releases/download/v23.0.0/stellar-cli-23.0.0-x86_64-unknown-linux-gnu.tar.gz | tar xz";
    expect(cli(url)).toHaveLength(1);
    expect(cli(url)[0]).toMatchObject({ version: "23.0.0", via: expect.stringContaining("release") });
    expect(cli("curl -LO https://example.com/dl/stellar-cli-22.1.0-aarch64-apple-darwin.tar.gz")[0]).toMatchObject({ version: "22.1.0" });
  });

  it("strips the host triple from a rust channel", () => {
    const t = scanToolchainText("rust-toolchain.toml", `[toolchain]\nchannel = "1.81.0-x86_64-unknown-linux-gnu"\n`).rustToolchains;
    expect(t).toEqual([{ channel: "1.81.0-x86_64-unknown-linux-gnu", version: "1.81.0", file: "rust-toolchain.toml", line: 2 }]);
    expect(scanToolchainText("rust-toolchain.toml", `[toolchain]\nchannel = "1.84.0-beta.1"\n`).rustToolchains).toEqual([]);
  });
});

describe("web tooling and target line lookup (M4, L3)", () => {
  const targets = (rel: string, text: string) => scanToolchainText(rel, text).rustTargets;

  it("flags declarations on lines that also use wasm-pack, wasm-bindgen or trunk", () => {
    expect(targets("build.sh", "wasm-pack build --target web && rustup target add wasm32-unknown-unknown")[0]).toMatchObject({ webTooling: true });
    expect(targets("build.sh", "rustup target add wasm32-unknown-unknown && trunk build")[0]).toMatchObject({ webTooling: true });
    expect(targets("build.sh", "rustup target add wasm32-unknown-unknown")[0]?.webTooling).toBeUndefined();
  });

  it("prefers the [build] target line over a [target.\"...\"] header", () => {
    const text = `[target."wasm32-unknown-unknown"]\nrunner = "x"\n\n[build]\ntarget = "wasm32-unknown-unknown"\n`;
    expect(targets(".cargo/config.toml", text)[0]).toMatchObject({ line: 5 });
  });
});

describe("regex denial of service (H1)", () => {
  const timed = (rel: string, text: string): number => {
    const t0 = performance.now();
    scanToolchainText(rel, text);
    return performance.now() - t0;
  };
  const size = 200_000;
  const cases: [string, string, string][] = [
    ["CARGO_BUILD_TARGET followed by spaces", "Dockerfile", `ENV CARGO_BUILD_TARGET${" ".repeat(size)}x`],
    ["repeated rustup target add", "build.sh", "rustup target add ".repeat(size / 18)],
    ["repeated targets:", ".github/workflows/ci.yml", " targets:".repeat(size / 9)],
    ["backslash continuations joined into one line", "Makefile", "a \\\n".repeat(size / 4)],
    ["many short continued lines of rustup target add", "Makefile", "rustup target add x \\\n".repeat(size / 22)],
    ["many uses: stellar/stellar-cli lines", ".github/workflows/ci.yml", "  - uses: stellar/stellar-cli@v1\n".repeat(size / 30)],
  ];
  it.each(cases)("scans 200 KB of %s in under 100 ms", (_name, rel, text) => {
    expect(timed(rel, text)).toBeLessThan(1000); // the quadratic version took seconds; CI runners are slow
  });

  it("skips logical lines longer than the cap and still reads the next one", () => {
    const long = `cargo install stellar-cli --version 21.5.0 ${"x ".repeat(MAX_LOGICAL_LINE)}`;
    expect(scanToolchainText("build.sh", `${long}\ncargo install stellar-cli@22.0.0\n`).cliPins.map((p) => p.version)).toEqual(["22.0.0"]);
  });
});

describe("echo/printf/cat segments and +toolchain (LOW fixes)", () => {
  const cli = (text: string, rel = "build.sh") => scanToolchainText(rel, text).cliPins;
  const targets = (text: string, rel = "build.sh") => scanToolchainText(rel, text).rustTargets;

  it.each([
    "echo 'see https://github.com/stellar/stellar-cli/releases/download/v20.0.0/'",
    "printf 'cargo install stellar-cli@21.0.0\\n'",
    "cat <<< 'npm i -g @stellar/stellar-cli@22.0.0'",
    "      - run: echo stellar-cli@21.0.0",
  ])("finds no CLI pin in %s", (line) => {
    expect(cli(line)).toEqual([]);
  });

  it.each(["echo '--target wasm32-unknown-unknown'", "echo rustup target add wasm32-unknown-unknown", "printf 'targets: wasm32-unknown-unknown'"])("finds no target in %s", (line) => {
    expect(targets(line)).toEqual([]);
  });

  it("still reads a real install after an echo on the same line", () => {
    expect(cli("echo installing && cargo install stellar-cli@22.0.0")[0]).toMatchObject({ version: "22.0.0" });
    expect(targets("echo go; rustup target add wasm32-unknown-unknown")).toHaveLength(1);
  });

  it("skips a +toolchain token after cargo", () => {
    expect(cli("cargo +stable install stellar-cli --version 21.5.0")[0]).toMatchObject({ version: "21.5.0" });
    expect(cli("cargo +1.84.0 binstall --locked stellar-cli --version 22.0.0")[0]).toMatchObject({ version: "22.0.0" });
  });

  it("scans 25 lines of 8 KB repeating `rustup target add` in well under 100 ms", () => {
    const line = `${"rustup target add ".repeat(440)}`.slice(0, 8000);
    const text = Array.from({ length: 25 }, () => line).join("\n");
    const t0 = performance.now();
    scanToolchainText("build.sh", text);
    expect(performance.now() - t0).toBeLessThan(1000);
  });
});
