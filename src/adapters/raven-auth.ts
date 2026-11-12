import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { z } from "zod";
import {
  OAuthClientInformationSchema,
  OAuthTokensSchema,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { createServer, type Server } from "node:http";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
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

export function defaultAuthPath(): string {
  return join(homedir(), ".config", "kedgeway", "auth.json");
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

export class AuthStore {
  constructor(
    private readonly path: string = defaultAuthPath(),
    private readonly warn: (message: string) => void = (m) => void process.stderr.write(m),
  ) {}

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

  async remove(keys: (keyof StoredAuth)[]): Promise<void> {
    const current = await this.load();
    for (const k of keys) delete current[k];
    await this.write(current);
  }

  async clear(): Promise<boolean> {
    try {
      await readFile(this.path);
    } catch {
      return false;
    }
    await rm(this.path, { force: true });
    return true;
  }

  protected async write(data: StoredAuth): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const tmp = `${this.path}.${process.pid}.tmp`;
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

/** Auth held only in memory (used for `KEDGEWAY_AUTH` in CI): refreshed tokens are never written to disk. */
export class MemoryAuthStore extends AuthStore {
  private data: StoredAuth;

  constructor(initial: StoredAuth, path?: string) {
    super(path);
    this.data = { ...initial };
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

/** The store live Raven calls use: `KEDGEWAY_AUTH` (in memory) when set, else `auth.json`. */
export function defaultAuthStore(env: NodeJS.ProcessEnv = process.env): AuthStore {
  const blob = env["KEDGEWAY_AUTH"];
  return blob !== undefined && blob.trim() !== "" ? new MemoryAuthStore(decodeAuth(blob)) : new AuthStore();
}

/** Base64 blob of the stored auth, or null when nothing usable is stored. */
export async function exportAuth(store: AuthStore): Promise<string | null> {
  const stored = await store.load();
  return stored.tokens ? encodeAuth(stored) : null;
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
    if (!info) return undefined;
    if (this.silent) return info;
    // A registration is bound to its redirect URI; if the port changed we must re-register.
    const uris = "redirect_uris" in info ? info.redirect_uris : undefined;
    if (uris && !uris.map(String).includes(this.redirect)) return undefined;
    return info;
  }

  async saveClientInformation(info: OAuthClientInformationMixed): Promise<void> {
    if (this.silent) return;
    await this.store.update({ clientInformation: info });
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    return (await this.store.load()).tokens;
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    await this.store.update({ tokens });
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

  async invalidateCredentials(scope: "all" | "client" | "tokens" | "verifier" | "discovery"): Promise<void> {
    if (scope === "all") await this.store.remove(["clientInformation", "tokens", "codeVerifier"]);
    else if (scope === "client") await this.store.remove(["clientInformation"]);
    else if (scope === "tokens") await this.store.remove(["tokens"]);
    else if (scope === "verifier") await this.store.remove(["codeVerifier"]);
  }
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
