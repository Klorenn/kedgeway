import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { auth, UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AuthStore, FileOAuthProvider, MemoryAuthStore, readOnlyAuthStore, withFileLock, type StoredAuth } from "./raven-auth.js";
import { openRavenSession, realConnectDeps } from "./raven-ecosystem.js";

/**
 * Drives the real SDK `auth()` against a fake authorization server that behaves like Raven:
 * refresh tokens rotate, and a stale refresh token is answered with `invalid_grant`.
 */
const SERVER = "https://raven.test/mcp";
const ISSUER = "https://raven.test";

interface FakeServer {
  fetchFn: typeof fetch;
  registrations: number;
  refreshes: string[];
}

function fakeRaven(token: (refreshToken: string) => { status: number; body: object }): FakeServer {
  const server: FakeServer = { registrations: 0, refreshes: [], fetchFn: undefined as unknown as typeof fetch };
  server.fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const json = (status: number, body: object): Response =>
      new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    if (url.pathname.startsWith("/.well-known/oauth-protected-resource")) {
      return json(200, { resource: SERVER, authorization_servers: [ISSUER], scopes_supported: ["mcp"] });
    }
    if (url.pathname.startsWith("/.well-known/oauth-authorization-server") || url.pathname.startsWith("/.well-known/openid-configuration")) {
      return json(200, {
        issuer: ISSUER,
        authorization_endpoint: `${ISSUER}/authorize`,
        token_endpoint: `${ISSUER}/token`,
        registration_endpoint: `${ISSUER}/register`,
        response_types_supported: ["code"],
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: ["none"],
      });
    }
    if (url.pathname === "/register") {
      server.registrations += 1;
      return json(201, { client_id: `registered-${server.registrations}`, redirect_uris: ["http://127.0.0.1:9/callback"] });
    }
    if (url.pathname === "/token") {
      const params = new URLSearchParams(String(init?.body ?? ""));
      const rt = params.get("refresh_token") ?? "";
      server.refreshes.push(rt);
      const r = token(rt);
      return json(r.status, r.body);
    }
    return json(404, {});
  }) as typeof fetch;
  return server;
}

const rotating = (rt: string) => ({
  status: 200,
  body: { access_token: `AT-from-${rt}`, token_type: "Bearer", expires_in: 3600, refresh_token: `${rt}+1` },
});
const revoked = () => ({ status: 400, body: { error: "invalid_grant", error_description: "Invalid refresh token" } });

const stored: StoredAuth = {
  clientInformation: { client_id: "cid", redirect_uris: ["http://127.0.0.1:1/callback"], issuer: ISSUER } as StoredAuth["clientInformation"],
  tokens: { access_token: "AT0", token_type: "Bearer", expires_in: 3600, refresh_token: "RT0", issuer: ISSUER } as StoredAuth["tokens"],
  codeVerifier: "old-verifier",
  callbackPort: 1,
};

let dir: string;
let file: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "kw-refresh-"));
  file = join(dir, "auth.json");
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const silent = (store: AuthStore): FileOAuthProvider =>
  new FileOAuthProvider(store, "http://127.0.0.1/callback", () => Promise.resolve(), { silent: true });

