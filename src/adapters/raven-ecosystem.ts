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
  describeAuthUrl,
  openInBrowser,
  parseAuthorizationInput,
  startCallbackServer,
  type BrowserOpener,
} from "./raven-auth.js";
import { EXECUTE_SCRIPT, parseRavenResult } from "./raven-parse.js";

export const RAVEN_URL = "https://raven.stellar.org/mcp";

export interface RavenSession {
  execute(code: string): Promise<string>;
  /** One ranked `search` call (used by `kedgeway doctor` as a cheap reachability probe). */
  search(query: string): Promise<string>;
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
  callTool(params: { name: string; arguments: Record<string, unknown> }): Promise<object>;
  close(): Promise<void>;
}

export interface ConnectDeps {
  createClient(): ClientLike;
  createTransport(provider: OAuthClientProvider): TransportLike;
  startCallbackServer: typeof startCallbackServer;
  openBrowser: BrowserOpener;
}

export function realConnectDeps(url: string = RAVEN_URL, fetchFn: typeof fetch = fetch): ConnectDeps {
  return {
    createClient: () => {
      const client = new Client({ name: "kedgeway", version: "0.1.0" });
      return {
        connect: (t) => client.connect(t as StreamableHTTPClientTransport),
        callTool: (params) => client.callTool(params),
        close: () => client.close(),
      };
    },
    createTransport: (provider) =>
      new StreamableHTTPClientTransport(new URL(url), {
        authProvider: provider,
        // Refreshes go through the provider: single-flight in this process, `auth.json.lock` across processes.
        fetch: provider instanceof FileOAuthProvider ? provider.guardFetch(fetchFn) : fetchFn,
      }),
    startCallbackServer,
    openBrowser: openInBrowser,
  };
}

const noopOpen: BrowserOpener = () => Promise.resolve();

function toSession(client: ClientLike): RavenSession {
  return {
    execute: async (code) => textFromToolResult(await client.callTool({ name: "execute", arguments: { code } })),
    search: async (query) => textFromToolResult(await client.callTool({ name: "search", arguments: { query, limit: 1 } })),
    close: () => client.close(),
  };
}

export interface NoBrowserOptions {
  manualCode: (signal: AbortSignal) => Promise<string>;
  announce?: (url: string) => void;
  /** Called with a one-line message when a pasted value is rejected (default: stderr); the prompt then repeats. */
  onInputError?: (message: string) => void;
}

export interface SessionOptions {
  interactive?: boolean;
  /** How long to wait before re-reading the store once after a failed silent attempt (default 300 ms). */
  recheckDelayMs?: number;
  /** Headless login: print the URL (no browser) and also accept the redirect URL or code pasted on stdin. */
  noBrowser?: NoBrowserOptions;
}

/**
 * Connects to Raven. Step 1 is a silent attempt with stored credentials (no callback
 * server, no browser, no registration writes); it refreshes an expired access token and persists the rotated
 * tokens, and it never deletes stored credentials. Only on a 401 do we start the local callback
 * server and run the SDK flow: connect -> UnauthorizedError -> user authorizes ->
 * transport.finishAuth(code) -> reconnect with a fresh client/transport.
 */
export async function openRavenSession(
  store: AuthStore = defaultAuthStore(),
  url: string = RAVEN_URL,
  deps: ConnectDeps = realConnectDeps(url),
  options: SessionOptions = {},
): Promise<RavenSession> {
  const saved = await store.load();

  // 1. silent attempt
  const silentRedirect = saved.callbackPort
    ? `http://127.0.0.1:${saved.callbackPort}/callback`
    : "http://127.0.0.1/callback";
  const trySilently = async (): Promise<RavenSession | undefined> => {
    const client = deps.createClient();
    try {
      await client.connect(deps.createTransport(new FileOAuthProvider(store, silentRedirect, noopOpen, { silent: true })));
      return toSession(client);
    } catch (e) {
      if (!(e instanceof UnauthorizedError)) throw e;
      await client.close().catch(() => undefined);
      return undefined;
    }
  };
  const silent = await trySilently();
  if (silent) return silent;
  // Raven rotates refresh tokens: if another kedgeway process refreshed while we tried, its tokens are now the
  // valid ones, so try once more with them before asking anyone to log in.
  // A process that won the race may still be writing (it got its new tokens before we got `invalid_grant`), so
  // give it a moment before concluding the session is gone.
  const changed = async (): Promise<boolean> => {
    const latest = (await store.load()).tokens;
    return latest !== undefined && (latest.access_token !== saved.tokens?.access_token || latest.refresh_token !== saved.tokens?.refresh_token);
  };
  let rotated = await changed();
  if (!rotated && saved.tokens && !(store instanceof MemoryAuthStore && store.kind === "env")) {
    await new Promise((r) => setTimeout(r, options.recheckDelayMs ?? 300));
    rotated = await changed();
  }
  if (rotated) {
    const retried = await trySilently();
    if (retried) return retried;
  }
  if (store instanceof MemoryAuthStore) {
    throw new Error(
      store.kind === "env"
        ? "Raven rejected the credentials in KEDGEWAY_AUTH (expired or revoked). Run `kedgeway login --export` again and update the secret."
        : 'Not logged in to Raven (or the stored session expired). Run "kedgeway login" first.',
    );
  }
  if (options.interactive === false) {
    throw new Error('Not logged in to Raven (or the stored session expired). Run "kedgeway login" first.');
  }

  return authorizeInteractively(store, deps, options.noBrowser);
}

