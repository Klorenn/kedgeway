import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  RavenEcosystem,
  openRavenSession,
  textFromToolResult,
  type ClientLike,
  type ConnectDeps,
  type RavenSession,
  type TransportLike,
} from "./raven-ecosystem.js";
import { AuthStore, type CallbackServer } from "./raven-auth.js";

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
