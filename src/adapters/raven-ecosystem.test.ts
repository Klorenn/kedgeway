import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  RavenEcosystem,
  loginToRaven,
  openRavenSession,
  textFromToolResult,
  type ClientLike,
  type ConnectDeps,
  type RavenSession,
  type TransportLike,
} from "./raven-ecosystem.js";
import { AuthStore, FileOAuthProvider, type CallbackServer, type StoredAuth } from "./raven-auth.js";

const payload = JSON.stringify({
  observedAt: "2026-11-11T00:00:00.000Z",
  rustSdkCurrent: "23.0.0",
  jsSdkCurrent: "14.0.0",
  protocolCurrent: 25,
  deprecatedVersions: ["20.0.0"],
  scoutGeneratedAt: null,
  notes: [],
  degraded: [],
});

function fakeSession(text: string) {
  const state = { executed: [] as string[], closed: 0 };
  const session: RavenSession = {
    execute: (code) => {
      state.executed.push(code);
      return Promise.resolve(text);
    },
    search: () => Promise.resolve(text),
    close: () => {
      state.closed += 1;
      return Promise.resolve();
    },
  };
  return { session, state };
}

describe("RavenEcosystem", () => {
  it("calls execute once with the script, parses the result and closes the session", async () => {
    const { session, state } = fakeSession(`${payload}\n--- SOURCE METADATA ---\n{}`);
    const eco = new RavenEcosystem(() => Promise.resolve(session));
    const snap = await eco.fetchSnapshot();
    expect(state.executed).toHaveLength(1);
    expect(state.executed[0]).toContain("scout.analyzeEcosystem");
    expect(state.closed).toBe(1);
    expect(snap.sorobanSdk.currentMajor).toBe(23);
  });

  it("closes the session even when parsing fails", async () => {
    const { session, state } = fakeSession("not json");
    const eco = new RavenEcosystem(() => Promise.resolve(session));
    await expect(eco.fetchSnapshot()).rejects.toThrow();
    expect(state.closed).toBe(1);
  });
});

describe("textFromToolResult", () => {
  it("joins text parts", () => {
    expect(
      textFromToolResult({ content: [{ type: "text", text: "a" }, { type: "image" }, { type: "text", text: "b" }] }),
    ).toBe("a\nb");
  });

  it("throws on isError results with the message", () => {
    expect(() => textFromToolResult({ isError: true, content: [{ type: "text", text: "sandbox failed" }] })).toThrow(
      /sandbox failed/,
    );
  });

  it("throws when there is no text content", () => {
    expect(() => textFromToolResult({ content: [] })).toThrow(/no text/i);
  });
});

describe("openRavenSession", () => {
  let dir: string;
  let store: AuthStore;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "sd-raven-"));
    store = new AuthStore(join(dir, "auth.json"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  /** connectResults: one entry per client.connect call, in order. */
  function harness(connectResults: ("ok" | "unauthorized")[]) {
    const log = { connects: 0, callbackStarts: 0, finishAuth: [] as string[], opened: [] as string[], callbackClosed: 0 };
    let n = 0;
    const deps: ConnectDeps = {
      createClient: (): ClientLike => ({
        connect: () => {
          log.connects += 1;
          const r = connectResults[n++] ?? "ok";
          return r === "ok" ? Promise.resolve() : Promise.reject(new UnauthorizedError("401"));
        },
        callTool: () => Promise.resolve({ content: [{ type: "text", text: "hi" }] }),
        close: () => Promise.resolve(),
      }),
      createTransport: (): TransportLike => ({
        finishAuth: (code) => {
          log.finishAuth.push(code);
          return Promise.resolve();
        },
      }),
      startCallbackServer: (): Promise<CallbackServer> => {
        log.callbackStarts += 1;
        return Promise.resolve({
          port: 4242,
          redirectUrl: "http://127.0.0.1:4242/callback",
          code: Promise.resolve("the-code"),
          close: () => {
            log.callbackClosed += 1;
            return Promise.resolve();
          },
        });
      },
      openBrowser: (url) => {
        log.opened.push(url);
        return Promise.resolve();
      },
    };
    return { deps, log };
  }

  it("does not start a callback server or write auth.json when already authorized", async () => {
    const { deps, log } = harness(["ok"]);
    const session = await openRavenSession(store, "https://raven.test/mcp", deps);
    expect(await session.execute("x")).toBe("hi");
    expect(log.callbackStarts).toBe(0);
    await expect(readFile(join(dir, "auth.json"))).rejects.toThrow();
  });

  it("starts the callback server lazily after a 401, finishes auth and reconnects", async () => {
    const { deps, log } = harness(["unauthorized", "unauthorized", "ok"]);
    const session = await openRavenSession(store, "https://raven.test/mcp", deps);
    expect(await session.execute("x")).toBe("hi");
    expect(log.callbackStarts).toBe(1);
    expect(log.finishAuth).toEqual(["the-code"]);
    expect(log.callbackClosed).toBe(1);
    expect((await store.load()).callbackPort).toBe(4242);
  });

  it("fails clearly, without reopening the browser, if Raven still answers 401 after auth", async () => {
    const { deps, log } = harness(["unauthorized", "unauthorized", "unauthorized"]);
    await expect(openRavenSession(store, "https://raven.test/mcp", deps)).rejects.toThrow(
      /authentication succeeded but Raven rejected the token/i,
    );
    expect(log.callbackClosed).toBe(1);
  });

  it("non-interactive mode fails fast with a login hint and never starts the callback server", async () => {
    const { deps, log } = harness(["unauthorized"]);
    await expect(
      openRavenSession(store, "https://raven.test/mcp", deps, { interactive: false }),
    ).rejects.toThrow(/kedgeway login/);
    expect(log.callbackStarts).toBe(0);
    await expect(readFile(join(dir, "auth.json"))).rejects.toThrow();
  });

  it("retries silently once when another process rotated the tokens during the silent attempt", async () => {
    await store.update({ tokens: { access_token: "A1", token_type: "Bearer", refresh_token: "R1" } });
    const { deps, log } = harness(["unauthorized", "ok"]);
    const connect = deps.createClient;
    let first = true;
    deps.createClient = () => {
      const c = connect();
      return {
        ...c,
        connect: async (t) => {
          if (first) {
            first = false;
            await new AuthStore(join(dir, "auth.json")).update({ tokens: { access_token: "A2", token_type: "Bearer", refresh_token: "R2" } });
          }
          return c.connect(t);
        },
      };
    };
    const session = await openRavenSession(store, "https://raven.test/mcp", deps, { interactive: false });
    expect(await session.execute("x")).toBe("hi");
    expect(log.connects).toBe(2);
    expect(log.callbackStarts).toBe(0);
  });

  it("does not retry the silent attempt when the stored tokens did not change", async () => {
    await store.update({ tokens: { access_token: "A1", token_type: "Bearer", refresh_token: "R1" } });
    const { deps, log } = harness(["unauthorized", "ok"]);
    await expect(openRavenSession(store, "https://raven.test/mcp", deps, { interactive: false })).rejects.toThrow(/kedgeway login/);
    expect(log.connects).toBe(1);
  });

  it("propagates non-auth connection errors", async () => {
    const { deps } = harness([]);
    deps.createClient = () => ({
      connect: () => Promise.reject(new Error("network down")),
      callTool: () => Promise.resolve({}),
      close: () => Promise.resolve(),
    });
    await expect(openRavenSession(store, "https://raven.test/mcp", deps)).rejects.toThrow("network down");
  });
});

