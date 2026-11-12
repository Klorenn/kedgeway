import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { gunzipSync } from "node:zlib";

export interface TarLimits {
  /** Maximum unpacked bytes (default 50 MB). */
  maxBytes?: number;
  /** Maximum entries (default 20 000). */
  maxEntries?: number;
}

export const MAX_UNPACKED_BYTES = 50 * 1024 * 1024;
export const MAX_ENTRIES = 20_000;

function cString(buf: Uint8Array, start: number, len: number): string {
  let end = start;
  const stop = start + len;
  while (end < stop && buf[end] !== 0) end += 1;
  return Buffer.from(buf.subarray(start, end)).toString("utf8");
}

function octal(buf: Uint8Array, start: number, len: number): number {
  const s = cString(buf, start, len).trim();
  if (s === "") return 0;
  if (!/^[0-7]+$/.test(s)) throw new Error("invalid tar header (bad number)");
  return parseInt(s, 8);
}

/** pax extended header records: "<len> <key>=<value>\n" (len counts bytes of the whole record). */
function paxPath(data: Uint8Array): string | undefined {
  const buf = Buffer.from(data);
  let pos = 0;
  let path: string | undefined;
  while (pos < buf.length) {
    const sp = buf.indexOf(0x20, pos);
    if (sp < 0) break;
    const len = Number(buf.subarray(pos, sp).toString("utf8"));
    if (!Number.isInteger(len) || len <= 0 || pos + len > buf.length) break;
    const body = buf.subarray(sp + 1, pos + len - 1).toString("utf8");
    const eq = body.indexOf("=");
    if (eq > 0 && body.slice(0, eq) === "path") path = body.slice(eq + 1);
    pos += len;
  }
  return path;
}

/** Returns the safe relative path (top-level dir stripped), "" for the root itself, or throws. */
function safeRelative(name: string): string {
  if (name.includes("\0") || name.includes("\\") || name.startsWith("/") || /^[A-Za-z]:/.test(name)) {
    throw new Error(`unsafe path in archive: ${JSON.stringify(name.slice(0, 80))}`);
  }
  const parts = name.split("/").filter((p) => p !== "" && p !== ".");
  if (parts.includes("..")) throw new Error(`unsafe path in archive: ${JSON.stringify(name.slice(0, 80))}`);
  return parts.slice(1).join("/"); // GitHub tarballs wrap everything in "<owner>-<repo>-<sha>/"
}

/**
 * Extracts a gzip'd tarball into `destDir` using Node only. Regular files and directories only:
 * symlinks, hardlinks and devices are skipped; `..`/absolute paths are rejected; the unpacked size
 * and entry count are capped. Returns the number of files written.
 */
export async function extractTarGz(gz: Uint8Array, destDir: string, limits: TarLimits = {}): Promise<number> {
  const maxBytes = limits.maxBytes ?? MAX_UNPACKED_BYTES;
  const maxEntries = limits.maxEntries ?? MAX_ENTRIES;
  let tar: Buffer;
  try {
    // headers and padding add up to ~1.5 KB per entry on top of the payload
    tar = gunzipSync(gz, { maxOutputLength: maxBytes + maxEntries * 1536 + 1024 * 1024 });
  } catch (e) {
    if (e instanceof RangeError) throw new Error(`archive too large (unpacked size over ${maxBytes} bytes)`);
    throw new Error(`not a valid gzip archive: ${e instanceof Error ? e.message : String(e)}`);
  }
  const root = resolve(destDir);
  let offset = 0;
  let entries = 0;
  let total = 0;
  let written = 0;
  let longName: string | undefined;
  let paxName: string | undefined;
  while (offset + 512 <= tar.length) {
    const h = tar.subarray(offset, offset + 512);
    if (h.every((b) => b === 0)) break;
    const size = octal(h, 124, 12);
    const type = String.fromCharCode(h[156] === 0 ? 48 : (h[156] as number));
    let name = cString(h, 0, 100);
    const prefix = cString(h, 345, 155);
    if (prefix !== "" && cString(h, 257, 5) === "ustar") name = `${prefix}/${name}`;
    const dataStart = offset + 512;
    if (dataStart + size > tar.length) throw new Error("truncated tar archive");
    const data = tar.subarray(dataStart, dataStart + size);
    offset = dataStart + Math.ceil(size / 512) * 512;
    if (type === "g") continue;
    if (type === "x") {
      paxName = paxPath(data);
      continue;
    }
    if (type === "L") {
      longName = cString(data, 0, data.length);
      continue;
    }
    const finalName = paxName ?? longName ?? name;
    paxName = undefined;
    longName = undefined;
    entries += 1;
    if (entries > maxEntries) throw new Error(`archive has too many entries (over ${maxEntries})`);
    if (type !== "0" && type !== "5") {
      safeRelative(finalName); // still reject hostile names, but never materialise links or devices
      continue;
    }
    const rel = safeRelative(finalName);
    if (rel === "") continue;
    const target = join(root, ...rel.split("/"));
    if (target !== root && !target.startsWith(root + sep)) throw new Error(`unsafe path in archive: ${JSON.stringify(rel)}`);
    if (type === "5") {
      await mkdir(target, { recursive: true, mode: 0o700 });
      continue;
    }
    total += size;
    if (total > maxBytes) throw new Error(`archive too large (unpacked size over ${maxBytes} bytes)`);
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    await writeFile(target, data, { mode: 0o644 });
    written += 1;
  }
  return written;
}
