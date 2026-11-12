import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { describe, expect, it } from "vitest";
import { AuthStore, describeAuthUrl, parseAuthorizationInput } from "./raven-auth.js";
import {
  openRavenSession,
  type ClientLike,
  type ConnectDeps,
  type TransportLike,
} from "./raven-ecosystem.js";

describe("parseAuthorizationInput", () => {
  it("extracts the code from a pasted redirect URL and checks state", () => {
    expect(parseAuthorizationInput("http://127.0.0.1:4242/callback?code=abc123&state=S1", "S1")).toBe("abc123");
    expect(parseAuthorizationInput("  http://127.0.0.1:4242/callback?code=abc%2B1&state=S1\n", "S1")).toBe("abc+1");
  });
  it("rejects a state mismatch, an error response and an empty paste", () => {
    expect(() => parseAuthorizationInput("http://127.0.0.1:1/callback?code=a&state=OTHER", "S1")).toThrow(/state/i);
    expect(() => parseAuthorizationInput("http://127.0.0.1:1/callback?error=access_denied&state=S1", "S1")).toThrow(/access_denied/);
    expect(() => parseAuthorizationInput("  ", "S1")).toThrow(/empty/i);
    expect(() => parseAuthorizationInput("http://127.0.0.1:1/callback?state=S1", "S1")).toThrow(/code/i);
  });
  it("fails closed: a pasted URL cannot be verified when the attempt has no state", () => {
    expect(() => parseAuthorizationInput("http://127.0.0.1:1/callback?code=a&state=S1", undefined)).toThrow(/state/i);
  });

  it("accepts a bare authorization code", () => {
    expect(parseAuthorizationInput("abc123", "S1")).toBe("abc123");
  });
});

describe("describeAuthUrl", () => {
  it("prints the URL, the paste instruction and the ssh port-forward trick for the callback port", () => {
    const url = `https://raven.test/authorize?client_id=x&redirect_uri=${encodeURIComponent("http://127.0.0.1:4242/callback")}&state=S`;
    const text = describeAuthUrl(url);
    expect(text).toContain(url);
    expect(text).toContain("ssh -L 4242:127.0.0.1:4242");
    expect(text).toMatch(/paste/i);
  });
  it("still works when the redirect port cannot be found", () => {
    expect(describeAuthUrl("https://raven.test/authorize")).toContain("https://raven.test/authorize");
  });
});

describe("openRavenSession with noBrowser", () => {
  function harness(manual: (signal: AbortSignal) => Promise<string>, callbackCode: Promise<string>) {
    const log = { finishAuth: [] as string[], browserOpens: 0, connects: 0, aborted: false };
    let n = 0;
    const deps: ConnectDeps = {
      createClient: (): ClientLike => ({
        connect: () => {
          log.connects += 1;
          return n++ < 2 ? Promise.reject(new UnauthorizedError("401")) : Promise.resolve();
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
      startCallbackServer: () =>
        Promise.resolve({ port: 4242, redirectUrl: "http://127.0.0.1:4242/callback", code: callbackCode, close: () => Promise.resolve() }),
      openBrowser: () => {
        log.browserOpens += 1;
        return Promise.resolve();
      },
    };
    const options = {
      noBrowser: {
        manualCode: (signal: AbortSignal) => {
          signal.addEventListener("abort", () => (log.aborted = true));
          return manual(signal);
        },
        announce: () => undefined,
      },
    };
    return { deps, log, options };
  }

  it("finishes auth with the pasted code and never opens a browser", async () => {
    const h = harness(() => Promise.resolve("pasted-code"), new Promise<string>(() => undefined));
    await openRavenSession(plainStore(), "https://raven.test/mcp", h.deps, h.options);
    expect(h.log.finishAuth).toEqual(["pasted-code"]);
    expect(h.log.browserOpens).toBe(0);
  });

  it("re-prompts on invalid input with a one-line error until a valid code is pasted", async () => {
    const inputs = ["", "not a url", "http://127.0.0.1:1/callback?code=a&state=WRONG", "good-code"];
    const h = harness(() => Promise.resolve(inputs.shift() ?? ""), new Promise<string>(() => undefined));
    const errors: string[] = [];
    await openRavenSession(plainStore(), "https://raven.test/mcp", h.deps, {
      noBrowser: { ...h.options.noBrowser, onInputError: (m: string) => errors.push(m) },
    });
    expect(h.log.finishAuth).toEqual(["good-code"]);
    expect(errors).toHaveLength(3);
    for (const e of errors) expect(e).not.toContain("\n");
  });

  it("stops prompting when the callback wins while the user is still typing", async () => {
    let prompts = 0;
    const h = harness(
      () => {
        prompts += 1;
        return prompts === 1 ? Promise.resolve("bad input") : new Promise<string>(() => undefined);
      },
      new Promise<string>((r) => setTimeout(() => r("cb"), 20)),
    );
    await openRavenSession(plainStore(), "https://raven.test/mcp", h.deps, {
      noBrowser: { ...h.options.noBrowser, onInputError: () => undefined },
    });
    expect(h.log.finishAuth).toEqual(["cb"]);
    expect(h.log.aborted).toBe(true);
  });

  it("uses the callback code when it arrives first and cancels the stdin prompt", async () => {
    const h = harness(() => new Promise<string>(() => undefined), Promise.resolve("cb-code"));
    await openRavenSession(plainStore(), "https://raven.test/mcp", h.deps, h.options);
    expect(h.log.finishAuth).toEqual(["cb-code"]);
    expect(h.log.aborted).toBe(true);
  });
});

function plainStore(): AuthStore {
  return new AuthStore(join(mkdtempSync(join(tmpdir(), "kw-nb-")), "auth.json"));
}
