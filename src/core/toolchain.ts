import { parse as parseToml } from "smol-toml";
import { packageJsonDepLines } from "./manifest-edit.js";
import { parseVersion } from "./repo-facts.js";

/** Official setup guide: the Rust requirement and the `wasm32v1-none` target. */
export const SETUP_DOC_URL = "https://developers.stellar.org/docs/build/smart-contracts/getting-started/setup";
/** When the facts taken from {@link SETUP_DOC_URL} were last verified. */
export const SETUP_DOC_OBSERVED = "2026-11-12";
/** Minimum Rust toolchain for Stellar smart contracts, per {@link SETUP_DOC_URL}. */
export const RUST_MIN_VERSION = "1.84.0";

export type CliPinSource = "workflow" | "dockerfile" | "makefile" | "script" | "tool-versions" | "package.json";

/** A place where the repository pins the Stellar CLI to a version. */
export interface CliPin {
  /** The version text as written (`v21.5.0`, `^22`, `main`, `${{ env.X }}`). */
  raw: string;
  /** Parsed version without a leading `v`; null when unparseable. */
  version: string | null;
  major: number | null;
  file: string;
  /** 1-based line of the pin. */
  line: number;
  source: CliPinSource;
  /** How the pin is expressed, for evidence (`cargo install --version`, `stellar-cli@`, ...). */
  via: string;
}

export type RustTargetName = "wasm32-unknown-unknown" | "wasm32v1-none";

export interface RustTargetDecl {
  target: RustTargetName;
  file: string;
  line: number;
  via: string;
  /** Set when the declaring line also uses wasm-pack, wasm-bindgen or trunk (browser Wasm, not a contract build). */
  webTooling?: true;
}

export interface RustToolchainPin {
  /** The channel as written. */
  channel: string;
  /** `X.Y.Z` when the channel is numeric (a pin); null for `stable`, `nightly-...` and friends. */
  version: string | null;
  file: string;
  line: number;
}

export interface ToolchainFacts {
  cliPins: CliPin[];
  rustTargets: RustTargetDecl[];
  rustToolchains: RustToolchainPin[];
}

export function emptyToolchain(): ToolchainFacts {
  return { cliPins: [], rustTargets: [], rustToolchains: [] };
}

export function mergeToolchain(...parts: ToolchainFacts[]): ToolchainFacts {
  const out = emptyToolchain();
  for (const p of parts) {
    out.cliPins.push(...p.cliPins);
    out.rustTargets.push(...p.rustTargets);
    out.rustToolchains.push(...p.rustToolchains);
  }
  return out;
}

export function isEmptyToolchain(t: ToolchainFacts): boolean {
  return t.cliPins.length === 0 && t.rustTargets.length === 0 && t.rustToolchains.length === 0;
}

export type ToolchainFileKind = "workflow" | "dockerfile" | "makefile" | "script" | "tool-versions" | "rust-toolchain" | "cargo-config" | "package.json";

/** Which toolchain-bearing file (if any) a scan-root-relative posix path is. */
export function toolchainFileKind(rel: string): ToolchainFileKind | null {
  const base = rel.split("/").pop() ?? rel;
  if (/(?:^|\/)\.github\/workflows\/[^/]+\.ya?ml$/.test(rel)) return "workflow";
  if (base.startsWith("Dockerfile") || base.endsWith(".Dockerfile")) return "dockerfile";
  if (base === "Makefile" || base === "makefile" || base === "GNUmakefile" || base.endsWith(".mk")) return "makefile";
  if (/^[^/]+\.sh$/.test(rel) || /^scripts\/.+\.sh$/.test(rel)) return "script";
  if (base === ".tool-versions") return "tool-versions";
  if (base === "rust-toolchain.toml" || base === "rust-toolchain") return "rust-toolchain";
  if (/(?:^|\/)\.cargo\/config(?:\.toml)?$/.test(rel)) return "cargo-config";
  if (base === "package.json") return "package.json";
  return null;
}

// ---------- helpers ----------

