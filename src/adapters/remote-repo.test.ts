import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { gzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseRepoSource, type RemoteSource } from "../core/remote-source.js";
import { stripCredentials, withRemoteRepo, type RemoteExec, type RemoteFetch } from "./remote-repo.js";

const run = promisify(execFile);
const gh = (s: string): RemoteSource => parseRepoSource(s) as RemoteSource;

let scratch: string;
beforeEach(async () => {
  scratch = await mkdtemp(join(tmpdir(), "kw-rr-test-"));
});
afterEach(async () => {
  await rm(scratch, { recursive: true, force: true });
});

const exists = (p: string) => stat(p).then(() => true, () => false);

interface Call {
  file: string;
  args: string[];
  opts: { env: NodeJS.ProcessEnv; timeout: number; killSignal: string };
}
function fakeExec(calls: Call[], fail?: (c: Call) => Error | undefined): RemoteExec {
  return async (file, args, opts) => {
    const call = { file, args, opts } as Call;
    calls.push(call);
    const err = fail?.(call);
    if (err) throw err;
    const dest = args[args.length - 1] as string;
    await mkdir(dest, { recursive: true });
    await writeFile(join(dest, "Cargo.toml"), "[package]\n");
    return { stdout: "", stderr: "" };
  };
}
const spawnErr = (code: string, extra: Record<string, unknown> = {}) => Object.assign(new Error(`spawn ${code}`), { code, ...extra });

