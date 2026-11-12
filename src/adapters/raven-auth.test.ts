import { mkdtemp, mkdir, rm, stat, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AuthStore, FileOAuthProvider, defaultAuthPath, startCallbackServer } from "./raven-auth.js";

let dir: string;
let file: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "sd-auth-"));
  file = join(dir, "nested", "auth.json");
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("AuthStore", () => {
  it("returns empty state when the file is missing", async () => {
    expect(await new AuthStore(file).load()).toEqual({});
  });

  it("round-trips and writes with mode 0600", async () => {
    const store = new AuthStore(file);
    await store.update({ callbackPort: 1234 });
    await store.update({ tokens: { access_token: "t", token_type: "Bearer" } });
    expect(await store.load()).toMatchObject({ callbackPort: 1234, tokens: { access_token: "t" } });
    expect((await stat(file)).mode & 0o777).toBe(0o600);
  });

  it("clear deletes the file and reports whether it existed", async () => {
    const store = new AuthStore(file);
    expect(await store.clear()).toBe(false);
    await store.update({ callbackPort: 1 });
    expect(await store.clear()).toBe(true);
    expect(await store.load()).toEqual({});
  });

  it("quarantines a corrupt file, warns, and starts fresh", async () => {
    const warnings: string[] = [];
    const store = new AuthStore(file, (m) => warnings.push(m));
    await store.update({ callbackPort: 1 });
    await writeFile(file, "{corrupt");
    expect(await store.load()).toEqual({});
    const files = await readdir(join(dir, "nested"));
    expect(files.some((f) => f.startsWith("auth.json.corrupt-"))).toBe(true);
    expect(files).not.toContain("auth.json");
    expect(warnings.join("")).toMatch(/corrupt/i);
  });

  it("quarantines a file with an invalid shape", async () => {
    const store = new AuthStore(file, () => undefined);
    await store.update({ callbackPort: 1 });
    await writeFile(file, JSON.stringify({ callbackPort: "not-a-number" }));
    expect(await store.load()).toEqual({});
    expect((await readdir(join(dir, "nested"))).some((f) => f.includes(".corrupt-"))).toBe(true);
  });

  it("does not swallow non-ENOENT read errors", async () => {
    await mkdir(file, { recursive: true }); // a directory where the file should be -> EISDIR
    await expect(new AuthStore(file, () => undefined).load()).rejects.toThrow();
  });

  it("does not report a missing file when clear cannot read the path", async () => {
    await mkdir(file, { recursive: true });
    await expect(new AuthStore(file, () => undefined).clear()).rejects.toThrow();
  });
});

describe("FileOAuthProvider", () => {
  const redirect = "http://127.0.0.1:5555/callback";
  const noopOpen = () => Promise.resolve();

  it("advertises a public PKCE client with the redirect url", async () => {
    const p = new FileOAuthProvider(new AuthStore(file), redirect, noopOpen);
    expect(String(p.redirectUrl)).toBe(redirect);
    expect(p.clientMetadata.redirect_uris).toEqual([redirect]);
    expect(p.clientMetadata.token_endpoint_auth_method).toBe("none");
    expect(p.clientMetadata.grant_types).toContain("authorization_code");
  });

  it("persists tokens, client info and verifier", async () => {
    const store = new AuthStore(file);
    const p = new FileOAuthProvider(store, redirect, noopOpen);
    await p.saveClientInformation({ client_id: "abc", redirect_uris: [redirect] });
    await p.saveTokens({ access_token: "a", token_type: "Bearer" });
    await p.saveCodeVerifier("verifier");
    const p2 = new FileOAuthProvider(store, redirect, noopOpen);
    expect((await p2.clientInformation())?.client_id).toBe("abc");
    expect((await p2.tokens())?.access_token).toBe("a");
    expect(await p2.codeVerifier()).toBe("verifier");
  });

  it("drops stored client info registered for a different redirect uri", async () => {
    const store = new AuthStore(file);
    await store.update({ clientInformation: { client_id: "old", redirect_uris: ["http://127.0.0.1:1/callback"] } });
    const p = new FileOAuthProvider(store, redirect, noopOpen);
    expect(await p.clientInformation()).toBeUndefined();
  });

  it("silent mode never writes client info or verifier and never opens the browser", async () => {
    const store = new AuthStore(file);
    await store.update({ clientInformation: { client_id: "c", redirect_uris: ["http://127.0.0.1:1/callback"] } });
    let opened = 0;
    const p = new FileOAuthProvider(store, redirect, () => {
      opened += 1;
      return Promise.resolve();
    }, { silent: true });
    expect((await p.clientInformation())?.client_id).toBe("c"); // no redirect mismatch check
    await p.saveClientInformation({ client_id: "new", redirect_uris: [redirect] });
    await p.saveCodeVerifier("v");
    await p.redirectToAuthorization(new URL("https://auth.example/a"));
    const stored = await store.load();
    expect(stored.clientInformation?.client_id).toBe("c");
    expect(stored.codeVerifier).toBeUndefined();
    expect(opened).toBe(0);
    await store.update({ tokens: { access_token: "old", token_type: "Bearer", refresh_token: "r" } });
    await p.tokens();
    await p.saveTokens({ access_token: "t", token_type: "Bearer" }); // refreshed tokens must persist
    expect((await store.load()).tokens?.access_token).toBe("t");
  });

  it("invalidateCredentials clears the requested scope", async () => {
    const store = new AuthStore(file);
    const p = new FileOAuthProvider(store, redirect, noopOpen);
    await p.saveTokens({ access_token: "a", token_type: "Bearer" });
    await p.invalidateCredentials("tokens");
    expect(await p.tokens()).toBeUndefined();
  });

  it("redirectToAuthorization delegates to the opener", async () => {
    let seen = "";
    const p = new FileOAuthProvider(new AuthStore(file), redirect, (u) => {
      seen = u;
      return Promise.resolve();
    });
    await p.redirectToAuthorization(new URL("https://auth.example/authorize?x=1"));
    expect(seen).toBe("https://auth.example/authorize?x=1");
  });
});