const TARGETS: readonly RustTargetName[] = ["wasm32-unknown-unknown", "wasm32v1-none"];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Logical lines longer than this are skipped: they are not hand-written commands and bound every scan below. */
export const MAX_LOGICAL_LINE = 8192;

/**
 * Joins backslash continuations, drops comment lines and trailing ` # ...`, and drops logical lines longer than
 * {@link MAX_LOGICAL_LINE}; `line` is the first physical line.
 */
function logicalLines(text: string): { text: string; line: number }[] {
  const out: { text: string; line: number }[] = [];
  let cur: { text: string; line: number; over: boolean } | null = null;
  const flush = (): void => {
    if (cur !== null && !cur.over) out.push({ text: cur.text.replace(/\s#.*$/, ""), line: cur.line });
    cur = null;
  };
  const physical = text.split(/\r?\n/);
  for (let i = 0; i < physical.length; i += 1) {
    const raw = physical[i] ?? "";
    if (raw.trimStart().startsWith("#")) continue;
    const continues = /\\\s*$/.test(raw);
    const piece = raw.replace(/\\\s*$/, "");
    if (cur === null) cur = { text: "", line: i + 1, over: false };
    if (!cur.over) {
      cur.text = cur.text === "" ? piece : `${cur.text} ${piece.trim()}`;
      if (cur.text.length > MAX_LOGICAL_LINE) {
        cur.over = true;
        cur.text = "";
      }
    }
    if (!continues) flush();
  }
  flush();
  return out;
}

/** First non-comment line (1-based) satisfying `test`, or 1. With `section`, lines inside `[section]` win. */
function findLine(content: string, test: (line: string) => boolean, section?: string): number {
  const lines = content.split(/\r?\n/);
  let current = "";
  let fallback = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const l = lines[i] ?? "";
    if (l.trimStart().startsWith("#")) continue;
    const h = /^\s*\[\[?\s*([^\]]+?)\s*\]\]?\s*(?:#.*)?$/.exec(l);
    if (h?.[1] !== undefined) {
      current = h[1];
      continue;
    }
    if (!test(l)) continue;
    if (section === undefined || current === section) return i + 1;
    if (fallback === 0) fallback = i + 1;
  }
  return fallback === 0 ? 1 : fallback;
}

function mkPin(raw: string, file: string, line: number, source: CliPinSource, via: string): CliPin {
  const parsed = parseVersion(raw.replace(/^v(?=\d)/i, ""));
  return { raw, version: parsed.version, major: parsed.major, file, line, source, via };
}

// ---------- stellar-cli pins ----------

const SOURCE_OF: Partial<Record<ToolchainFileKind, CliPinSource>> = {
  workflow: "workflow",
  dockerfile: "dockerfile",
  makefile: "makefile",
  script: "script",
  "tool-versions": "tool-versions",
};

const TOKEN = "[^\\s\"'`\\\\;&|)<>]+";
const AT_PIN = new RegExp(`(?<![\\w/.@-])((?:stellar|soroban)-cli)@(${TOKEN})`);
const NPM_PIN = new RegExp(`(?<![\\w.-])@stellar/stellar-cli@(${TOKEN})`);
const RELEASE_PATH = /stellar\/stellar-cli\/releases\/download\/v?(\d+\.\d+\.\d+)\//;
const RELEASE_ASSET = /(?<![\w.-])stellar-cli-v?(\d+\.\d+\.\d+)(?=[-.][A-Za-z])/;
const LEGACY = "legacy soroban-cli";
const SEGMENT_SPLIT = /&&|\|\||[;|]/;
/** `cargo install`/`binstall` flags that consume the next token as a value. */
const VALUE_FLAGS = new Set([
  "--version", "--git", "--tag", "--branch", "--rev", "--root", "--features", "-F", "--target", "--path", "--registry",
  "--index", "--jobs", "-j", "--profile", "--bin", "--example", "--config", "--color", "--target-dir", "--manifest-path",
]);

const unquote = (t: string): string => t.replace(/^["'`]+|["'`),]+$/g, "");

/** Drops a leading YAML list dash, YAML key, Dockerfile `RUN`/`CMD` and Make `@`/`-` from a command segment. */
function stripPrefix(segment: string): string {
  return segment.trim().replace(/^-\s+/, "").replace(/^[A-Za-z_][\w-]*:\s+/, "").replace(/^(?:RUN|CMD)\s+/i, "").replace(/^[@-]+/, "");
}

const PRINTING = new Set(["echo", "printf", "cat"]);

/** The line without command segments that only print (`echo`, `printf`, `cat`): text they mention is not a declaration. */
function withoutPrinting(text: string): string {
  return text
    .split(SEGMENT_SPLIT)
    .filter((seg) => !PRINTING.has(stripPrefix(seg).split(/\s+/, 1)[0] ?? ""))
    .join(" ; ");
}

/** Positional crates and flag values of a segment that is a `cargo install|binstall` command; null for anything else. */
function cargoInstallArgs(segment: string): { crates: string[]; flags: Map<string, string> } | null {
  const tokens = stripPrefix(segment).split(/\s+/).map(unquote);
  let i = 0;
  while (i < tokens.length && (tokens[i] === "sudo" || /^\w+=\S*$/.test(tokens[i] ?? ""))) i += 1;
  if (tokens[i] !== "cargo") return null;
  i += 1;
  if (tokens[i]?.startsWith("+") === true) i += 1; // `cargo +stable install`
  if (tokens[i] !== "install" && tokens[i] !== "binstall") return null;
  i -= 1;
  const crates: string[] = [];
  const flags = new Map<string, string>();
  for (i += 2; i < tokens.length; i += 1) {
    const t = tokens[i] ?? "";
    if (t.startsWith("--") && t.includes("=")) {
      const eq = t.indexOf("=");
      if (VALUE_FLAGS.has(t.slice(0, eq))) flags.set(t.slice(0, eq), unquote(t.slice(eq + 1)));
    } else if (VALUE_FLAGS.has(t)) {
      flags.set(t, unquote(tokens[i + 1] ?? ""));
      i += 1;
    } else if (!t.startsWith("-") && t !== "") crates.push(t);
  }
  return { crates, flags };
}

function cliPinsFromLine(rawText: string, file: string, line: number, source: CliPinSource): CliPin[] {
  const text = withoutPrinting(rawText);
  const at = AT_PIN.exec(text);
  if (at?.[1] !== undefined && at[2] !== undefined) {
    return [mkPin(at[2], file, line, source, at[1] === "soroban-cli" ? `soroban-cli@ (${LEGACY})` : "stellar-cli@")];
  }
  const npm = NPM_PIN.exec(text);
  if (npm?.[1] !== undefined) return [mkPin(npm[1], file, line, source, "npm @stellar/stellar-cli@")];
  const rel = RELEASE_PATH.exec(text) ?? RELEASE_ASSET.exec(text);
  if (rel?.[1] !== undefined) return [mkPin(rel[1], file, line, source, "release download")];
  const out: CliPin[] = [];
  for (const segment of text.split(SEGMENT_SPLIT)) {
    const args = cargoInstallArgs(segment);
    if (args === null) continue;
    const legacy = !args.crates.includes("stellar-cli") && args.crates.includes("soroban-cli");
    if (!legacy && !args.crates.includes("stellar-cli")) continue;
    const tag = args.flags.get("--tag");
    const version = args.flags.get("--version") ?? tag;
    if (version === undefined || version === "") continue;
    const via = args.flags.has("--version") ? "cargo install --version" : "cargo install --tag";
    out.push(mkPin(version, file, line, source, legacy ? `${via} (${LEGACY})` : via));
  }
  return out;
}

/** How many lines after `uses:` are searched for the step's `version:` input. */
const ACTION_LOOKAHEAD = 30;

/** `uses: stellar/stellar-cli@...` steps: the pin is the step's `version:` input, not the action ref. */
function actionPins(text: string, file: string): CliPin[] {
  const out: CliPin[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const l = lines[i] ?? "";
    if (l.length > MAX_LOGICAL_LINE || l.trimStart().startsWith("#")) continue;
    if (!/(?:^|\s)uses:\s*["']?stellar\/stellar-cli(?:@|["']?\s*$)/.test(l)) continue;
    const keyCol = l.indexOf("uses:");
    for (let j = i + 1; j < lines.length && j <= i + ACTION_LOOKAHEAD; j += 1) {
      const n = lines[j] ?? "";
      if (n.trim() === "") continue;
      if (n.length - n.trimStart().length < keyCol) break;
      const v = /^\s*version:\s*["']?([^\s"'#]+)/.exec(n);
      if (v?.[1] !== undefined) {
        out.push(mkPin(v[1], file, j + 1, "workflow", "stellar/stellar-cli action version input"));
        break;
      }
    }
  }
  return out;
}

export function parsePackageJsonCliPins(content: string, file: string): CliPin[] {
  let doc: unknown;
  try {
    doc = JSON.parse(content.replace(/^﻿/, ""));
  } catch {
    return [];
  }
  if (!isRecord(doc)) return [];
  const lines = packageJsonDepLines(content);
  const out: CliPin[] = [];
  for (const section of ["dependencies", "devDependencies"] as const) {
    const table = doc[section];
    if (!isRecord(table)) continue;
    const raw = table["@stellar/stellar-cli"];
    if (typeof raw === "string") out.push(mkPin(raw, file, lines[section].get("@stellar/stellar-cli") ?? 1, "package.json", section));
  }
  return out;
}

// ---------- rust targets ----------

const WEB_TOOLING = /(?<![\w-])(?:wasm-pack|wasm-bindgen|trunk)(?![\w-])/;
const TARGETS_KEY = /(?:^|\s)targets?\s*[:=]/;
const VIAS = ["rustup target add", "--target", "CARGO_BUILD_TARGET", "targets:"] as const;

/** Tokens of a command segment, quotes and list punctuation stripped. */
const words = (s: string): string[] => s.split(/[\s,]+/).map((t) => t.replace(/^["'\[]+|["'\]]+$/g, "")).filter((t) => t !== "");

/** Which vias declare which targets in one (length-capped) logical line. Token equality, no backtracking scans. */
function targetsFromLine(rawText: string, file: string, line: number): RustTargetDecl[] {
  const text = withoutPrinting(rawText);
  const hits = new Map<RustTargetName, Set<string>>();
  const hit = (t: string, via: string): void => {
    if ((TARGETS as readonly string[]).includes(t)) hits.set(t as RustTargetName, (hits.get(t as RustTargetName) ?? new Set()).add(via));
  };
  for (const segment of text.split(SEGMENT_SPLIT)) {
    const w = words(segment);
    for (let i = 0; i < w.length; i += 1) {
      const t = w[i] ?? "";
      if (t === "rustup" && w[i + 1] === "target" && w[i + 2] === "add") for (let j = i + 3; j < w.length && w[j] !== "rustup"; j += 1) hit(w[j] ?? "", "rustup target add");
      else if (t === "--target") hit(w[i + 1] ?? "", "--target");
      else if (t.startsWith("--target=")) hit(t.slice(9), "--target");
      else if (t.startsWith("CARGO_BUILD_TARGET=")) hit(t.slice(19), "CARGO_BUILD_TARGET");
      else if (t === "CARGO_BUILD_TARGET") hit(w[i + 1] === "=" ? (w[i + 2] ?? "") : (w[i + 1] ?? ""), "CARGO_BUILD_TARGET");
    }
    const key = TARGETS_KEY.exec(segment);
    if (key) for (const x of words(segment.slice(key.index + key[0].length))) hit(x, "targets:");
  }
  const web = WEB_TOOLING.test(text);
  const out: RustTargetDecl[] = [];
  for (const target of TARGETS) {
    const vias = hits.get(target);
    const via = vias === undefined ? undefined : VIAS.find((v) => vias.has(v));
    if (via !== undefined) out.push({ target, file, line, via, ...(web ? { webTooling: true as const } : {}) });
  }
  return out;
}

function stringList(v: unknown): string[] {
  if (typeof v === "string") return [v];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function declaredTargets(names: string[], content: string, file: string, via: string, section: string): RustTargetDecl[] {
  const out: RustTargetDecl[] = [];
  for (const target of TARGETS) {
    if (!names.includes(target)) continue;
    out.push({ target, file, line: findLine(content, (l) => l.includes(`"${target}"`) || l.includes(`'${target}'`), section), via });
  }
  return out;
}

// ---------- rust toolchain ----------

function rustVersionOf(channel: string): string | null {
  const m = /^(\d+)\.(\d+)(?:\.(\d+))?(?:-[a-z0-9_]+(?:-[a-z0-9_]+)+)?$/.exec(channel.trim());
  return m ? `${m[1]}.${m[2]}.${m[3] ?? "0"}` : null;
}

/** Negative when `a` < `b`, 0 when equal, positive when `a` > `b` (numeric dotted versions). */
export function compareRustVersion(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

function scanRustToolchain(rel: string, content: string): ToolchainFacts {
  const out = emptyToolchain();
  const legacy = (rel.split("/").pop() ?? rel) === "rust-toolchain";
  if (legacy && !/^\s*\[toolchain\]/m.test(content)) {
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const t = (lines[i] ?? "").trim();
      if (t === "" || t.startsWith("#")) continue;
      const version = rustVersionOf(t);
      if (version !== null) out.rustToolchains.push({ channel: t, version, file: rel, line: i + 1 });
      break;
    }
    return out;
  }
  let doc: unknown;
  try {
    doc = parseToml(content);
  } catch {
    return out;
  }
  const tc = isRecord(doc) ? doc["toolchain"] : undefined;
  if (!isRecord(tc)) return out;
  const channel = tc["channel"];
  if (typeof channel === "string") {
    const version = rustVersionOf(channel);
    if (version !== null) out.rustToolchains.push({ channel, version, file: rel, line: findLine(content, (l) => /^\s*channel\s*=/.test(l)) });
  }
  out.rustTargets.push(...declaredTargets(stringList(tc["targets"]), content, rel, "rust-toolchain targets", "toolchain"));
  return out;
}

function scanCargoConfig(rel: string, content: string): ToolchainFacts {
  const out = emptyToolchain();
  let doc: unknown;
  try {
    doc = parseToml(content);
  } catch {
    return out;
  }
  const build = isRecord(doc) ? doc["build"] : undefined;
  if (isRecord(build)) out.rustTargets.push(...declaredTargets(stringList(build["target"]), content, rel, "[build] target", "build"));
  return out;
}

/** Pure scan of one file's text for toolchain facts. Files of other kinds yield nothing. */
export function scanToolchainText(rel: string, content: string): ToolchainFacts {
  const kind = toolchainFileKind(rel);
  const out = emptyToolchain();
  if (kind === null) return out;
  if (kind === "package.json") {
    out.cliPins.push(...parsePackageJsonCliPins(content, rel));
    return out;
  }
  if (kind === "rust-toolchain") return scanRustToolchain(rel, content);
  if (kind === "cargo-config") return scanCargoConfig(rel, content);
  const source = SOURCE_OF[kind];
  if (source === undefined) return out;
  if (kind === "tool-versions") {
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const l = lines[i] ?? "";
      if (l.trimStart().startsWith("#")) continue;
      const m = /^\s*stellar-cli\s+(\S+)/.exec(l);
      if (m?.[1] !== undefined) out.cliPins.push(mkPin(m[1], rel, i + 1, source, ".tool-versions"));
    }
    return out;
  }
  for (const l of logicalLines(content)) {
    out.cliPins.push(...cliPinsFromLine(l.text, rel, l.line, source));
    out.rustTargets.push(...targetsFromLine(l.text, rel, l.line));
  }
  if (kind === "workflow") out.cliPins.push(...actionPins(content, rel));
  return out;
}
