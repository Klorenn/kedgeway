import { lstat, readFile } from "node:fs/promises";

/** Per-file read caps for files inside a scanned (possibly untrusted) repository. */
export const MAX_MANIFEST_BYTES = 5_000_000;
export const MAX_LOCKFILE_BYTES = 25_000_000;

/**
 * Reads `path` as UTF-8 only if it is a regular file (never a symlink, device, FIFO or directory) of at most
 * `maxBytes`; otherwise null. A cloned repo is untrusted: a symlinked `Cargo.lock` must not leak `/etc/...`,
 * block on `/dev/stdin` or stream `/dev/zero`.
 */
export async function readRegularFile(path: string, maxBytes: number): Promise<string | null> {
  try {
    const st = await lstat(path);
    if (!st.isFile() || st.size > maxBytes) return null;
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}