/**
 * Interactive authorization: lazily start the callback server, let the SDK register/redirect, wait for the code
 * (callback or pasted), finish the exchange and reconnect. Everything it learns is written to `store`.
 */
async function authorizeInteractively(store: AuthStore, deps: ConnectDeps, nb: NoBrowserOptions | undefined): Promise<RavenSession> {
  const saved = await store.load();
  let provider: FileOAuthProvider | undefined;
  let opener: BrowserOpener = nb
    ? (u) => {
        (nb.announce ?? ((x: string) => void process.stderr.write(describeAuthUrl(x))))(u);
        return Promise.resolve();
      }
    : deps.openBrowser;
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
    let code: string;
    if (nb) {
      const ac = new AbortController();
      const report = nb.onInputError ?? ((m: string) => void process.stderr.write(`kedgeway: ${m}\n`));
      const pasted = (async (): Promise<string> => {
        for (;;) {
          const input = await nb.manualCode(ac.signal); // rejects on abort
          try {
            return parseAuthorizationInput(input, provider?.expectedState());
          } catch (e) {
            report((e instanceof Error ? e.message : String(e)).replace(/\s*\n\s*/g, " "));
          }
        }
      })();
      try {
        code = await Promise.race([callback.code, pasted]);
      } finally {
        ac.abort();
        pasted.catch(() => undefined); // the aborted prompt rejects; that is expected
      }
    } else {
      code = await callback.code;
    }
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

/**
 * `kedgeway login`. Without `preserve` it authorizes a new session, but stages the new client registration, PKCE
 * verifier and tokens in memory: the stored session is replaced only once the new tokens exist, in one write
 * under `auth.json.lock`. A cancelled or failed login therefore leaves the previous session working.
 * With `preserve` (`login --export`) a valid stored session is reused as is.
 */
export async function loginToRaven(
  store: AuthStore = new AuthStore(),
  opts: { preserve?: boolean; noBrowser?: NoBrowserOptions } = {},
  url: string = RAVEN_URL,
  deps: ConnectDeps = realConnectDeps(url),
): Promise<void> {
  if (opts.preserve === true) {
    const session = await openRavenSession(store, url, deps, opts.noBrowser ? { noBrowser: opts.noBrowser } : {});
    await session.close();
    return;
  }
  const { callbackPort } = await store.load();
  const staging = new MemoryAuthStore(callbackPort !== undefined ? { callbackPort } : {});
  const session = await authorizeInteractively(staging, deps, opts.noBrowser);
  await session.close();
  const fresh = await staging.load();
  if (!fresh.tokens || !fresh.clientInformation) throw new Error("Login finished without tokens; nothing was changed. Try `kedgeway login` again.");
  const { tokens, clientInformation } = fresh;
  await store.withLock(async () => {
    const current = await store.load();
    delete current.codeVerifier;
    await store.replace({ ...current, clientInformation, tokens, ...(fresh.callbackPort !== undefined ? { callbackPort: fresh.callbackPort } : {}) });
  });
}

/** Connects (never interactively) and makes one `search` call; throws if Raven is unreachable or auth fails. */
export async function pingRaven(
  store: AuthStore = defaultAuthStore(),
  url: string = RAVEN_URL,
  deps: ConnectDeps = realConnectDeps(url),
): Promise<void> {
  const session = await openRavenSession(store, url, deps, { interactive: false });
  try {
    await session.search("stellar");
  } finally {
    await session.close();
  }
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
