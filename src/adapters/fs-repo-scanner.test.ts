import { mkdtemp, mkdir, writeFile, rm, chmod, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { scanRepo } from "./fs-repo-scanner.js";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "sd-scan-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function put(rel: string, content: string): Promise<void> {
  const full = join(dir, rel);
  await mkdir(join(full, ".."), { recursive: true });
  await writeFile(full, content);
}

describe("scanRepo", () => {
  it("returns empty facts for an empty directory", async () => {
    const facts = await scanRepo(dir);
    expect(facts).toEqual({ root: dir, rustDeps: [], jsDeps: [], manifestErrors: [] });
  });

  it("throws when the path does not exist or is not a directory", async () => {
    await expect(scanRepo(join(dir, "nope"))).rejects.toThrow(/nope/);
    await put("file.txt", "x");
    await expect(scanRepo(join(dir, "file.txt"))).rejects.toThrow(/not a directory/i);
  });

  it("detects string, table and dev-dependency forms with relative paths", async () => {
    await put("a/Cargo.toml", `[dependencies]\nsoroban-sdk = "21.0.0"\n`);
    await put(
      "b/Cargo.toml",
      `[dev-dependencies]\nsoroban-sdk = { version = "20.3.1", features = ["testutils"] }\n`,
    );
    const facts = await scanRepo(dir);
    const byFile = Object.fromEntries(facts.rustDeps.map((d) => [d.file, d.version]));
    expect(byFile).toEqual({ "a/Cargo.toml": "21.0.0", "b/Cargo.toml": "20.3.1" });
  });

  it("resolves workspace = true against the root Cargo.toml", async () => {
    await put(
      "Cargo.toml",
      `[workspace]\nmembers = ["contracts/*"]\n[workspace.dependencies]\nsoroban-sdk = "22.0.0"\n`,
    );
    await put("contracts/token/Cargo.toml", `[dependencies]\nsoroban-sdk = { workspace = true }\n`);
    const facts = await scanRepo(dir);
    expect(facts.rustDeps).toEqual([
      { name: "soroban-sdk", raw: "22.0.0", version: "22.0.0", major: 22, resolved: null, resolvedFrom: null, file: "contracts/token/Cargo.toml", line: 2, declaredIn: "Cargo.toml" },
    ]);
  });

  it("detects JS packages and keeps raw ranges", async () => {
    await put(
      "web/package.json",
      JSON.stringify({ dependencies: { "@stellar/stellar-sdk": "^13.0.0", "soroban-client": "1.0.0" } }),
    );
    const facts = await scanRepo(dir);
    expect(facts.jsDeps.map((d) => [d.name, d.raw, d.version, d.file])).toEqual(
      expect.arrayContaining([
        ["@stellar/stellar-sdk", "^13.0.0", "13.0.0", "web/package.json"],
        ["soroban-client", "1.0.0", "1.0.0", "web/package.json"],
      ]),
    );
  });

  it("skips node_modules, target, dist and .git", async () => {
    for (const skip of ["node_modules/x", "target/x", "dist/x", ".git/x", ".next/x", "vendor/x", "build/x", "coverage/x"]) {
      await put(`${skip}/Cargo.toml`, `[dependencies]\nsoroban-sdk = "1.0.0"\n`);
      await put(`${skip}/package.json`, JSON.stringify({ dependencies: { "stellar-sdk": "1.0.0" } }));
    }
    const facts = await scanRepo(dir);
    expect(facts.rustDeps).toEqual([]);
    expect(facts.jsDeps).toEqual([]);
  });

  it("respects max depth of 4", async () => {
    await put("a/b/c/d/Cargo.toml", `[dependencies]\nsoroban-sdk = "21.0.0"\n`); // depth 4 dirs -> ok
    await put("a/b/c/d/e/Cargo.toml", `[dependencies]\nsoroban-sdk = "20.0.0"\n`); // depth 5 -> skipped
    const facts = await scanRepo(dir);
    expect(facts.rustDeps.map((d) => d.file)).toEqual(["a/b/c/d/Cargo.toml"]);
  });

  it("never plans through symlinked manifests", async () => {
    await put("real/Cargo.toml", `[dependencies]\nsoroban-sdk = "21.0.0"\n`);
    await symlink(join(dir, "real/Cargo.toml"), join(dir, "Cargo.toml"));
    await mkdir(join(dir, "linked-dir-target"));
    await put("linked-dir-target/package.json", JSON.stringify({ dependencies: { "stellar-sdk": "1.0.0" } }));
    await symlink(join(dir, "linked-dir-target"), join(dir, "linked"));
    const facts = await scanRepo(dir);
    expect(facts.rustDeps.map((d) => d.file)).toEqual(["real/Cargo.toml"]);
    expect(facts.jsDeps.map((d) => d.file)).toEqual(["linked-dir-target/package.json"]);
  });

  it("reports unparseable manifests instead of silently ignoring them", async () => {
    await put("bad/Cargo.toml", "not = [valid");
    await put("web/package.json", "{nope");
    const facts = await scanRepo(dir);
    expect(facts.manifestErrors.map((e) => e.file).sort()).toEqual(["bad/Cargo.toml", "web/package.json"]);
    expect(facts.manifestErrors.every((e) => e.message.length > 0)).toBe(true);
  });

  it("continues past an unreadable directory and records it", async () => {
    await put("ok/Cargo.toml", `[dependencies]\nsoroban-sdk = "21.0.0"\n`);
    await put("locked/Cargo.toml", `[dependencies]\nsoroban-sdk = "20.0.0"\n`);
    await chmod(join(dir, "locked"), 0o000);
    try {
      const facts = await scanRepo(dir);
      expect(facts.rustDeps.map((d) => d.file)).toEqual(["ok/Cargo.toml"]);
      expect(facts.manifestErrors.map((e) => e.file)).toEqual(["locked"]);
    } finally {
      await chmod(join(dir, "locked"), 0o755);
    }
  });

  it("fills resolved/resolvedFrom from a lockfile", async () => {
    await put("Cargo.toml", `[dependencies]\nsoroban-sdk = "^21"\n`);
    await put("Cargo.lock", `[[package]]\nname = "soroban-sdk"\nversion = "21.7.6"\n`);
    const facts = await scanRepo(dir);
    expect(facts.rustDeps[0]).toMatchObject({ raw: "^21", resolved: "21.7.6", resolvedFrom: "Cargo.lock" });
  });
  describe("toolchain facts", () => {
    it("omits `toolchain` when nothing relevant is found", async () => {
      await put("Cargo.toml", `[dependencies]\nsoroban-sdk = "21.0.0"\n`);
      expect((await scanRepo(dir)).toolchain).toBeUndefined();
    });

    it("finds stellar-cli pins in workflows, Dockerfiles, Makefiles, scripts, .tool-versions and package.json", async () => {
      await put(".github/workflows/ci.yml", `jobs:\n  b:\n    steps:\n      - run: cargo install --locked stellar-cli --version 21.5.0\n`);
      await put(".github/workflows/rel.yaml", `steps:\n  - run: cargo binstall stellar-cli@22.0.0\n`);
      await put("Dockerfile.dev", `FROM rust:1.84\nRUN cargo install stellar-cli@23.0.1\n`);
      await put("Makefile", `setup:\n\tcargo install stellar-cli --version 20.0.0\n`);
      await put("deploy.sh", `cargo install stellar-cli@19.0.0\n`);
      await put("scripts/ci/x.sh", `cargo install stellar-cli@18.0.0\n`);
      await put(".tool-versions", `stellar-cli 17.0.0\n`);
      await put("package.json", `{\n  "devDependencies": {\n    "@stellar/stellar-cli": "^16.0.0"\n  }\n}\n`);
      const pins = (await scanRepo(dir)).toolchain?.cliPins ?? [];
      const got = pins.map((p) => `${p.file}:${p.line}=${p.version}/${p.source}`).sort();
      expect(got).toEqual(
        [
          ".github/workflows/ci.yml:4=21.5.0/workflow",
          ".github/workflows/rel.yaml:2=22.0.0/workflow",
          "Dockerfile.dev:2=23.0.1/dockerfile",
          "Makefile:2=20.0.0/makefile",
          "deploy.sh:1=19.0.0/script",
          "scripts/ci/x.sh:1=18.0.0/script",
          ".tool-versions:1=17.0.0/tool-versions",
          "package.json:3=16.0.0/package.json",
        ].sort(),
      );
    });

    it("does not read shell scripts outside the root and scripts/, or anything under ignored directories", async () => {
      await put("tools/x.sh", `cargo install stellar-cli@21.0.0\n`);
      await put("node_modules/pkg/Makefile", `\tcargo install stellar-cli@21.0.0\n`);
      await put("target/build.sh", `cargo install stellar-cli@21.0.0\n`);
      expect((await scanRepo(dir)).toolchain).toBeUndefined();
    });

    it("finds rust targets and the rust toolchain pin in rust-toolchain.toml, .cargo/config.toml and scripts", async () => {
      await put("rust-toolchain.toml", `[toolchain]\nchannel = "1.79.0"\ntargets = ["wasm32-unknown-unknown"]\n`);
      await put(".cargo/config.toml", `[build]\ntarget = "wasm32v1-none"\n`);
      await put("Makefile", `build:\n\tcargo build --target wasm32-unknown-unknown\n`);
      const tc = (await scanRepo(dir)).toolchain;
      expect(tc?.rustToolchains).toEqual([{ channel: "1.79.0", version: "1.79.0", file: "rust-toolchain.toml", line: 2 }]);
      expect(tc?.rustTargets.map((t) => `${t.file}:${t.line}=${t.target}`).sort()).toEqual(
        [".cargo/config.toml:2=wasm32v1-none", "Makefile:2=wasm32-unknown-unknown", "rust-toolchain.toml:3=wasm32-unknown-unknown"].sort(),
      );
    });

    it("reads a legacy rust-toolchain file and ignores broken toolchain TOML without a manifest error", async () => {
      await put("rust-toolchain", `1.80.1\n`);
      await put("sub/rust-toolchain.toml", `[toolchain\n`);
      const facts = await scanRepo(dir);
      expect(facts.toolchain?.rustToolchains).toEqual([{ channel: "1.80.1", version: "1.80.1", file: "rust-toolchain", line: 1 }]);
      expect(facts.manifestErrors).toEqual([]);
    });

    it("does not let a package.json parse error hide the error report", async () => {
      await put("package.json", "{nope");
      const facts = await scanRepo(dir);
      expect(facts.manifestErrors.map((e) => e.file)).toEqual(["package.json"]);
      expect(facts.toolchain).toBeUndefined();
    });
  });
});