describe("withRemoteRepo (git path, faked exec)", () => {
  it("runs a hardened shallow clone and removes the temp dir", async () => {
    const calls: Call[] = [];
    let seen = "";
    const out = await withRemoteRepo(gh("https://github.com/o/r/tree/dev"), { exec: fakeExec(calls) }, async (dir) => {
      seen = dir;
      expect(await readFile(join(dir, "Cargo.toml"), "utf8")).toBe("[package]\n");
      const mode = (await stat(join(dir, ".."))).mode & 0o777;
      expect(mode).toBe(0o700);
      return 42;
    });
    expect(out).toBe(42);
    expect(calls).toHaveLength(1);
    const c = calls[0] as Call;
    expect(c.file).toBe("git");
    expect(c.args).toEqual([
      "-c", "core.symlinks=false",
      "-c", "http.followRedirects=false",
      "-c", "filter.lfs.process=",
      "-c", "filter.lfs.smudge=",
      "-c", "filter.lfs.required=false",
      "-c", "protocol.allow=never",
      "-c", "protocol.https.allow=always",
      "clone", "--depth", "1", "--single-branch", "--branch", "dev", "--no-tags",
      "--", "https://github.com/o/r.git", c.args[c.args.length - 1],
    ]);
    expect(c.args[c.args.length - 1]).toMatch(/kedgeway-[^/]+\/repo$/);
    expect(c.opts.env["GIT_TERMINAL_PROMPT"]).toBe("0");
    expect(c.opts.env["GIT_LFS_SKIP_SMUDGE"]).toBe("1");
    expect(c.opts.timeout).toBe(60_000);
    expect(c.opts.killSignal).toBe("SIGKILL");
    expect(await exists(seen)).toBe(false);
  });

  it("omits --branch without a ref and takes opts.ref", async () => {
    const calls: Call[] = [];
    await withRemoteRepo(gh("o/r"), { exec: fakeExec(calls) }, async () => undefined);
    expect(calls[0]?.args).not.toContain("--branch");
    expect(calls[0]?.args).toContain("protocol.https.allow=always");
    await withRemoteRepo(gh("o/r"), { exec: fakeExec(calls), ref: "v1" }, async () => undefined);
    const a = calls[1]?.args ?? [];
    expect(a.slice(a.indexOf("clone"), a.indexOf("clone") + 6)).toEqual(["clone", "--depth", "1", "--single-branch", "--branch", "v1"]);
  });

  it("rejects conflicting refs and unsafe refs before running anything", async () => {
    const calls: Call[] = [];
    await expect(withRemoteRepo(gh("https://github.com/o/r/tree/a"), { exec: fakeExec(calls), ref: "b" }, async () => 1)).rejects.toThrow(/conflict/);
    await expect(withRemoteRepo(gh("o/r"), { exec: fakeExec(calls), ref: "--upload-pack=x" }, async () => 1)).rejects.toThrow(/ref/);
    expect(calls).toHaveLength(0);
  });

  it("removes the temp dir when fn throws", async () => {
    let seen = "";
    await expect(
      withRemoteRepo(gh("o/r"), { exec: fakeExec([]) }, async (dir) => {
        seen = dir;
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await exists(seen)).toBe(false);
  });

  it("surfaces stderr with credentials stripped, and cleans up", async () => {
    const calls: Call[] = [];
    const e = spawnErr("128", { stderr: "fatal: unable to access 'https://user:s3cret@github.com/o/r.git/': 403\n" });
    const p = withRemoteRepo(gh("o/r"), { exec: fakeExec(calls, () => e) }, async () => 1);
    await expect(p).rejects.toThrow(/could not clone github\.com\/o\/r.*403/s);
    await expect(p).rejects.not.toThrow(/s3cret/);
  });

  it("reports a timeout", async () => {
    const e = spawnErr("ETIMEDOUT", { killed: true, signal: "SIGKILL" });
    await expect(withRemoteRepo(gh("o/r"), { exec: fakeExec([], () => e) }, async () => 1)).rejects.toThrow(/timed out after 60 s/);
  });

  it("does not fall back to the tarball on non-ENOENT errors", async () => {
    let fetched = 0;
    const fetch: RemoteFetch = async () => {
      fetched += 1;
      return new Response("x");
    };
    const e = spawnErr("128", { stderr: "fatal: repository not found" });
    await expect(withRemoteRepo(gh("o/r"), { exec: fakeExec([], () => e), fetch }, async () => 1)).rejects.toThrow(/repository not found/);
    expect(fetched).toBe(0);
  });
});

describe("withRemoteRepo hardening", () => {
  it("enables only the protocol of the clone url", async () => {
    const calls: Call[] = [];
    await withRemoteRepo(gh("http://github.com/o/r"), { exec: fakeExec(calls) }, async () => 1);
    await withRemoteRepo(gh("git@github.com:o/r.git"), { exec: fakeExec(calls) }, async () => 1);
    await withRemoteRepo(gh("ssh://git@github.com/o/r"), { exec: fakeExec(calls) }, async () => 1);
    expect(calls[0]?.args).toContain("protocol.http.allow=always");
    expect(calls[0]?.args).not.toContain("protocol.https.allow=always");
    expect(calls[1]?.args).toContain("protocol.ssh.allow=always");
    expect(calls[2]?.args).toContain("protocol.ssh.allow=always");
    expect(calls[1]?.args).not.toContain("protocol.http.allow=always");
  });

  it("sets BatchMode ssh only when GIT_SSH_COMMAND is not already set", async () => {
    const calls: Call[] = [];
    const saved = process.env["GIT_SSH_COMMAND"];
    try {
      delete process.env["GIT_SSH_COMMAND"];
      await withRemoteRepo(gh("o/r"), { exec: fakeExec(calls) }, async () => 1);
      expect(calls[0]?.opts.env["GIT_SSH_COMMAND"]).toBe("ssh -oBatchMode=yes");
      process.env["GIT_SSH_COMMAND"] = "ssh -i /my/key";
      await withRemoteRepo(gh("o/r"), { exec: fakeExec(calls) }, async () => 1);
      expect(calls[1]?.opts.env["GIT_SSH_COMMAND"]).toBe("ssh -i /my/key");
    } finally {
      if (saved === undefined) delete process.env["GIT_SSH_COMMAND"];
      else process.env["GIT_SSH_COMMAND"] = saved;
    }
  });

  it("handles 200 KB of hostile stderr quickly and strips credentials", async () => {
    const hostile = `https://${"a".repeat(100_000)}`.concat("://".repeat(30_000), " https://u:pw@h/x ");
    const e = spawnErr("128", { stderr: hostile });
    const t0 = performance.now();
    await expect(withRemoteRepo(gh("o/r"), { exec: fakeExec([], () => e) }, async () => 1)).rejects.toThrow(/could not clone/);
    expect(performance.now() - t0).toBeLessThan(50);
    expect(stripCredentials("see https://u:pw@h/x now")).toBe("see https://***@h/x now");
    const t1 = performance.now();
    stripCredentials("a".repeat(200_000));
    stripCredentials("x://".repeat(50_000));
    expect(performance.now() - t1).toBeLessThan(50);
  });

  it("replaces the temp dir path with the display name in error details", async () => {
    const e = spawnErr("128", { stderr: "fatal: could not create work tree dir at the clone dir" });
    let dest = "";
    const exec: RemoteExec = async (_f, args) => {
      dest = args[args.length - 1] as string;
      throw Object.assign(new Error("x"), { code: 128, stderr: `fatal: destination ${dest} failed in ${join(dest, "..")}` });
    };
    void e;
    const err = await withRemoteRepo(gh("o/r"), { exec }, async () => 1).catch((x: Error) => x);
    expect((err as Error).message).toContain("github.com/o/r");
    expect((err as Error).message).not.toContain(dest);
    expect((err as Error).message).not.toMatch(/kedgeway-/);
  });

  it("distinguishes a maxBuffer overflow from a timeout", async () => {
    const e = spawnErr("ERR_CHILD_PROCESS_STDIO_MAXBUFFER", { killed: true });
    await expect(withRemoteRepo(gh("o/r"), { exec: fakeExec([], () => e) }, async () => 1)).rejects.toThrow(/too much output/);
  });
});

function tarOf(files: Record<string, string>): Buffer {
  const parts: Buffer[] = [];
  for (const [name, body] of Object.entries(files)) {
    const data = Buffer.from(body);
    const h = Buffer.alloc(512);
    h.write(name, 0);
    h.write("0000644\0", 100);
    h.write(`${data.length.toString(8).padStart(11, "0")}\0`, 124);
    h.write("        ", 148);
    h.write("0", 156);
    h.write("ustar\0" + "00", 257);
    let sum = 0;
    for (const b of h) sum += b;
    h.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148);
    parts.push(h, data, Buffer.alloc((512 - (data.length % 512)) % 512));
  }
  parts.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(parts));
}