describe("silent session reuse against a rotating authorization server", () => {
  it("refreshes an expired session and persists the rotated tokens to auth.json", async () => {
    const store = new AuthStore(file);
    await store.update(stored);
    const raven = fakeRaven(rotating);
    await expect(auth(silent(store), { serverUrl: new URL(SERVER), fetchFn: raven.fetchFn })).resolves.toBe("AUTHORIZED");
    const after = await new AuthStore(file).load();
    expect(after.tokens?.refresh_token).toBe("RT0+1");
    expect(after.tokens?.access_token).toBe("AT-from-RT0");
    expect(after.clientInformation?.client_id).toBe("cid");
    expect(raven.registrations).toBe(0);
  });

  it("a revoked refresh token fails the silent attempt without deleting anything from auth.json", async () => {
    const store = new AuthStore(file);
    await store.update(stored);
    const raven = fakeRaven(revoked);
    await expect(auth(silent(store), { serverUrl: new URL(SERVER), fetchFn: raven.fetchFn })).resolves.toBe("REDIRECT");
    const after = await new AuthStore(file).load();
    expect(after.tokens?.refresh_token).toBe("RT0");
    expect(after.clientInformation?.client_id).toBe("cid");
    expect(after.codeVerifier).toBe("old-verifier");
    expect(raven.registrations).toBe(0);
  });

  it("a silent attempt with no stored client registration never registers a new client", async () => {
    const store = new AuthStore(file);
    await store.update({ tokens: stored.tokens! });
    const raven = fakeRaven(rotating);
    await expect(auth(silent(store), { serverUrl: new URL(SERVER), fetchFn: raven.fetchFn })).rejects.toBeInstanceOf(UnauthorizedError);
    expect(raven.registrations).toBe(0);
  });

  it("doctor's read-only store writes a rotated refresh token back, so the session in auth.json stays usable", async () => {
    await writeFile(file, JSON.stringify(stored));
    const store = await readOnlyAuthStore({}, file);
    const raven = fakeRaven((rt) => (rt === "RT0" ? rotating(rt) : revoked()));
    await expect(auth(silent(store), { serverUrl: new URL(SERVER), fetchFn: raven.fetchFn })).resolves.toBe("AUTHORIZED");
    const onDisk = JSON.parse(await readFile(file, "utf8")) as StoredAuth;
    expect(onDisk.tokens?.refresh_token).toBe("RT0+1");
    expect(onDisk.codeVerifier).toBe("old-verifier");
    expect(onDisk.clientInformation?.client_id).toBe("cid");
    expect(await readdir(dir)).toEqual(["auth.json"]);
  });

  it("KEDGEWAY_AUTH refreshes and rotates in memory only", async () => {
    const store = new MemoryAuthStore({ tokens: stored.tokens!, clientInformation: stored.clientInformation! }, file);
    const raven = fakeRaven(rotating);
    await expect(auth(silent(store), { serverUrl: new URL(SERVER), fetchFn: raven.fetchFn })).resolves.toBe("AUTHORIZED");
    expect((await store.load()).tokens?.refresh_token).toBe("RT0+1");
    await expect(auth(silent(store), { serverUrl: new URL(SERVER), fetchFn: raven.fetchFn })).resolves.toBe("AUTHORIZED");
    expect(raven.refreshes).toEqual(["RT0", "RT0+1"]);
    expect(await readdir(dir)).toEqual([]);
  });
});

describe("FileOAuthProvider.invalidateCredentials", () => {
  it("silent mode hides invalidated tokens for this attempt but leaves auth.json alone", async () => {
    const store = new AuthStore(file);
    await store.update(stored);
    const p = silent(store);
    expect(await p.tokens()).toBeDefined();
    await p.invalidateCredentials("tokens");
    expect(await p.tokens()).toBeUndefined();
    await p.invalidateCredentials("all");
    expect((await store.load()).tokens?.refresh_token).toBe("RT0");
    expect((await store.load()).clientInformation?.client_id).toBe("cid");
  });

  it("never deletes tokens that another process rotated in the meantime", async () => {
    const store = new AuthStore(file);
    await store.update(stored);
    const p = new FileOAuthProvider(store, "http://127.0.0.1:1/callback", () => Promise.resolve());
    await p.tokens(); // this attempt used RT0
    await new AuthStore(file).update({ tokens: { access_token: "AT9", token_type: "Bearer", refresh_token: "RT9" } });
    await p.invalidateCredentials("tokens");
    expect((await store.load()).tokens?.refresh_token).toBe("RT9");
    expect((await p.tokens())?.refresh_token).toBe("RT9"); // the rotated tokens are used, the rejected ones never again
    await p.saveTokens({ access_token: "AT10", token_type: "Bearer", refresh_token: "RT10" });
    expect((await p.tokens())?.refresh_token).toBe("RT10");
  });
});

