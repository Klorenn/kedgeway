import { describe, expect, it } from "vitest";
import { refreshLockfiles, type RefreshExec } from "./lockfile-refresh.js";

let yarnVersion = "4.1.0";
function fake(behave: (file: string, args: string[]) => Error | undefined = () => undefined) {
  const calls: { file: string; args: string[]; cwd: string; env: NodeJS.ProcessEnv }[] = [];
  const exec: RefreshExec = async (file, args, opts) => {
    calls.push({ file, args, cwd: opts.cwd, env: opts.env });
    const e = behave(file, args);
    if (e) throw e;
    return { stdout: file === "yarn" && args[0] === "--version" ? `${yarnVersion}\n` : "", stderr: "" };
  };
  return { exec, calls };
}

describe("refreshLockfiles", () => {
  it("runs nothing when the plan touched no lockfile", async () => {
    const f = fake();
    expect(await refreshLockfiles("/r", [], { exec: f.exec })).toEqual({ refreshed: [], notes: [] });
    expect(f.calls).toHaveLength(0);
  });

  it("runs the lockfile-only command for each touched lockfile, in the repo root", async () => {
    const f = fake();
    const r = await refreshLockfiles("/r", ["Cargo.lock", "package-lock.json", "pnpm-lock.yaml", "yarn.lock"], { exec: f.exec });
    expect(f.calls.map((c) => [c.file, ...c.args])).toEqual([
      ["cargo", "update", "-p", "soroban-sdk"],
      ["npm", "install", "--package-lock-only", "--ignore-scripts"],
      ["pnpm", "install", "--lockfile-only", "--ignore-scripts"],
      ["yarn", "--version"],
      ["yarn", "install", "--mode", "update-lockfile"],
    ]);
    expect(f.calls.every((c) => c.cwd === "/r")).toBe(true);
    expect(r.refreshed).toEqual(["Cargo.lock", "package-lock.json", "pnpm-lock.yaml", "yarn.lock"]);
    expect(r.notes).toEqual([]);
  });

  it("only touches the lockfiles it was given", async () => {
    const f = fake();
    await refreshLockfiles("/r", ["Cargo.lock"], { exec: f.exec });
    expect(f.calls).toHaveLength(1);
  });

  it("a missing tool becomes a note, not a crash", async () => {
    const f = fake((file) => (file === "pnpm" ? Object.assign(new Error("spawn pnpm ENOENT"), { code: "ENOENT" }) : undefined));
    const r = await refreshLockfiles("/r", ["pnpm-lock.yaml", "Cargo.lock"], { exec: f.exec });
    expect(r.refreshed).toEqual(["Cargo.lock"]);
    expect(r.notes).toHaveLength(1);
    expect(r.notes[0]).toMatch(/pnpm-lock\.yaml/);
    expect(r.notes[0]).toMatch(/pnpm is not installed/);
  });

  it("a failing command becomes a note with the first line of its error", async () => {
    const f = fake(() => Object.assign(new Error("Command failed"), { stderr: "error: no matching package\nmore detail\n" }));
    const r = await refreshLockfiles("/r", ["Cargo.lock"], { exec: f.exec });
    expect(r.refreshed).toEqual([]);
    expect(r.notes[0]).toMatch(/Cargo\.lock/);
    expect(r.notes[0]).toMatch(/cargo update -p soroban-sdk/);
    expect(r.notes[0]).toMatch(/no matching package/);
    expect(r.notes[0]).not.toMatch(/more detail/);
  });

  it("hands the package managers an allowlisted environment only", async () => {
    const f = fake();
    const secretish = { GITHUB_TOKEN: "t", GH_TOKEN: "t", KEDGEWAY_AUTH: "a", KW_TOKEN: "k", KW_AUTH: "k", ACTIONS_RUNTIME_TOKEN: "r", ACTIONS_ID_TOKEN_REQUEST_TOKEN: "r", NODE_AUTH_TOKEN: "n", AWS_SECRET_ACCESS_KEY: "s" };
    await refreshLockfiles("/r", ["Cargo.lock"], {
      exec: f.exec,
      env: { PATH: "/bin", HOME: "/h", TMPDIR: "/t", LANG: "C", LC_ALL: "C", HTTPS_PROXY: "p", no_proxy: "n", CARGO_HOME: "c", RUSTUP_HOME: "r", npm_config_cache: "x", CI: "true", ...secretish },
    });
    const env = f.calls[0]?.env ?? {};
    for (const k of ["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "HTTPS_PROXY", "no_proxy", "CARGO_HOME", "RUSTUP_HOME", "npm_config_cache", "CI"]) expect(env[k], k).toBeDefined();
    for (const k of Object.keys(secretish)) expect(env[k], k).toBeUndefined();
    expect(Object.keys(env).sort()).toEqual(["CARGO_HOME", "CI", "HOME", "HTTPS_PROXY", "LANG", "LC_ALL", "PATH", "RUSTUP_HOME", "TMPDIR", "no_proxy", "npm_config_cache"]);
  });

  it("yarn >= 2 runs with scripts disabled", async () => {
    yarnVersion = "4.1.0";
    const f = fake();
    await refreshLockfiles("/r", ["yarn.lock"], { exec: f.exec, env: { PATH: "/bin" } });
    const install = f.calls.find((c) => c.args[0] === "install");
    expect(install?.env["YARN_ENABLE_SCRIPTS"]).toBe("0");
  });

  it("yarn classic (1.x) is skipped with a note: it ignores --mode and runs install scripts", async () => {
    yarnVersion = "1.22.22";
    const f = fake();
    const r = await refreshLockfiles("/r", ["yarn.lock", "Cargo.lock"], { exec: f.exec, env: { PATH: "/bin" } });
    expect(f.calls.some((c) => c.file === "yarn" && c.args[0] === "install")).toBe(false);
    expect(r.refreshed).toEqual(["Cargo.lock"]);
    expect(r.notes[0]).toMatch(/yarn\.lock/);
    expect(r.notes[0]).toMatch(/classic|1\.x|Yarn 1/i);
    yarnVersion = "4.1.0";
  });

  it("an unreadable yarn version is a note, not a refresh", async () => {
    yarnVersion = "garbage";
    const f = fake();
    const r = await refreshLockfiles("/r", ["yarn.lock"], { exec: f.exec, env: { PATH: "/bin" } });
    expect(r.refreshed).toEqual([]);
    expect(r.notes[0]).toMatch(/yarn\.lock/);
    yarnVersion = "4.1.0";
  });
});