describe("loginToRaven", () => {
  let dir: string;
  let file: string;
  const existing: StoredAuth = {
    clientInformation: { client_id: "old-client", redirect_uris: ["http://127.0.0.1:4242/callback"] },
    tokens: { access_token: "OLD-AT", token_type: "Bearer", refresh_token: "OLD-RT" },
    callbackPort: 4242,
  };
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "sd-login-"));
    file = join(dir, "auth.json");
    await new AuthStore(file).update(existing);
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  function loginDeps(code: Promise<string>) {
    const log = { connects: 0 };
    let provider: FileOAuthProvider | undefined;
    const deps: ConnectDeps = {
      createClient: (): ClientLike => ({
        connect: () => {
          log.connects += 1;
          return log.connects === 1 ? Promise.reject(new UnauthorizedError("401")) : Promise.resolve();
        },
        callTool: () => Promise.resolve({ content: [{ type: "text", text: "hi" }] }),
        close: () => Promise.resolve(),
      }),
      createTransport: (p): TransportLike => {
        provider = p as FileOAuthProvider;
        return {
          finishAuth: async () => {
            // what the SDK does on a successful code exchange
            await provider!.saveClientInformation({ client_id: "new-client", redirect_uris: ["http://127.0.0.1:4242/callback"] });
            await provider!.saveCodeVerifier("verifier");
            await provider!.saveTokens({ access_token: "NEW-AT", token_type: "Bearer", refresh_token: "NEW-RT" });
          },
        };
      },
      startCallbackServer: (): Promise<CallbackServer> =>
        Promise.resolve({ port: 4242, redirectUrl: "http://127.0.0.1:4242/callback", code, close: () => Promise.resolve() }),
      openBrowser: () => Promise.resolve(),
    };
    return deps;
  }

  it("a cancelled login leaves the previous session untouched", async () => {
    const before = await readFile(file, "utf8");
    const cancelled = Promise.reject(new Error("cancelled"));
    cancelled.catch(() => undefined);
    await expect(loginToRaven(new AuthStore(file), {}, "https://raven.test/mcp", loginDeps(cancelled))).rejects.toThrow("cancelled");
    expect(await readFile(file, "utf8")).toBe(before);
  });

  it("a successful login replaces client and tokens in one write and keeps no PKCE verifier", async () => {
    await loginToRaven(new AuthStore(file), {}, "https://raven.test/mcp", loginDeps(Promise.resolve("the-code")));
    const after = await new AuthStore(file).load();
    expect(after.clientInformation?.client_id).toBe("new-client");
    expect(after.tokens?.refresh_token).toBe("NEW-RT");
    expect(after.callbackPort).toBe(4242);
    expect(after.codeVerifier).toBeUndefined();
  });

  it("--preserve reuses a valid stored session without authorizing again", async () => {
    let callbacks = 0;
    const deps = loginDeps(Promise.resolve("the-code"));
    deps.createClient = () => ({ connect: () => Promise.resolve(), callTool: () => Promise.resolve({}), close: () => Promise.resolve() });
    deps.startCallbackServer = () => ((callbacks += 1), Promise.reject(new Error("must not start")));
    await loginToRaven(new AuthStore(file), { preserve: true }, "https://raven.test/mcp", deps);
    expect(callbacks).toBe(0);
    expect((await new AuthStore(file).load()).tokens?.refresh_token).toBe("OLD-RT");
  });
});
