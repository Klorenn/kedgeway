import { access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { describe, expect, it } from "vitest";
import {
  AuthStore,
  FileOAuthProvider,
  MemoryAuthStore,
  decodeAuth,
  defaultAuthStore,
  encodeAuth,
  exportAuth,
  type StoredAuth,
} from "./raven-auth.js";
import { openRavenSession, type ClientLike, type ConnectDeps, type TransportLike } from "./raven-ecosystem.js";

const auth: StoredAuth = {
  clientInformation: { client_id: "cid", redirect_uris: ["http://127.0.0.1:1/callback"] },
  tokens: { access_token: "AT", token_type: "Bearer", refresh_token: "RT" },
  codeVerifier: "should-not-leak",
  callbackPort: 1234,
};

describe("encodeAuth / decodeAuth", () => {
  it("round-trips client info and tokens only", () => {
    const blob = encodeAuth(auth);
    expect(blob).toMatch(/^[A-Za-z0-9+/=]+$/);
    const back = decodeAuth(blob);
    expect(back.tokens).toEqual(auth.tokens);
    expect(back.clientInformation).toEqual(auth.clientInformation);
    expect(back.codeVerifier).toBeUndefined();
    expect(back.callbackPort).toBeUndefined();
    expect(Buffer.from(blob, "base64").toString("utf8")).not.toContain("should-not-leak");
  });

  it("tolerates surrounding whitespace/newlines", () => {
    expect(decodeAuth(`\n  ${encodeAuth(auth)}  \n`).tokens).toEqual(auth.tokens);
  });

  it("accepts whitespace/newlines inside the blob (wrapped secrets) and base64url", () => {
    const blob = encodeAuth(auth);
    const wrapped = blob.replace(/(.{20})/g, "$1\n  ");
    expect(decodeAuth(wrapped).tokens).toEqual(auth.tokens);
    const url = blob.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(decodeAuth(url).tokens).toEqual(auth.tokens);
  });

  it.each(["", "!!!", Buffer.from("not json").toString("base64"), Buffer.from("{}").toString("base64")])(
    "rejects invalid blob %j with a KEDGEWAY_AUTH message",
    (blob) => {
      expect(() => decodeAuth(blob)).toThrow(/KEDGEWAY_AUTH/);
    },
  );
});

describe("MemoryAuthStore", () => {
  it("serves the decoded auth, merges updates in memory and never touches disk", async () => {
    const store = new MemoryAuthStore(decodeAuth(encodeAuth(auth)));
    expect((await store.load()).tokens?.access_token).toBe("AT");
    const provider = new FileOAuthProvider(store, "http://127.0.0.1/callback", () => Promise.resolve(), { silent: true });
    await provider.saveTokens({ access_token: "AT2", token_type: "Bearer", refresh_token: "RT2" });
    expect((await provider.tokens())?.access_token).toBe("AT2");
    expect((await store.load()).clientInformation).toEqual(auth.clientInformation);
    expect(await store.clear()).toBe(true);
    expect(await store.load()).toEqual({});
  });

  it("does not write any file", async () => {
    const dir = join(tmpdir(), `kw-never-${process.pid}-${Date.now()}`);
    class Probe extends MemoryAuthStore {
      constructor() {
        super({}, join(dir, "auth.json"));
      }
    }
    await new Probe().update({ tokens: auth.tokens! });
    await expect(access(dir)).rejects.toThrow();
  });
});

describe("defaultAuthStore", () => {
  it("uses the file store without KEDGEWAY_AUTH and the memory store with it", () => {
    expect(defaultAuthStore({})).toBeInstanceOf(AuthStore);
    expect(defaultAuthStore({})).not.toBeInstanceOf(MemoryAuthStore);
    expect(defaultAuthStore({ KEDGEWAY_AUTH: "" })).not.toBeInstanceOf(MemoryAuthStore);
    expect(defaultAuthStore({ KEDGEWAY_AUTH: encodeAuth(auth) })).toBeInstanceOf(MemoryAuthStore);
  });

  it("throws a clear error for a malformed KEDGEWAY_AUTH", () => {
    expect(() => defaultAuthStore({ KEDGEWAY_AUTH: "garbage" })).toThrow(/KEDGEWAY_AUTH/);
  });
});

describe("exportAuth", () => {
  it("returns null when there are no stored tokens and a blob when there are", async () => {
    expect(await exportAuth(new MemoryAuthStore({}))).toBeNull();
    const blob = await exportAuth(new MemoryAuthStore(auth));
    expect(blob).not.toBeNull();
    expect(decodeAuth(blob ?? "").tokens).toEqual(auth.tokens);
  });
});

describe("openRavenSession with KEDGEWAY_AUTH", () => {
  it("never starts an interactive flow: a 401 fails with guidance to re-export", async () => {
    let callbackStarts = 0;
    const deps: ConnectDeps = {
      createClient: (): ClientLike => ({
        connect: () => Promise.reject(new UnauthorizedError("401")),
        callTool: () => Promise.resolve({}),
        close: () => Promise.resolve(),
      }),
      createTransport: (): TransportLike => ({ finishAuth: () => Promise.resolve() }),
      startCallbackServer: () => {
        callbackStarts += 1;
        return Promise.reject(new Error("must not start"));
      },
      openBrowser: () => Promise.resolve(),
    };
    await expect(openRavenSession(new MemoryAuthStore(auth), "https://raven.test/mcp", deps)).rejects.toThrow(
      /KEDGEWAY_AUTH.*login --export/s,
    );
    expect(callbackStarts).toBe(0);
  });
});