/** A fake Raven with an MCP endpoint: only the newest access token is accepted, refresh tokens rotate. */
function fakeMcpRaven(initial: { at: string; rt: string }, onToken?: (rt: string) => Promise<{ status: number; body: object } | undefined>) {
  const state = { validAt: initial.at, rt: initial.rt, n: 0, tokenRequests: [] as string[], lockSeen: [] as boolean[] };
  const json = (status: number, body: object, headers: Record<string, string> = {}): Response =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
  const base = fakeRaven(() => ({ status: 500, body: {} }));
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname === "/mcp") {
      const auth = new Headers(init?.headers).get("authorization");
      if (auth !== `Bearer ${state.validAt}`) {
        return json(401, { error: "invalid_token" }, { "www-authenticate": `Bearer resource_metadata="${ISSUER}/.well-known/oauth-protected-resource/mcp"` });
      }
      if ((init?.method ?? "GET") !== "POST") return new Response(null, { status: 405 });
      const msg = JSON.parse(String(init?.body)) as { id?: number; method: string; params?: { protocolVersion?: string } };
      if (msg.id === undefined) return new Response(null, { status: 202 });
      if (msg.method === "initialize") {
        return json(200, { jsonrpc: "2.0", id: msg.id, result: { protocolVersion: msg.params?.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: "fake", version: "1" } } });
      }
      return json(200, { jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: "pong" }] } });
    }
    if (url.pathname === "/token") {
      const rt = new URLSearchParams(String(init?.body ?? "")).get("refresh_token") ?? "";
      state.tokenRequests.push(rt);
      state.lockSeen.push(await stat(`${file}.lock`).then(() => true, () => false));
      const forced = await onToken?.(rt);
      if (forced) return json(forced.status, forced.body);
      if (rt !== state.rt) return json(400, { error: "invalid_grant" });
      state.n += 1;
      state.validAt = `AT${state.n}`;
      state.rt = `RT${state.n}`;
      return json(200, { access_token: state.validAt, token_type: "Bearer", expires_in: 3600, refresh_token: state.rt });
    }
    return base.fetchFn(input, init);
  }) as typeof fetch;
  return { state, fetchFn };
}

const expiredSession: StoredAuth = { ...stored, tokens: { ...stored.tokens!, access_token: "AT-expired" } };

describe("refresh serialisation (single-flight + auth.json.lock)", () => {
  it("two concurrent sessions on one auth.json send exactly one refresh request and both succeed", async () => {
    await new AuthStore(file).update(expiredSession);
    const raven = fakeMcpRaven({ at: "AT-valid-elsewhere", rt: "RT0" });
    const deps = realConnectDeps(SERVER, raven.fetchFn);
    const [a, b] = await Promise.all([
      openRavenSession(new AuthStore(file), SERVER, deps, { interactive: false }),
      openRavenSession(new AuthStore(file), SERVER, deps, { interactive: false }),
    ]);
    expect(await a.search("x")).toBe("pong");
    expect(await b.search("x")).toBe("pong");
    await Promise.all([a.close(), b.close()]);
    expect(raven.state.tokenRequests).toEqual(["RT0"]);
    expect(raven.state.lockSeen).toEqual([true]); // the refresh ran while auth.json.lock was held
    expect((await new AuthStore(file).load()).tokens?.refresh_token).toBe("RT1");
    expect(await readdir(dir)).toEqual(["auth.json"]); // lock released, no temp files left
  });

  it("uses tokens another process already rotated instead of spending the old refresh token", async () => {
    await new AuthStore(file).update(expiredSession);
    const raven = fakeMcpRaven({ at: "AT1", rt: "RT1" });
    const p = silent(new AuthStore(file));
    await p.clientInformation();
    await p.tokens(); // this attempt read RT0 ...
    await new AuthStore(file).update({ tokens: { access_token: "AT1", token_type: "Bearer", refresh_token: "RT1", issuer: ISSUER } as StoredAuth["tokens"] & object });
    const res = await p.guardFetch(raven.fetchFn)(`${ISSUER}/token`, {
      method: "POST",
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: "RT0", client_id: "cid" }),
    });
    expect(((await res.json()) as { refresh_token: string }).refresh_token).toBe("RT1"); // ... but RT0 is never sent
    expect(raven.state.tokenRequests).toEqual([]);
  });

  it("reject-before-write race: invalid_grant first, the winner's tokens land later, the session still opens silently", async () => {
    await new AuthStore(file).update(expiredSession);
    const raven = fakeMcpRaven({ at: "AT1", rt: "RT1" }, () => {
      // another process already spent RT0 and is about to write RT1
      setTimeout(() => void new AuthStore(file).update({ tokens: { access_token: "AT1", token_type: "Bearer", refresh_token: "RT1" } }), 100);
      return Promise.resolve({ status: 400, body: { error: "invalid_grant" } });
    });
    let callbacks = 0;
    const deps = { ...realConnectDeps(SERVER, raven.fetchFn), startCallbackServer: () => ((callbacks += 1), Promise.reject(new Error("no browser"))) };
    const session = await openRavenSession(new AuthStore(file), SERVER, deps, { interactive: false, recheckDelayMs: 300 });
    expect(await session.search("x")).toBe("pong");
    await session.close();
    expect(callbacks).toBe(0);
  });

  it("breaks a stale lock and waits for a live one", async () => {
    await writeFile(`${file}.lock`, JSON.stringify({ pid: 1, at: Date.now() - 60_000 }));
    await expect(withFileLock(file, () => Promise.resolve("ran"))).resolves.toBe("ran");
    expect(await readdir(dir)).toEqual([]);
    await writeFile(`${file}.lock`, JSON.stringify({ pid: 1, at: Date.now() }));
    await expect(withFileLock(file, () => Promise.resolve("ran"), { staleMs: 30_000, waitMs: 120, pollMs: 20 })).rejects.toThrow(/Timed out waiting/);
    expect(await readdir(dir)).toEqual(["auth.json.lock"]); // someone else's live lock is never removed
  });

  it("releases the lock when the guarded work throws", async () => {
    await expect(withFileLock(file, () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    expect(await readdir(dir)).toEqual([]);
  });
});

