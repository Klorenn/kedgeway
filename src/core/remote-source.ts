/**
 * Pure parsing of a "repo source" argument: a local path, or a remote git repository
 * (https/http/ssh URL, scp-style `git@host:o/r`, or the GitHub shorthand `o/r`).
 * Whether a shorthand-looking string is really a local directory is decided by the adapter
 * (it checks the filesystem first); this module only parses text.
 */

export type RepoSource =
  | { kind: "local" }
  | { kind: "remote"; cloneUrl: string; host: string; owner: string; repo: string; ref?: string; display: string };

export type RemoteSource = Extract<RepoSource, { kind: "remote" }>;

const REF_RE = /^[A-Za-z0-9._/-]+$/;
const SEGMENT_RE = /^[A-Za-z0-9._-]+$/;
const HOST_RE = /^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$/;

/** A ref is passed to `git clone --branch`: keep it to a conservative alphabet and never let it look like an option. */
export function validateRef(ref: string): string {
  if (!REF_RE.test(ref) || ref.startsWith("-") || ref.includes("..") || ref.includes("//")) {
    throw new Error('invalid ref (allowed: letters, digits, . _ / -; may not start with "-")');
  }
  return ref;
}

/** Rejection messages never echo the raw input (it may carry credentials); at most a scheme or a validated host. */
function checkSegments(segments: string[]): void {
  for (const s of segments) {
    if (s === "." || s === ".." || !SEGMENT_RE.test(s)) throw new Error("invalid path segment in the repository source (allowed: letters, digits, . _ -)");
  }
}

const INTERNAL_SUFFIXES = [".local", ".internal", ".localhost", ".localdomain", ".lan", ".home.arpa", ".corp"];

/**
 * Only public-looking DNS names are accepted: no IP literals in any notation (URL() normalises 0x7f.1 and
 * 2130706433 to dotted quads; a name whose last label is numeric or 0x.. is treated as one), no single-label
 * names, no `localhost`, no internal suffixes. This is a syntactic check; it does not stop DNS rebinding.
 */
export function checkHost(hostRaw: string): string {
  const host = hostRaw.toLowerCase().replace(/\.$/, "");
  const last = host.slice(host.lastIndexOf(".") + 1);
  const bad =
    host === "" ||
    host.includes(":") ||
    host.startsWith("[") ||
    !host.includes(".") ||
    /^(0x[0-9a-f]*|\d+)$/.test(last) ||
    host === "localhost" ||
    INTERNAL_SUFFIXES.some((x) => host.endsWith(x));
  if (bad || !HOST_RE.test(host)) throw new Error("host not allowed: IP addresses, localhost and internal names are rejected (use a public DNS name)");
  return host;
}

function stripGit(name: string): string {
  return name.endsWith(".git") ? name.slice(0, -4) : name;
}

function build(host: string, owner: string, repo: string, ref: string | undefined, cloneUrl: string): RemoteSource {
  return {
    kind: "remote",
    cloneUrl,
    host,
    owner,
    repo,
    ...(ref === undefined ? {} : { ref }),
    display: `${host}/${owner}/${repo}${ref === undefined ? "" : `@${ref}`}`,
  };
}

/** Splits the URL path into owner/repo and an optional `/tree/<ref>` (GitHub) or `/-/tree/<ref>` (GitLab). */
function splitPath(host: string, pathname: string): { owner: string; repo: string; ref?: string } {
  const segs = pathname.split("/").filter((s) => s !== "");
  let refRaw: string | undefined;
  let repoSegs = segs;
  const dash = segs.indexOf("-");
  if (dash >= 0 && segs[dash + 1] === "tree" && segs[dash + 2] !== undefined) {
    repoSegs = segs.slice(0, dash);
    refRaw = segs[dash + 2];
  } else if (host === "github.com") {
    if (segs[2] === "tree" && segs[3] !== undefined) refRaw = segs[3];
    repoSegs = segs.slice(0, 2);
  }
  if (repoSegs.length < 2) throw new Error("expected owner/repo in the repository source");
  const last = stripGit(repoSegs[repoSegs.length - 1] as string);
  const owners = repoSegs.slice(0, -1);
  checkSegments([...owners, last]);
  if (last === "") throw new Error("invalid repository name in the repository source");
  let ref: string | undefined;
  if (refRaw !== undefined) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(refRaw);
    } catch {
      throw new Error("invalid ref (bad percent-encoding)");
    }
    ref = validateRef(decoded);
  }
  return { owner: owners.join("/"), repo: last, ...(ref === undefined ? {} : { ref }) };
}

export interface ParseOptions {
  /** Accept `http://` URLs (default true). The MCP server passes false: https and ssh only. */
  allowHttp?: boolean;
}

export function parseRepoSource(input: string, opts: ParseOptions = {}): RepoSource {
  const raw = input.trim();
  // scp-style: git@host:owner/repo(.git)
  const scp = /^([A-Za-z0-9._-]+)@([A-Za-z0-9.-]+):(?!\/\/)(.+)$/.exec(raw);
  if (scp) {
    const [, user, host, path] = scp as unknown as [string, string, string, string];
    if (user !== "git") throw new Error("unsupported ssh user (only git@ is accepted)");
    const h = checkHost(host);
    const { owner, repo } = splitPath(h, path);
    return build(h, owner, repo, undefined, `git@${h}:${owner}/${repo}.git`);
  }
  const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(raw);
  if (scheme && (scheme[1] as string).length > 1) {
    const name = (scheme[1] as string).toLowerCase();
    if (!raw.includes("://") || (name !== "https" && name !== "http" && name !== "ssh")) {
      throw new Error(`unsupported repository source: scheme ${name}: is not allowed (use https://, ${opts.allowHttp === false ? "" : "http://, "}ssh:// or git@host:owner/repo)`);
    }
    if (name === "http" && opts.allowHttp === false) throw new Error("http:// is not allowed here (use https:// or ssh)");
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new Error("invalid repository URL");
    }
    if (name === "ssh") {
      if (url.password !== "" || url.username !== "git") throw new Error("ssh URLs must use the git user (ssh://git@host/owner/repo)");
    } else if (url.username !== "" || url.password !== "") {
      throw new Error("embedded credentials in the URL are not allowed (use git credentials on the machine instead)");
    }
    const host = checkHost(url.hostname);
    const { owner, repo, ref } = splitPath(host, url.pathname);
    const cloneUrl =
      name === "ssh"
        ? `ssh://git@${host}${url.port ? `:${url.port}` : ""}/${owner}/${repo}.git`
        : `${name}://${host}${url.port ? `:${url.port}` : ""}/${owner}/${repo}.git`;
    return build(host, owner, repo, ref, cloneUrl);
  }
  // GitHub shorthand: exactly one slash, no leading "." or "/", nothing that looks like a path.
  const short = /^([A-Za-z0-9_][A-Za-z0-9._-]*)\/([A-Za-z0-9_][A-Za-z0-9._-]*)$/.exec(raw);
  if (short) {
    const owner = short[1] as string;
    const repo = stripGit(short[2] as string);
    if (repo !== "") return build("github.com", owner, repo, undefined, `https://github.com/${owner}/${repo}.git`);
  }
  return { kind: "local" };
}
