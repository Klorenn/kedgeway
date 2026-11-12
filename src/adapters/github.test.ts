import { describe, expect, it } from "vitest";
import { createGithubClient, GithubError, type GhFetch } from "./github.js";

const TOKEN = "ghs_SuperSecretToken123";

interface Req {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

function scripted(responses: (Response | Error | ((r: Req) => Response))[]): { fetch: GhFetch; reqs: Req[] } {
  const reqs: Req[] = [];
  let i = 0;
  return {
    reqs,
    fetch: async (url, init) => {
      const req: Req = { method: init.method, url, headers: init.headers, body: init.body === undefined ? undefined : JSON.parse(init.body) };
      reqs.push(req);
      const r = responses[Math.min(i, responses.length - 1)] as Response | Error | ((r: Req) => Response);
      i += 1;
      if (r instanceof Error) throw r;
      return typeof r === "function" ? r(req) : r;
    },
  };
}
const json = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const client = (f: GhFetch, extra: Record<string, unknown> = {}) => createGithubClient({ token: TOKEN, repo: "o/r", fetch: f, sleep: async () => {}, ...extra });

describe("github client", () => {
  it("sends the token as a bearer header to api.github.com", async () => {
    const s = scripted([json(200, { full_name: "o/r", default_branch: "trunk", html_url: "https://github.com/o/r" })]);
    expect(await client(s.fetch).getDefaultBranch()).toBe("trunk");
    expect(s.reqs[0]?.url).toBe("https://api.github.com/repos/o/r");
    expect(s.reqs[0]?.headers["Authorization"]).toBe(`Bearer ${TOKEN}`);
    expect(s.reqs[0]?.headers["Accept"]).toBe("application/vnd.github+json");
    expect(s.reqs[0]?.headers["User-Agent"]).toMatch(/kedgeway/);
  });

  it("getRepo maps the response", async () => {
    const s = scripted([json(200, { full_name: "o/r", default_branch: "main", html_url: "https://github.com/o/r" })]);
    expect(await client(s.fetch).getRepo()).toEqual({ fullName: "o/r", defaultBranch: "main", htmlUrl: "https://github.com/o/r" });
  });

  it("findOpenPr asks for open PRs of this owner's branch and matches the head ref exactly", async () => {
    const s = scripted([
      json(200, [
        { number: 9, html_url: "u9", state: "open", head: { ref: "kedgeway/migrate-28" }, base: { ref: "main" } },
        { number: 4, html_url: "u4", state: "open", head: { ref: "kedgeway/migrate-28" }, base: { ref: "main" } },
        { number: 3, html_url: "u3", state: "open", head: { ref: "kedgeway/migrate-28" }, base: { ref: "dev" } },
        { number: 5, html_url: "u5", state: "open", head: { ref: "other" }, base: { ref: "main" } },
        { number: 2, html_url: "u2", state: "closed", head: { ref: "kedgeway/migrate-28" }, base: { ref: "main" } },
      ]),
    ]);
    const pr = await client(s.fetch).findOpenPr("kedgeway/migrate-28", "main");
    expect(s.reqs[0]?.url).toBe("https://api.github.com/repos/o/r/pulls?state=open&head=o%3Akedgeway%2Fmigrate-28&base=main&per_page=100");
    expect(pr).toEqual({ number: 4, url: "u4", state: "open", headRef: "kedgeway/migrate-28", baseRef: "main" });
  });

  it("findOpenPr returns null when nothing matches", async () => {
    expect(await client(scripted([json(200, [])]).fetch).findOpenPr("x")).toBeNull();
  });

  it("createPr posts title, body, head, base and draft", async () => {
    const s = scripted([json(201, { number: 12, html_url: "https://github.com/o/r/pull/12", state: "open", head: { ref: "b" } })]);
    const pr = await client(s.fetch).createPr({ title: "t", body: "b", head: "b", base: "main", draft: true });
    expect(s.reqs[0]).toMatchObject({ method: "POST", url: "https://api.github.com/repos/o/r/pulls", body: { title: "t", body: "b", head: "o:b", base: "main", draft: true } });
    expect(pr.number).toBe(12);
    expect(pr.url).toBe("https://github.com/o/r/pull/12");
  });

  it("updatePr patches title and body only", async () => {
    const s = scripted([json(200, { number: 12, html_url: "u", state: "open", head: { ref: "b" } })]);
    await client(s.fetch).updatePr(12, { title: "t2", body: "b2" });
    expect(s.reqs[0]).toMatchObject({ method: "PATCH", url: "https://api.github.com/repos/o/r/pulls/12", body: { title: "t2", body: "b2" } });
  });

  it("addLabels creates the label first, ignores 422, then applies it", async () => {
    const s = scripted([json(422, { message: "Validation Failed", errors: [{ code: "already_exists" }] }), json(200, [{ name: "kedgeway" }])]);
    await client(s.fetch).addLabels(12, ["kedgeway"]);
    expect(s.reqs[0]).toMatchObject({ method: "POST", url: "https://api.github.com/repos/o/r/labels" });
    expect((s.reqs[0]?.body as { name: string }).name).toBe("kedgeway");
    expect(s.reqs[1]).toMatchObject({ method: "POST", url: "https://api.github.com/repos/o/r/issues/12/labels", body: { labels: ["kedgeway"] } });
  });

  it("addLabels propagates a 403 when creating the label", async () => {
    const s = scripted([json(403, { message: "Resource not accessible by integration" })]);
    await expect(client(s.fetch).addLabels(12, ["kedgeway"])).rejects.toThrow(/403/);
  });

  it("retries once on a 5xx and then succeeds", async () => {
    const s = scripted([json(502, { message: "Bad Gateway" }), json(200, { full_name: "o/r", default_branch: "main", html_url: "h" })]);
    expect(await client(s.fetch).getDefaultBranch()).toBe("main");
    expect(s.reqs).toHaveLength(2);
  });

  it("never retries a write on a 5xx (it may have been applied)", async () => {
    const s = scripted([json(502, { message: "Bad Gateway" }), json(201, { number: 1, html_url: "u", state: "open", head: { ref: "b" } })]);
    await expect(client(s.fetch).createPr({ title: "t", body: "b", head: "b", base: "main" })).rejects.toThrow(/502/);
    expect(s.reqs).toHaveLength(1);
  });

  it("refuses redirects so the token cannot follow one", async () => {
    const s = scripted([json(200, { full_name: "o/r", default_branch: "main", html_url: "h" })]);
    let redirect: string | undefined;
    const f: GhFetch = (u, init) => {
      redirect = init.redirect;
      return s.fetch(u, init);
    };
    await client(f).getRepo();
    expect(redirect).toBe("error");
  });

  it("gives up after the second 5xx, with the status in the error", async () => {
    const s = scripted([json(503, { message: "down" })]);
    const p = client(s.fetch).getRepo();
    await expect(p).rejects.toThrow(/503/);
    expect(s.reqs).toHaveLength(2);
  });

  it("does not retry a 4xx", async () => {
    const s = scripted([json(404, { message: "Not Found" })]);
    await expect(client(s.fetch).getRepo()).rejects.toThrow(/404/);
    expect(s.reqs).toHaveLength(1);
  });

  it("explains the 403 from the Actions PR policy and never leaks the token", async () => {
    const s = scripted([json(403, { message: `GitHub Actions is not permitted to create or approve pull requests. ${TOKEN}` })]);
    const e = (await client(s.fetch).createPr({ title: "t", body: "b", head: "h", base: "main" }).catch((x: unknown) => x)) as GithubError;
    expect(e).toBeInstanceOf(GithubError);
    expect(e.status).toBe(403);
    expect(e.message).toMatch(/not permitted to create or approve pull requests/);
    expect(e.message).toMatch(/Allow GitHub Actions to create and approve pull requests/i);
    expect(e.message).toMatch(/pull-requests: write/);
    expect(e.message).not.toContain(TOKEN);
  });

  it("explains a 401", async () => {
    const e = (await client(scripted([json(401, { message: "Bad credentials" })]).fetch).getRepo().catch((x: unknown) => x)) as Error;
    expect(e.message).toMatch(/401/);
    expect(e.message).toMatch(/token/i);
  });

  it("includes validation details of a 422", async () => {
    const s = scripted([json(422, { message: "Validation Failed", errors: [{ message: "A pull request already exists for o:b." }] })]);
    await expect(client(s.fetch).createPr({ title: "t", body: "b", head: "b", base: "main" })).rejects.toThrow(/already exists/);
  });

  it("times out and says so, without the token", async () => {
    const hang: GhFetch = (_u, init) =>
      new Promise((_res, rej) => {
        init.signal?.addEventListener("abort", () => rej(Object.assign(new Error(`aborted ${TOKEN}`), { name: "TimeoutError" })));
      });
    const e = (await client(hang, { timeoutMs: 20 }).getRepo().catch((x: unknown) => x)) as Error;
    expect(e.message).toMatch(/timed out/);
    expect(e.message).not.toContain(TOKEN);
  });

  it("wraps network errors without the token", async () => {
    const e = (await client(scripted([new Error(`connect ECONNREFUSED ${TOKEN}`)]).fetch).getRepo().catch((x: unknown) => x)) as Error;
    expect(e.message).toMatch(/ECONNREFUSED/);
    expect(e.message).not.toContain(TOKEN);
  });

  it("validates inputs", () => {
    const f = scripted([json(200, {})]).fetch;
    expect(() => createGithubClient({ token: "", repo: "o/r", fetch: f })).toThrow(/token/i);
    expect(() => createGithubClient({ token: "a b\n", repo: "o/r", fetch: f })).toThrow(/token/i);
    expect(() => createGithubClient({ token: TOKEN, repo: "nope", fetch: f })).toThrow(/owner\/repo/);
    expect(() => createGithubClient({ token: TOKEN, repo: "o/r", fetch: f, apiBase: "http://evil.example" })).toThrow(/api base/i);
    expect(() => createGithubClient({ token: TOKEN, repo: "o/r", fetch: f, apiBase: "http://127.0.0.1:1234" })).not.toThrow();
    expect(() => createGithubClient({ token: TOKEN, repo: "o/r", fetch: f, apiBase: "https://ghe.example/api/v3" })).not.toThrow();
  });

  it("uses a custom api base (trailing slash trimmed)", async () => {
    const s = scripted([json(200, { full_name: "o/r", default_branch: "main", html_url: "h" })]);
    await client(s.fetch, { apiBase: "http://127.0.0.1:9999/" }).getRepo();
    expect(s.reqs[0]?.url).toBe("http://127.0.0.1:9999/repos/o/r");
  });
});
