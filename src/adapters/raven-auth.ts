import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { chmod, mkdir, open as openFile, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { z } from "zod";
import {
  OAuthClientInformationSchema,
  OAuthTokensSchema,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { createServer, type Server } from "node:http";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { UnauthorizedError, type OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type {
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";

export interface StoredAuth {
  clientInformation?: OAuthClientInformationMixed;
  tokens?: OAuthTokens;
  codeVerifier?: string;
  callbackPort?: number;
}

/** kedgeway's config directory: `KEDGEWAY_CONFIG_DIR`, else `$XDG_CONFIG_HOME/kedgeway`, else `~/.config/kedgeway`. */
export function configDir(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env["KEDGEWAY_CONFIG_DIR"];
  if (explicit !== undefined && explicit !== "") return resolve(explicit);
  const xdg = env["XDG_CONFIG_HOME"];
  // The XDG spec says a relative XDG_CONFIG_HOME must be ignored.
  return join(xdg !== undefined && xdg !== "" && isAbsolute(xdg) ? xdg : join(homedir(), ".config"), "kedgeway");
}

export function defaultAuthPath(env: NodeJS.ProcessEnv = process.env): string {
  return join(configDir(env), "auth.json");
}

const StoredShapeSchema = z.object({
  clientInformation: z.unknown().optional(),
  tokens: z.unknown().optional(),
  codeVerifier: z.string().optional(),
  callbackPort: z.number().int().optional(),
});

function parseStored(raw: unknown): StoredAuth | null {
  const shape = StoredShapeSchema.safeParse(raw);
  if (!shape.success) return null;
  const out: StoredAuth = {};
  if (shape.data.codeVerifier !== undefined) out.codeVerifier = shape.data.codeVerifier;
  if (shape.data.callbackPort !== undefined) out.callbackPort = shape.data.callbackPort;
  if (shape.data.tokens !== undefined) {
    const t = OAuthTokensSchema.safeParse(shape.data.tokens);
    if (!t.success) return null;
    out.tokens = t.data;
  }
  if (shape.data.clientInformation !== undefined) {
    const c = OAuthClientInformationSchema.safeParse(shape.data.clientInformation);
    if (!c.success) return null;
    out.clientInformation = shape.data.clientInformation as OAuthClientInformationMixed;
  }
  return out;
}

/** What a token write-back is checked against: the session it belongs to must still be the one on disk. */
export type TokenGuard = (current: StoredAuth) => boolean;

export class AuthStore {
  constructor(
    readonly path: string = defaultAuthPath(),
    private readonly warn: (message: string) => void = (m) => void process.stderr.write(m),
  ) {}

  /** Identifies the session store for in-process single-flight refreshes. */
  lockKey(): string {
    return `file:${this.path}`;
  }

  /** Runs `fn` holding the cross-process `auth.json.lock`. */
  withLock<T>(fn: () => Promise<T>): Promise<T> {
    return withFileLock(this.path, fn);
  }

  /** What is on disk right now, read without quarantining; undefined when missing or unparseable. */
  async peek(): Promise<StoredAuth | undefined> {
    try {
      return parseStored(JSON.parse(await readFile(this.path, "utf8"))) ?? undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Compare-and-swap for tokens (the caller holds the lock): writes `tokens` only if the file exists, parses and
   * still satisfies `guard`. Never creates, quarantines or clears the file. Returns whether it wrote.
   */
  async casTokens(guard: TokenGuard, tokens: OAuthTokens): Promise<boolean> {
    const current = await this.peek();
    if (!current || !guard(current)) return false;
    await this.write({ ...current, tokens });
    return true;
  }

  async load(): Promise<StoredAuth> {
    let text: string;
    try {
      text = await readFile(this.path, "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw e;
    }
    let parsed: StoredAuth | null = null;
    try {
      parsed = parseStored(JSON.parse(text));
    } catch {
      parsed = null;
    }
    if (parsed) return parsed;
    const quarantine = `${this.path}.corrupt-${Date.now()}`;
    await rename(this.path, quarantine);
    this.warn(`kedgeway: ${this.path} was corrupt; moved to ${quarantine} and starting fresh.\n`);
    return {};
  }

  async update(patch: Partial<StoredAuth>): Promise<void> {
    const next = { ...(await this.load()), ...patch };
    await this.write(next);
  }

  /** Replaces the whole stored auth in one atomic write. */
  async replace(data: StoredAuth): Promise<void> {
    await this.write(data);
  }

  async remove(keys: (keyof StoredAuth)[]): Promise<void> {
    const current = await this.load();
    for (const k of keys) delete current[k];
    await this.write(current);
  }

  async clear(): Promise<boolean> {
    try {
      await readFile(this.path);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw e;
    }
    await rm(this.path, { force: true });
    return true;
  }

  protected async write(data: StoredAuth): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const tmp = `${this.path}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
    await writeFile(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
    await chmod(tmp, 0o600);
    await rename(tmp, this.path);
  }
}

/** What `login --export` shares and `KEDGEWAY_AUTH` carries: client registration and tokens, nothing transient. */
export function encodeAuth(auth: StoredAuth): string {
  const { clientInformation, tokens } = auth;
  return Buffer.from(JSON.stringify({ clientInformation, tokens }), "utf8").toString("base64");
}

export function decodeAuth(blob: string): StoredAuth {
  const bad = (why: string): Error => new Error(`KEDGEWAY_AUTH is not valid (${why}). Re-create it with \`kedgeway login --export\`.`);
  const text = blob.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/"); // tolerate wrapping and base64url
  if (text === "" || !/^[A-Za-z0-9+/]+=*$/.test(text)) throw bad("not base64");
  let raw: unknown;
  try {
    raw = JSON.parse(Buffer.from(text, "base64").toString("utf8"));
  } catch {
    throw bad("not base64-encoded JSON");
  }
  const parsed = parseStored(raw);
  if (!parsed) throw bad("unexpected shape");
  if (!parsed.tokens) throw bad("no tokens");
  const out: StoredAuth = { tokens: parsed.tokens };
  if (parsed.clientInformation) out.clientInformation = parsed.clientInformation;
  return out;
}

/**
 * Auth held in memory. `kind` says where it came from: `"env"` is `KEDGEWAY_AUTH` (CI; nothing is ever written
 * to disk), `"snapshot"` is a copy of `auth.json` (see {@link readOnlyAuthStore}) whose only disk write is a
 * refreshed token set, compare-and-swapped into the file it was read from.
 */
export class MemoryAuthStore extends AuthStore {
  private data: StoredAuth;
  private readonly id = randomBytes(6).toString("hex");

  constructor(
    initial: StoredAuth,
    path?: string,
    readonly kind: "env" | "snapshot" = "env",
    private readonly backing?: AuthStore,
  ) {
    super(path);
    this.data = { ...initial };
  }

  override lockKey(): string {
    return this.backing ? this.backing.lockKey() : `memory:${this.id}`;
  }

  override withLock<T>(fn: () => Promise<T>): Promise<T> {
    return this.backing ? this.backing.withLock(fn) : fn();
  }

  override async peek(): Promise<StoredAuth | undefined> {
    return (this.backing && (await this.backing.peek())) || { ...this.data };
  }

  override async casTokens(guard: TokenGuard, tokens: OAuthTokens): Promise<boolean> {
    if (!guard(this.data)) return false;
    this.data = { ...this.data, tokens };
    if (this.backing) await this.backing.casTokens(guard, tokens);
    return true;
  }

  override load(): Promise<StoredAuth> {
    return Promise.resolve({ ...this.data });
  }

  override clear(): Promise<boolean> {
    const had = this.data.tokens !== undefined || this.data.clientInformation !== undefined;
    this.data = {};
    return Promise.resolve(had);
  }

  protected override write(data: StoredAuth): Promise<void> {
    this.data = { ...data };
    return Promise.resolve();
  }
}

/**
 * One in-memory store per `KEDGEWAY_AUTH` value and process, so a token refreshed (and rotated) by one call is
 * what the next call in the same process (e.g. the next MCP tool call) uses.
 */
const envStores = new Map<string, MemoryAuthStore>();
function envStore(blob: string): MemoryAuthStore {
  let store = envStores.get(blob);
  if (!store) {
    store = new MemoryAuthStore(decodeAuth(blob));
    envStores.set(blob, store);
  }
  return store;
}

/** The store live Raven calls use: `KEDGEWAY_AUTH` (in memory) when set, else `auth.json`. */
export function defaultAuthStore(env: NodeJS.ProcessEnv = process.env): AuthStore {
  const blob = env["KEDGEWAY_AUTH"];
  return blob !== undefined && blob.trim() !== "" ? envStore(blob) : new AuthStore();
}

/**
 * The store `kedgeway doctor` uses: `KEDGEWAY_AUTH` when set, else an in-memory copy of `auth.json` (read without
 * quarantining a corrupt file). Nothing on disk is created, removed or quarantined. The one write is a refreshed
 * token set, compare-and-swapped into `auth.json` (only if the file still holds the session that was refreshed):
 * Raven rotates refresh tokens, so a refresh kept only in memory would leave `auth.json` with a dead refresh token.
 */
export async function readOnlyAuthStore(env: NodeJS.ProcessEnv = process.env, path: string = defaultAuthPath()): Promise<AuthStore> {
  const blob = env["KEDGEWAY_AUTH"];
  if (blob !== undefined && blob.trim() !== "") return envStore(blob);
  let stored: StoredAuth = {};
  try {
    stored = parseStored(JSON.parse(await readFile(path, "utf8"))) ?? {};
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code !== undefined && code !== "ENOENT") throw e;
    stored = {}; // missing or corrupt: nothing to serve
  }
  return new MemoryAuthStore(stored, path, "snapshot", new AuthStore(path));
}

const LOCK_STALE_MS = 30_000;
const LOCK_WAIT_MS = 10_000;
const LOCK_POLL_MS = 50;

export interface LockTiming {
  staleMs: number;
  waitMs: number;
  pollMs: number;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function lockAgeMs(lock: string): Promise<number | undefined> {
  try {
    const at = (JSON.parse(await readFile(lock, "utf8")) as { at?: unknown }).at;
    if (typeof at === "number") return Date.now() - at;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return undefined;
  }
  try {
    return Date.now() - (await stat(lock)).mtimeMs; // being written, or unreadable: judge by mtime
  } catch {
    return undefined;
  }
}

/**
 * Cross-process lock for read-tokens -> refresh -> save: `<path>.lock` created with O_EXCL, holding the pid and a
 * timestamp. A lock older than `staleMs` is broken; waits up to `waitMs` polling every `pollMs`; released in
 * `finally` (only if it is still ours). Without the directory there is nothing to protect, so `fn` runs unlocked.
 */
export async function withFileLock<T>(
  path: string,
  fn: () => Promise<T>,
  timing: LockTiming = { staleMs: LOCK_STALE_MS, waitMs: LOCK_WAIT_MS, pollMs: LOCK_POLL_MS },
): Promise<T> {
  const lock = `${path}.lock`;
  const token = randomBytes(8).toString("hex");
  const deadline = Date.now() + timing.waitMs;
  for (;;) {
    try {
      const fh = await openFile(lock, "wx", 0o600);
      try {
        await fh.writeFile(JSON.stringify({ pid: process.pid, at: Date.now(), token }));
      } finally {
        await fh.close();
      }
      break;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return fn();
      if (code !== "EEXIST") throw e;
    }
    const age = await lockAgeMs(lock);
    if (age === undefined) continue; // released meanwhile
    if (age > timing.staleMs) {
      await rm(lock, { force: true });
      continue;
    }
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for ${lock} (another kedgeway process is refreshing the Raven session). Try again.`);
    }
    await sleep(timing.pollMs);
  }
  try {
    return await fn();
  } finally {
    try {
      if ((JSON.parse(await readFile(lock, "utf8")) as { token?: unknown }).token === token) await rm(lock, { force: true });
    } catch {
      // already gone or broken by someone else
    }
  }
}

interface SharedResponse {
  status: number;
  headers: [string, string][];
  body: string;
}

/** In-process single-flight: one refresh per (session store, refresh token) at a time. */
const inflightRefreshes = new Map<string, Promise<SharedResponse>>();

function refreshTokenOf(init: RequestInit | undefined): string | undefined {
  if (init?.method?.toUpperCase() !== "POST") return undefined;
  const body = init.body;
  const params = body instanceof URLSearchParams ? body : typeof body === "string" ? new URLSearchParams(body) : undefined;
  if (params?.get("grant_type") !== "refresh_token") return undefined;
  return params.get("refresh_token") ?? undefined;
}

/** Base64 blob of the stored auth, or null when nothing usable is stored. */
export async function exportAuth(store: AuthStore): Promise<string | null> {
  const stored = await store.load();
  return stored.tokens ? encodeAuth(stored) : null;
}

/**
 * The authorization code from what a user pasted: the full redirect URL (its OAuth state is checked, and the
 * check fails closed when there is no expected state) or a bare code (which carries no state to check).
 */
export function parseAuthorizationInput(input: string, expectedState: string | undefined): string {
  const text = input.trim();
  if (text === "") throw new Error("Empty input: paste the redirect URL or the authorization code.");
  if (!/^https?:\/\//i.test(text)) {
    if (/\s/.test(text)) throw new Error("That is neither a redirect URL nor an authorization code (a code has no spaces).");
    return text;
  }
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error("That does not look like a valid redirect URL.");
  }
  const err = url.searchParams.get("error");
  if (err) throw new Error(`Authorization failed: ${err.replace(/[^\w.-]/g, "?").slice(0, 64)}`);
  const state = url.searchParams.get("state");
  if (expectedState === undefined) {
    throw new Error("Cannot verify the OAuth state of a pasted URL for this login attempt; paste only the code, or use the browser callback.");
  }
  if (state !== expectedState) {
    throw new Error("The pasted URL has a different OAuth state than this login attempt; start `kedgeway login --no-browser` again.");
  }
  const code = url.searchParams.get("code");
  if (!code) throw new Error("The pasted URL has no code parameter.");
  return code;
}

/** What `--no-browser` prints instead of opening a browser. */
export function describeAuthUrl(url: string): string {
  let port: string | null = null;
  try {
    const redirect = new URL(url).searchParams.get("redirect_uri");
    port = redirect ? new URL(redirect).port || null : null;
  } catch {
    port = null;
  }
  const lines = [
    "Open this URL in any browser to authorize kedgeway with Stellar Raven:",
    `  ${url}`,
    "",
    "Afterwards the browser is sent to a 127.0.0.1 address that only exists on this machine. Either:",
    "  - paste the full redirect URL (or just its code) here and press Enter, or",
  ];
  lines.push(
    port
      ? `  - if this machine is remote, forward the callback port first: ssh -L ${port}:127.0.0.1:${port} <this-host>, then open the URL on your own machine.`
      : "  - if this machine is remote, forward the callback port with ssh -L <port>:127.0.0.1:<port> <this-host>.",
  );
  return `${lines.join("\n")}\n`;
}

export type BrowserOpener = (url: string) => Promise<void>;

/** Prints the URL (always) and best-effort opens it in the default browser. */
export const openInBrowser: BrowserOpener = (url) => {
  process.stderr.write(`Open this URL to authorize kedgeway with Stellar Raven:\n  ${url}\n`);
  if (!/^https?:\/\//i.test(url)) return Promise.resolve();
  const [cmd, args]: [string, string[]] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", "", url]]
        : ["xdg-open", [url]];
  try {
    const child = spawn(cmd, args, { stdio: "ignore", detached: true });
    child.on("error", () => undefined);
    child.unref();
  } catch {
    // URL was printed; user can open it manually.
  }
  return Promise.resolve();
};

export interface ProviderOptions {
  /**
   * Silent mode is used for the first, non-interactive connection attempt: it may read
   * credentials and persist refreshed tokens, but never writes client registrations or
   * PKCE verifiers and never opens a browser.
   */
  silent?: boolean;
}

export class FileOAuthProvider implements OAuthClientProvider {
  private currentState: string | undefined;
  private readonly silent: boolean;
  /** The tokens this provider last handed to the SDK (what a refresh or an `invalidateCredentials` refers to). */
  private lastTokens: OAuthTokens | undefined;
  /** Tokens the server rejected during this attempt; hidden from the SDK unless the store holds newer ones. */
  private rejected: OAuthTokens | undefined;
  private hideTokens = false;
  private hideClient = false;
  /** Tokens this attempt refreshed but could not write back (the session on disk changed): used for this attempt only. */
  private pinned: OAuthTokens | undefined;
  /** The client registration this attempt uses. */
  private clientId: string | undefined;

  constructor(
    private readonly store: AuthStore,
    private readonly redirect: string,
    private readonly open: BrowserOpener = openInBrowser,
    options: ProviderOptions = {},
  ) {
    this.silent = options.silent === true;
  }

  get redirectUrl(): string {
    return this.redirect;
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: "kedgeway",
      redirect_uris: [this.redirect],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: "mcp",
    };
  }

  expectedState(): string | undefined {
    return this.currentState;
  }

  state(): string {
    this.currentState = randomBytes(16).toString("hex");
    return this.currentState;
  }

  async clientInformation(): Promise<OAuthClientInformationMixed | undefined> {
    const info = (await this.store.load()).clientInformation;
    if (!info || this.hideClient) {
      // Without a registration the SDK would register a new client, which a silent attempt could not even keep.
      if (this.silent) throw new UnauthorizedError("No stored client registration");
      return undefined;
    }
    if (!this.silent) {
      // A registration is bound to its redirect URI; if the port changed we must re-register.
      const uris = "redirect_uris" in info ? info.redirect_uris : undefined;
      if (uris && !uris.map(String).includes(this.redirect)) return undefined;
    }
    this.clientId = info.client_id;
    return info;
  }

  async saveClientInformation(info: OAuthClientInformationMixed): Promise<void> {
    if (this.silent) return;
    await this.store.update({ clientInformation: info });
    this.clientId = info.client_id;
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    if (this.pinned) return this.pinned;
    const stored = (await this.store.load()).tokens;
    if (this.hideTokens) {
      // After a rejection, tokens another process rotated in the meantime are used; the rejected ones never again.
      if (!stored || (this.rejected !== undefined && sameTokens(stored, this.rejected))) return undefined;
      this.hideTokens = false;
    }
    this.lastTokens = stored;
    return stored;
  }

  /** The write-back guard: the file must still hold the session this attempt started from, under the same client. */
  private sameSession(before: OAuthTokens | undefined, after: OAuthTokens): TokenGuard {
    const clientId = this.clientId;
    return (current) =>
      current.clientInformation?.client_id === clientId &&
      current.tokens !== undefined &&
      (sameTokens(current.tokens, before) || sameTokens(current.tokens, after));
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    this.hideTokens = false;
    this.rejected = undefined;
    if (!this.silent) {
      // An interactive login owns the store: it writes what the user just authorized.
      await this.store.update({ tokens });
      this.pinned = undefined;
      this.lastTokens = tokens;
      return;
    }
    const guard = this.sameSession(this.lastTokens, tokens);
    const written = await this.store.withLock(() => this.store.casTokens(guard, tokens));
    if (written) {
      this.pinned = undefined;
      this.lastTokens = tokens;
    } else {
      this.pinned = tokens; // logged out or logged in again meanwhile: never clobber that, but finish this attempt
    }
  }

  /**
   * A `fetch` for the transport that serialises refresh-token requests: one per session store and refresh token in
   * this process (single-flight), and one at a time across processes (`auth.json.lock`). Under the lock it first
   * re-reads the store: if another process already rotated the session, its tokens are returned instead of
   * spending the old refresh token; otherwise the refresh is sent and its result written back before the lock is
   * released.
   */
  guardFetch(base: typeof fetch = fetch): typeof fetch {
    return async (input, init) => {
      const sent = refreshTokenOf(init);
      if (sent === undefined) return base(input, init);
      const key = `${this.store.lockKey()}\n${sent}`;
      let shared = inflightRefreshes.get(key);
      if (!shared) {
        shared = this.store.withLock(() => this.refreshUnderLock(base, input, init, sent)).finally(() => inflightRefreshes.delete(key));
        inflightRefreshes.set(key, shared);
      }
      const r = await shared;
      return new Response(r.body, { status: r.status, headers: r.headers });
    };
  }

  private async refreshUnderLock(
    base: typeof fetch,
    input: Parameters<typeof fetch>[0],
    init: RequestInit | undefined,
    sent: string,
  ): Promise<SharedResponse> {
    const now = await this.store.peek();
    const onDisk = now?.tokens;
    if (
      onDisk?.refresh_token !== undefined &&
      onDisk.refresh_token !== sent &&
      now?.clientInformation?.client_id === this.clientId &&
      !(this.rejected !== undefined && sameTokens(onDisk, this.rejected))
    ) {
      const { issuer: _issuer, ...wire } = onDisk;
      return { status: 200, headers: [["content-type", "application/json"]], body: JSON.stringify(wire) };
    }
    const res = await base(input, init);
    const body = await res.text();
    if (res.ok) {
      try {
        const parsed = OAuthTokensSchema.safeParse(JSON.parse(body));
        if (parsed.success) {
          const next: OAuthTokens = { refresh_token: sent, ...parsed.data };
          if (onDisk?.issuer !== undefined) next.issuer = onDisk.issuer;
          const clientId = this.clientId;
          await this.store.casTokens((c) => c.clientInformation?.client_id === clientId && c.tokens?.refresh_token === sent, next);
        }
      } catch {
        // not JSON: the SDK reports it
      }
    }
    return { status: res.status, headers: [...res.headers.entries()], body };
  }

  async redirectToAuthorization(url: URL): Promise<void> {
    if (this.silent) return;
    await this.open(url.toString());
  }

  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    if (this.silent) return;
    await this.store.update({ codeVerifier });
  }

  async codeVerifier(): Promise<string> {
    const v = (await this.store.load()).codeVerifier;
    if (!v) throw new Error("No PKCE code verifier saved; restart the login flow");
    return v;
  }

  /**
   * Called by the SDK when the server rejects stored credentials (e.g. `invalid_grant` on a refresh). The rejected
   * credentials are hidden from the rest of this attempt (newer tokens in the store are still used). A silent
   * attempt never deletes anything: it only fails, and the caller decides whether to authorize again. An
   * interactive attempt deletes the rejected tokens, but only if they are still the ones on disk.
   */
  async invalidateCredentials(scope: "all" | "client" | "tokens" | "verifier" | "discovery"): Promise<void> {
    if (scope === "all" || scope === "tokens") {
      this.hideTokens = true;
      this.rejected = this.pinned ?? this.lastTokens;
      this.pinned = undefined;
    }
    if (scope === "all" || scope === "client") this.hideClient = true;
    if (this.silent) return;
    if (scope === "all") await this.store.remove(["clientInformation", "codeVerifier"]);
    else if (scope === "client") await this.store.remove(["clientInformation"]);
    else if (scope === "verifier") await this.store.remove(["codeVerifier"]);
    if (scope === "all" || scope === "tokens") {
      const current = (await this.store.load()).tokens;
      if (current && sameTokens(current, this.lastTokens)) await this.store.remove(["tokens"]);
    }
  }
}

function sameTokens(a: OAuthTokens, b: OAuthTokens | undefined): boolean {
  return b !== undefined && a.access_token === b.access_token && a.refresh_token === b.refresh_token;
}

export interface CallbackServer {
  redirectUrl: string;
  port: number;
  /** Resolves with the authorization code; rejects on error, state mismatch or timeout. */
  code: Promise<string>;
  close: () => Promise<void>;
}

const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000;

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
}

export async function startCallbackServer(
  preferredPort: number | undefined,
  expectedState: () => string | undefined,
  timeoutMs: number = CALLBACK_TIMEOUT_MS,
): Promise<CallbackServer> {
  let resolveCode!: (c: string) => void;
  let rejectCode!: (e: Error) => void;
  const code = new Promise<string>((res, rej) => {
    resolveCode = res;
    rejectCode = rej;
  });
  code.catch(() => undefined);

  const HEADERS = { "content-type": "text/plain; charset=utf-8", "x-content-type-options": "nosniff" };
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const reply = (status: number, msg: string): void => {
      res.writeHead(status, HEADERS).end(`kedgeway: ${msg}`);
    };
    if (url.pathname !== "/callback") {
      reply(404, "not found");
      return;
    }
    const exp = expectedState();
    if (exp === undefined || url.searchParams.get("state") !== exp) {
      reply(400, "invalid OAuth state"); // keep waiting: stray requests must not abort the login
      return;
    }
    const err = url.searchParams.get("error");
    if (err) {
      reply(400, "authorization failed; see the terminal");
      rejectCode(new Error(`Authorization failed: ${err.replace(/[^\w.-]/g, "?").slice(0, 64)}`));
      return;
    }
    const c = url.searchParams.get("code");
    if (!c) {
      reply(400, "missing authorization code");
      return;
    }
    reply(200, "authorization complete. You can close this tab.");
    resolveCode(c);
  });

  try {
    await listen(server, preferredPort ?? 0);
  } catch {
    await listen(server, 0);
  }
  const addr = server.address();
  if (addr === null || typeof addr === "string") throw new Error("Could not determine callback port");

  const timer = setTimeout(() => rejectCode(new Error("Timed out waiting for OAuth callback")), timeoutMs);
  timer.unref();

  return {
    port: addr.port,
    redirectUrl: `http://127.0.0.1:${addr.port}/callback`,
    code,
    close: () =>
      new Promise<void>((resolve) => {
        clearTimeout(timer);
        server.close(() => resolve());
        server.closeAllConnections();
      }),
  };
}
