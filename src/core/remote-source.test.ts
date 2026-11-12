import { describe, expect, it } from "vitest";
import { parseRepoSource, validateRef } from "./remote-source.js";

const remote = (input: string) => {
  const s = parseRepoSource(input);
  if (s.kind !== "remote") throw new Error(`expected remote for ${input}`);
  return s;
};

describe("parseRepoSource: accepted", () => {
  it("parses a plain github https url", () => {
    expect(remote("https://github.com/stellar/soroban-examples")).toEqual({
      kind: "remote",
      cloneUrl: "https://github.com/stellar/soroban-examples.git",
      host: "github.com",
      owner: "stellar",
      repo: "soroban-examples",
      display: "github.com/stellar/soroban-examples",
    });
  });
  it("accepts .git and trailing slash", () => {
    expect(remote("https://github.com/o/r.git").repo).toBe("r");
    expect(remote("https://github.com/o/r/").repo).toBe("r");
    expect(remote("https://github.com/o/r.git/").cloneUrl).toBe("https://github.com/o/r.git");
  });
  it("takes the ref from /tree/<ref>/...", () => {
    const s = remote("https://github.com/o/r/tree/main/contracts/foo");
    expect(s.ref).toBe("main");
    expect(s.display).toBe("github.com/o/r@main");
  });
  it("parses gitlab nested groups and -/tree", () => {
    const s = remote("https://gitlab.com/g/sub/r/-/tree/dev");
    expect(s).toMatchObject({ host: "gitlab.com", owner: "g/sub", repo: "r", ref: "dev", cloneUrl: "https://gitlab.com/g/sub/r.git" });
    expect(remote("https://gitlab.com/g/sub/r").owner).toBe("g/sub");
  });
  it("parses scp-style and ssh urls", () => {
    expect(remote("git@github.com:o/r.git")).toMatchObject({ host: "github.com", owner: "o", repo: "r", cloneUrl: "git@github.com:o/r.git" });
    expect(remote("ssh://git@github.com/o/r.git")).toMatchObject({ host: "github.com", owner: "o", repo: "r", cloneUrl: "ssh://git@github.com/o/r.git" });
    expect(remote("ssh://git@git.example.com:2222/o/r").cloneUrl).toBe("ssh://git@git.example.com:2222/o/r.git");
  });
  it("treats o/r shorthand as github", () => {
    expect(remote("stellar/soroban-examples")).toMatchObject({ host: "github.com", cloneUrl: "https://github.com/stellar/soroban-examples.git" });
  });
});

describe("parseRepoSource: local", () => {
  it.each([".", "..", "./a/b", "../x", "/abs/path", "a", "a/b/c", "./o/r", "~/x", "C:\\x\\y", "C:/x"])("%s is local", (p) => {
    expect(parseRepoSource(p)).toEqual({ kind: "local" });
  });
});

describe("parseRepoSource: rejected", () => {
  it.each([
    ["file:///etc/passwd", /file:/],
    ["javascript:alert(1)", /javascript:/],
    ["ftp://github.com/o/r", /ftp/],
    ["git://github.com/o/r", /git/],
    ["https://user:pass@github.com/o/r", /credentials/],
    ["https://token@github.com/o/r", /credentials/],
    ["ssh://bob@github.com/o/r", /user/],
    ["bob@github.com:o/r.git", /user/],
    ["https://github.com/o", /owner\/repo/],
    ["https://github.com/o/../r", /owner\/repo/],
    ["git@github.com:o/../r.git", /invalid/],
    ["https://github.com/o/r/tree/-x", /ref/],
    ["https://github.com/o/r/tree/a%20b", /ref/],
  ])("%s", (input, msg) => {
    expect(() => parseRepoSource(input)).toThrow(msg);
  });
});

describe("validateRef", () => {
  it("accepts normal refs", () => {
    for (const r of ["main", "v1.2.3", "feature/x-y_z", "a.b"]) expect(validateRef(r)).toBe(r);
  });
  it.each(["", "-x", "--upload-pack=evil", "a b", "a;b", "a$(x)", "a..b", "a\nb", "a:b"])("rejects %j", (r) => {
    expect(() => validateRef(r)).toThrow(/ref/);
  });
});

describe("parseRepoSource: SSRF host rules", () => {
  it.each([
    "https://169.254.169.254/o/r",
    "https://127.0.0.1/o/r",
    "https://0x7f.1/o/r",
    "https://2130706433/o/r",
    "https://0177.0.0.1/o/r",
    "https://[::1]/o/r",
    "https://[fd00::1]/o/r",
    "https://localhost/o/r",
    "https://LOCALHOST./o/r",
    "https://intranet/o/r",
    "https://box.local/o/r",
    "https://svc.internal/o/r",
    "https://foo.localhost/o/r",
    "ssh://git@10.0.0.1/o/r",
    "git@127.0.0.1:o/r.git",
    "git@0x7f.1:o/r.git",
    "git@localhost:o/r.git",
    "git@host.internal:o/r.git",
  ])("rejects %s", (u) => {
    expect(() => parseRepoSource(u)).toThrow(/host/);
  });
  it("accepts named public hosts", () => {
    for (const u of ["https://github.com/o/r", "https://git.example.org/o/r", "ssh://git@git.example.org:2222/o/r", "git@bitbucket.org:o/r.git"]) {
      expect(parseRepoSource(u).kind).toBe("remote");
    }
  });
  it("allowHttp: false rejects http but not https/ssh", () => {
    expect(parseRepoSource("http://github.com/o/r").kind).toBe("remote");
    expect(() => parseRepoSource("http://github.com/o/r", { allowHttp: false })).toThrow(/http/);
    expect(parseRepoSource("https://github.com/o/r", { allowHttp: false }).kind).toBe("remote");
    expect(parseRepoSource("git@github.com:o/r.git", { allowHttp: false }).kind).toBe("remote");
  });
});

describe("parseRepoSource: messages never echo the raw input", () => {
  it.each([
    "https://user:SECRETPASS@github.com/o/r",
    "https://SECRETTOKEN@github.com/o/r",
    "ftp://SECRETHOST/SECRETPATH",
    "javascript:SECRETCODE",
    "https://github.com/SECRETONLY",
    "https://github.com/o/SEC%RET",
    "git@github.com:SEC RET",
    "bob@github.com:SECRETUSER/r",
    "https://github.com/o/r/tree/SECRET%20X",
  ])("%s", (u) => {
    try {
      parseRepoSource(u);
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as Error).message).not.toMatch(/SECRET/);
    }
  });
});