describe("withRemoteRepo (tarball fallback)", () => {
  const noGit = () => spawnErr("ENOENT", { errno: -2 });

  it("fetches codeload for github when git is missing", async () => {
    const urls: string[] = [];
    const fetch: RemoteFetch = async (url) => {
      urls.push(String(url));
      return new Response(new Uint8Array(tarOf({ "o-r-abc/Cargo.toml": "[package]\n" })));
    };
    let seen = "";
    await withRemoteRepo(gh("https://github.com/o/r/tree/main"), { exec: fakeExec([], noGit), fetch }, async (dir) => {
      seen = dir;
      expect(await readFile(join(dir, "Cargo.toml"), "utf8")).toBe("[package]\n");
    });
    expect(urls).toEqual(["https://codeload.github.com/o/r/tar.gz/main"]);
    expect(await exists(seen)).toBe(false);
  });

  it("uses HEAD when there is no ref", async () => {
    const urls: string[] = [];
    const fetch: RemoteFetch = async (url) => {
      urls.push(String(url));
      return new Response(new Uint8Array(tarOf({ "t/a": "x" })));
    };
    await withRemoteRepo(gh("o/r"), { exec: fakeExec([], noGit), fetch }, async () => undefined);
    expect(urls).toEqual(["https://codeload.github.com/o/r/tar.gz/HEAD"]);
  });

  it("rejects a declared content-length over 50 MB without consuming the body", async () => {
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        pulls += 1;
        c.enqueue(new Uint8Array(10));
      },
    });
    const fetch: RemoteFetch = async () => new Response(body, { headers: { "content-length": String(60 * 1024 * 1024) } });
    await expect(withRemoteRepo(gh("o/r"), { exec: fakeExec([], noGit), fetch }, async () => 1)).rejects.toThrow(/too large/);
    expect(pulls).toBeLessThanOrEqual(1); // only the stream's own initial fill, never consumed
  });

  it("stops streaming once the body exceeds the cap, even with no content-length", async () => {
    let chunks = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        chunks += 1;
        c.enqueue(new Uint8Array(1024 * 1024));
        if (chunks > 200) c.close();
      },
    });
    const fetch: RemoteFetch = async () => new Response(body);
    await expect(withRemoteRepo(gh("o/r"), { exec: fakeExec([], noGit), fetch }, async () => 1)).rejects.toThrow(/too large/);
    expect(chunks).toBeLessThan(100);
  });

  it("fails clearly for a non-github host without git", async () => {
    const fetch: RemoteFetch = async () => new Response("x");
    await expect(withRemoteRepo(gh("https://gitlab.com/g/r"), { exec: fakeExec([], noGit), fetch }, async () => 1)).rejects.toThrow(/git is not installed/);
  });

  it("surfaces http errors and cleans up", async () => {
    const fetch: RemoteFetch = async () => new Response("nope", { status: 404 });
    await expect(withRemoteRepo(gh("o/r"), { exec: fakeExec([], noGit), fetch }, async () => 1)).rejects.toThrow(/404/);
  });

  it("rejects a hostile archive", async () => {
    const fetch: RemoteFetch = async () => new Response(new Uint8Array(tarOf({ "t/../../evil": "x" })));
    await expect(withRemoteRepo(gh("o/r"), { exec: fakeExec([], noGit), fetch }, async () => 1)).rejects.toThrow(/unsafe path/);
  });
});

describe("withRemoteRepo (real git, local bare repo)", () => {
  it("clones a bare repo end to end without the network", async () => {
    const bare = join(scratch, "bare.git");
    const work = join(scratch, "work");
    await run("git", ["init", "--bare", "-q", "-b", "main", bare]);
    await run("git", ["init", "-q", "-b", "main", work]);
    await run("git", ["config", "user.email", "t@example.com"], { cwd: work });
    await run("git", ["config", "user.name", "t"], { cwd: work });
    await writeFile(join(work, "Cargo.toml"), '[package]\nname = "x"\nversion = "0.1.0"\n');
    await run("git", ["add", "."], { cwd: work });
    await run("git", ["commit", "-q", "-m", "init"], { cwd: work });
    await run("git", ["push", "-q", bare, "main"], { cwd: work });
    const source: RemoteSource = { kind: "remote", cloneUrl: `file://${bare}`, host: "local", owner: "t", repo: "bare", display: "local/t/bare" };
    let seen = "";
    const text = await withRemoteRepo(source, { ref: "main", extraProtocols: ["file"] }, async (dir) => {
      seen = dir;
      expect(await exists(join(dir, ".git"))).toBe(true);
      return readFile(join(dir, "Cargo.toml"), "utf8");
    });
    expect(text).toContain('name = "x"');
    expect(await exists(seen)).toBe(false);
  });
});