describe("compare-and-swap write-back", () => {
  it("a refresh that finishes after logout recreates nothing", async () => {
    const store = new AuthStore(file);
    await store.update(stored);
    const raven = fakeRaven((rt) => rotating(rt));
    const logoutFirst = (async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input).endsWith("/token")) await new AuthStore(file).clear();
      return raven.fetchFn(input, init);
    }) as typeof fetch;
    const p = silent(store);
    await expect(auth(p, { serverUrl: new URL(SERVER), fetchFn: p.guardFetch(logoutFirst) })).resolves.toBe("AUTHORIZED");
    expect(await readdir(dir)).toEqual([]);
  });

  it("a refresh under the old client never clobbers a fresh login with another client", async () => {
    const store = new AuthStore(file);
    await store.update(stored);
    const fresh = { clientInformation: { client_id: "C2", redirect_uris: ["http://127.0.0.1:2/callback"] }, tokens: { access_token: "X", token_type: "Bearer", refresh_token: "XR" } };
    const raven = fakeRaven((rt) => rotating(rt));
    const loginFirst = (async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input).endsWith("/token")) await new AuthStore(file).update(fresh);
      return raven.fetchFn(input, init);
    }) as typeof fetch;
    const p = silent(store);
    await expect(auth(p, { serverUrl: new URL(SERVER), fetchFn: p.guardFetch(loginFirst) })).resolves.toBe("AUTHORIZED");
    const after = await new AuthStore(file).load();
    expect(after.clientInformation?.client_id).toBe("C2");
    expect(after.tokens?.refresh_token).toBe("XR");
  });

  it("doctor's write-back never creates or quarantines auth.json", async () => {
    await writeFile(file, JSON.stringify(stored));
    const gone = await readOnlyAuthStore({}, file);
    await rm(file);
    const p1 = silent(gone);
    await expect(auth(p1, { serverUrl: new URL(SERVER), fetchFn: p1.guardFetch(fakeRaven(rotating).fetchFn) })).resolves.toBe("AUTHORIZED");
    expect(await readdir(dir)).toEqual([]);

    await writeFile(file, JSON.stringify(stored));
    const corrupt = await readOnlyAuthStore({}, file);
    await writeFile(file, "{corrupt");
    const p2 = silent(corrupt);
    await expect(auth(p2, { serverUrl: new URL(SERVER), fetchFn: p2.guardFetch(fakeRaven(rotating).fetchFn) })).resolves.toBe("AUTHORIZED");
    expect(await readdir(dir)).toEqual(["auth.json"]);
    expect(await readFile(file, "utf8")).toBe("{corrupt");
  });

  it("writes the refreshed session with mode 0600", async () => {
    const store = new AuthStore(file);
    await store.update(stored);
    const p = silent(store);
    await expect(auth(p, { serverUrl: new URL(SERVER), fetchFn: p.guardFetch(fakeRaven(rotating).fetchFn) })).resolves.toBe("AUTHORIZED");
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    expect((await new AuthStore(file).load()).tokens?.refresh_token).toBe("RT0+1");
  });

  it("an interactive attempt deletes rejected tokens that are still the ones on disk", async () => {
    const store = new AuthStore(file);
    await store.update(stored);
    const p = new FileOAuthProvider(store, "http://127.0.0.1:1/callback", () => Promise.resolve());
    await p.tokens();
    await p.invalidateCredentials("tokens");
    expect((await store.load()).tokens).toBeUndefined();
    expect((await store.load()).clientInformation?.client_id).toBe("cid");
  });
});