describe("startCallbackServer", () => {
  it("resolves the code when state matches", async () => {
    const server = await startCallbackServer(undefined, () => "st");
    try {
      expect(server.redirectUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/callback$/);
      const res = await fetch(`${server.redirectUrl}?code=abc&state=st`);
      expect(res.status).toBe(200);
      await expect(server.code).resolves.toBe("abc");
    } finally {
      await server.close();
    }
  });

  it("serves a small HTML page on success, with a strict CSP and no inline script", async () => {
    const server = await startCallbackServer(undefined, () => "st");
    try {
      const res = await fetch(`${server.redirectUrl}?code=abc&state=st`);
      expect(res.headers.get("content-type")).toMatch(/^text\/html/);
      expect(res.headers.get("content-security-policy")).toContain("default-src 'none'");
      const body = await res.text();
      expect(body).toContain("<title>kedgeway</title>");
      expect(body).toContain("Logged in to Stellar Raven");
      expect(body).toContain("You can close this tab");
      expect(body).not.toContain("<script");
    } finally {
      await server.close();
    }
  });

  it("answers 400 on state mismatch but keeps waiting for the real callback", async () => {
    const server = await startCallbackServer(undefined, () => "st");
    try {
      const bad = await fetch(`${server.redirectUrl}?code=evil&state=nope`);
      expect(bad.status).toBe(400);
      const good = await fetch(`${server.redirectUrl}?code=abc&state=st`);
      expect(good.status).toBe(200);
      await expect(server.code).resolves.toBe("abc");
    } finally {
      await server.close();
    }
  });

  it("rejects when the provider reports an error with matching state, without reflecting it", async () => {
    const server = await startCallbackServer(undefined, () => "st");
    server.code.catch(() => undefined);
    try {
      const res = await fetch(`${server.redirectUrl}?error=access_denied%3Cscript%3E&state=st`);
      const body = await res.text();
      expect(body).not.toContain("access_denied");
      expect(body).not.toContain("<script>");
      await expect(server.code).rejects.toThrow(/access_denied/);
    } finally {
      await server.close();
    }
  });

  it("ignores an error param when state does not match", async () => {
    const server = await startCallbackServer(undefined, () => "st");
    try {
      expect((await fetch(`${server.redirectUrl}?error=boom&state=wrong`)).status).toBe(400);
      await fetch(`${server.redirectUrl}?code=ok&state=st`);
      await expect(server.code).resolves.toBe("ok");
    } finally {
      await server.close();
    }
  });

  it("sets X-Content-Type-Options: nosniff on every response", async () => {
    const server = await startCallbackServer(undefined, () => "st");
    try {
      const r1 = await fetch(`${server.redirectUrl}?code=x&state=bad`);
      const r2 = await fetch(`http://127.0.0.1:${server.port}/other`);
      expect(r1.headers.get("x-content-type-options")).toBe("nosniff");
      expect(r2.headers.get("x-content-type-options")).toBe("nosniff");
    } finally {
      await server.close();
    }
  });

  it("rejects on timeout", async () => {
    const server = await startCallbackServer(undefined, () => "st", 20);
    try {
      await expect(server.code).rejects.toThrow(/timed out/i);
    } finally {
      await server.close();
    }
  });
});

describe("defaultAuthPath", () => {
  it("prefers KEDGEWAY_CONFIG_DIR, then XDG_CONFIG_HOME/kedgeway, then ~/.config/kedgeway", () => {
    expect(defaultAuthPath({ KEDGEWAY_CONFIG_DIR: "/cfg/kw", XDG_CONFIG_HOME: "/xdg" })).toBe(join("/cfg/kw", "auth.json"));
    expect(defaultAuthPath({ XDG_CONFIG_HOME: "/xdg" })).toBe(join("/xdg", "kedgeway", "auth.json"));
    expect(defaultAuthPath({ KEDGEWAY_CONFIG_DIR: "", XDG_CONFIG_HOME: "" })).toMatch(/[/\\]\.config[/\\]kedgeway[/\\]auth\.json$/);
  });

  it("the default AuthStore follows the override", () => {
    const prev = process.env["KEDGEWAY_CONFIG_DIR"];
    process.env["KEDGEWAY_CONFIG_DIR"] = dir;
    try {
      expect(new AuthStore().path).toBe(join(dir, "auth.json"));
    } finally {
      if (prev === undefined) delete process.env["KEDGEWAY_CONFIG_DIR"];
      else process.env["KEDGEWAY_CONFIG_DIR"] = prev;
    }
  });
});
