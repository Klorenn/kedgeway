import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import type { EcosystemPort, EcosystemSnapshot } from "../ports/ecosystem.js";
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import {
  AuthStore,
  FileOAuthProvider,
  MemoryAuthStore,
  defaultAuthStore,
  openInBrowser,
  startCallbackServer,
  type BrowserOpener,
} from "./raven-auth.js";
import { EXECUTE_SCRIPT, parseRavenResult } from "./raven-parse.js";

export const RAVEN_URL = "https://raven.stellar.org/mcp";

export interface RavenSession {
  execute(code: string): Promise<string>;
  close(): Promise<void>;
}

export function textFromToolResult(result: object): string {
  const r = result as { content?: unknown; isError?: unknown };
  const parts = Array.isArray(r.content) ? (r.content as unknown[]) : [];
  const texts: string[] = [];
  for (const p of parts) {
    if (typeof p === "object" && p !== null && (p as { type?: unknown }).type === "text") {
      const t = (p as { text?: unknown }).text;
      if (typeof t === "string") texts.push(t);
    }
  }
  const text = texts.join("\n");
  if (r.isError === true) throw new Error(`Raven execute failed: ${text || "unknown error"}`);
  if (text === "") throw new Error("Raven execute returned no text content");
  return text;
}

export interface TransportLike {
  finishAuth(code: string): Promise<void>;
}

export interface ClientLike {
  connect(transport: TransportLike): Promise<void>;
  callTool(params: { name: string; arguments: { code: string } }): Promise<object>;
  close(): Promise<void>;
}

export interface ConnectDeps {
  createClient(): ClientLike;
  createTransport(provider: OAuthClientProvider): TransportLike;
  startCallbackServer: typeof startCallbackServer;
  openBrowser: BrowserOpener;
}

export function realConnectDeps(url: string = RAVEN_URL): ConnectDeps {
  return {
    createClient: () => {
      const client = new Client({ name: "kedgeway", version: "0.1.0" });
      return {
        connect: (t) => client.connect(t as StreamableHTTPClientTransport),
        callTool: (params) => client.callTool(params),
        close: () => client.close(),
      };
    },
    createTransport: (provider) => new StreamableHTTPClientTransport(new URL(url), { authProvider: provider }),
    startCallbackServer,
    openBrowser: openInBrowser,
  };
}

const noopOpen: BrowserOpener = () => Promise.resolve();

function toSession(client: ClientLike): RavenSession {
  return {
    execute: async (code) => textFromToolResult(await client.callTool({ name: "execute", arguments: { code } })),
    close: () => client.close(),
  };
}

/**
 * Connects to Raven. Step 1 is a silent attempt with stored credentials (no callback
 * server, no browser, no registration writes). Only on a 401 do we start the local callback
 * server and run the SDK flow: connect -> UnauthorizedError -> user authorizes ->
 * transport.finishAuth(code) -> reconnect with a fresh client/transport.
 */
export async function openRavenSession(
  store: AuthStore = defaultAuthStore(),
  url: string = RAVEN_URL,
  deps: ConnectDeps = realConnectDeps(url),
  options: { interactive?: boolean } = {},
): Promise<RavenSession> {
  const saved = await store.load();

  // 1. silent attempt
  const silentRedirect = saved.callbackPort
    ? `http://127.0.0.1:${saved.callbackPort}/callback`
    : "http://127.0.0.1/callback";
  const silentProvider = new FileOAuthProvider(store, silentRedirect, noopOpen, { silent: true });
  const silentClient = deps.createClient();
  try {
    await silentClient.connect(deps.createTransport(silentProvider));
    return toSession(silentClient);
  } catch (e) {
    if (!(e instanceof UnauthorizedError)) throw e;
    await silentClient.close().catch(() => undefined);
    if (store instanceof MemoryAuthStore) {
      throw new Error(
        "Raven rejected the credentials in KEDGEWAY_AUTH (expired or revoked). Run `kedgeway login --export` again and update the secret.",
      );
    }
    if (options.interactive === false) {
      throw new Error('Not logged in to Raven (or the stored session expired). Run "kedgeway login" first.');
    }
  }

  // 2. interactive authorization
  let provider: FileOAuthProvider | undefined;
  let opener: BrowserOpener = deps.openBrowser;
  const callback = await deps.startCallbackServer(saved.callbackPort, () => provider?.expectedState());
  try {
    provider = new FileOAuthProvider(store, callback.redirectUrl, (u) => opener(u));
    await store.update({ callbackPort: callback.port });

    const client = deps.createClient();
    const transport = deps.createTransport(provider);
    try {
      await client.connect(transport);
      return toSession(client);
    } catch (e) {
      if (!(e instanceof UnauthorizedError)) throw e;
    }
    // redirectToAuthorization already printed/opened the URL; wait for the callback.
    const code = await callback.code;
    // Reuse the transport that saw the 401: it remembers the resource metadata URL.
    await transport.finishAuth(code);

    opener = noopOpen; // never reopen the browser on the retry
    const retry = deps.createClient();
    try {
      await retry.connect(deps.createTransport(provider));
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        throw new Error(
          "Authentication succeeded but Raven rejected the token. Run `kedgeway logout` and try `kedgeway login` again.",
        );
      }
      throw e;
    }
    return toSession(retry);
  } finally {
    await callback.close();
  }
}

export async function loginToRaven(store: AuthStore = new AuthStore(), opts: { preserve?: boolean } = {}): Promise<void> {
  if (opts.preserve !== true) await store.remove(["tokens", "clientInformation", "codeVerifier"]);
  const session = await openRavenSession(store);
  await session.close();
}

export class RavenEcosystem implements EcosystemPort {
  constructor(private readonly open: () => Promise<RavenSession> = () => openRavenSession()) {}

  async fetchSnapshot(): Promise<EcosystemSnapshot> {
    const session = await this.open();
    try {
      return parseRavenResult(await session.execute(EXECUTE_SCRIPT));
    } finally {
      await session.close();
    }
  }
}
