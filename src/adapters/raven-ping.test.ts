import { describe, expect, it } from "vitest";
import { AuthStore } from "./raven-auth.js";
import { pingRaven, type ClientLike, type ConnectDeps, type TransportLike } from "./raven-ecosystem.js";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function deps(calls: { name: string; arguments: Record<string, unknown> }[], closed: { n: number }): ConnectDeps {
  return {
    createClient: (): ClientLike => ({
      connect: () => Promise.resolve(),
      callTool: (p) => {
        calls.push(p);
        return Promise.resolve({ content: [{ type: "text", text: "{}" }] });
      },
      close: () => {
        closed.n += 1;
        return Promise.resolve();
      },
    }),
    createTransport: (): TransportLike => ({ finishAuth: () => Promise.resolve() }),
    startCallbackServer: () => Promise.reject(new Error("must not start")),
    openBrowser: () => Promise.resolve(),
  };
}

describe("pingRaven", () => {
  it("makes one cheap search call and closes the session", async () => {
    const calls: { name: string; arguments: Record<string, unknown> }[] = [];
    const closed = { n: 0 };
    const store = new AuthStore(join(mkdtempSync(join(tmpdir(), "kw-ping-")), "auth.json"));
    await pingRaven(store, "https://raven.test/mcp", deps(calls, closed));
    expect(calls).toEqual([{ name: "search", arguments: { query: "stellar", limit: 1 } }]);
    expect(closed.n).toBe(1);
  });
});
