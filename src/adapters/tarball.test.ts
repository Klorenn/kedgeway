import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { extractTarGz } from "./tarball.js";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "kw-tar-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function header(name: string, size: number, type: string, linkname = ""): Buffer {
  const h = Buffer.alloc(512);
  h.write(name, 0, "utf8");
  h.write("0000644\0", 100);
  h.write("0000000\0", 108);
  h.write("0000000\0", 116);
  h.write(`${size.toString(8).padStart(11, "0")}\0`, 124);
  h.write("00000000000\0", 136);
  h.write("        ", 148);
  h.write(type, 156);
  h.write(linkname, 157);
  h.write("ustar\0" + "00", 257);
  let sum = 0;
  for (const b of h) sum += b;
  h.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148);
  return h;
}
function entry(name: string, body: string | null, type = "0", linkname = ""): Buffer {
  const data = Buffer.from(body ?? "");
  const pad = Buffer.alloc((512 - (data.length % 512)) % 512);
  return Buffer.concat([header(name, data.length, type, linkname), data, pad]);
}
const end = Buffer.alloc(1024);
const tgz = (...parts: Buffer[]): Buffer => gzipSync(Buffer.concat([...parts, end]));

describe("extractTarGz", () => {
  it("extracts regular files, stripping the top-level directory", async () => {
    const buf = tgz(entry("o-r-abc/", null, "5"), entry("o-r-abc/Cargo.toml", "[package]\n"), entry("o-r-abc/src/lib.rs", "fn x(){}"));
    const n = await extractTarGz(buf, dir);
    expect(n).toBe(2);
    expect(await readFile(join(dir, "Cargo.toml"), "utf8")).toBe("[package]\n");
    expect(await readFile(join(dir, "src/lib.rs"), "utf8")).toBe("fn x(){}");
  });
  it("skips pax global headers, symlinks, hardlinks and devices", async () => {
    const buf = tgz(
      entry("pax_global_header", "52 comment=abc\n", "g"),
      entry("t/a.txt", "a"),
      entry("t/link", null, "2", "/etc/passwd"),
      entry("t/hard", null, "1", "a.txt"),
      entry("t/dev", null, "3"),
    );
    expect(await extractTarGz(buf, dir)).toBe(1);
    await expect(stat(join(dir, "link"))).rejects.toThrow();
    await expect(stat(join(dir, "hard"))).rejects.toThrow();
  });
  it("honours a pax path override", async () => {
    const rec = " path=t/long/name.txt\n";
    const len = rec.length + String(rec.length + 3).length;
    const pax = `${len} path=t/long/name.txt\n`;
    expect(pax.length).toBe(len);
    const buf = tgz(entry("PaxHeaders/x", pax, "x"), entry("t/short", "hi"));
    await extractTarGz(buf, dir);
    expect(await readFile(join(dir, "long/name.txt"), "utf8")).toBe("hi");
  });
  it.each(["t/../../evil", "../evil", "/abs/evil", "t/a/../../../x", "C:/evil", "t\\..\\evil"])("rejects traversal %s", async (name) => {
    await expect(extractTarGz(tgz(entry(name, "x")), dir)).rejects.toThrow(/unsafe path/);
  });
  it("honours GNU L long names", async () => {
    const longName = `t/${"d".repeat(120)}/file.txt`;
    const buf = tgz(entry("././@LongLink", `${longName}\0`, "L"), entry("t/trunc", "hello"));
    await extractTarGz(buf, dir);
    expect(await readFile(join(dir, "d".repeat(120), "file.txt"), "utf8")).toBe("hello");
  });
  it("rejects traversal in a GNU L long name", async () => {
    const buf = tgz(entry("././@LongLink", `t/${"d".repeat(120)}/../../../evil\0`, "L"), entry("t/x", "no"));
    await expect(extractTarGz(buf, dir)).rejects.toThrow(/unsafe path/);
  });
  it("rejects traversal through the ustar prefix field", async () => {
    const h = header("x", 1, "0");
    h.write("../../etc", 345); // prefix
    h.write("        ", 148);
    let sum = 0;
    for (const b of h) sum += b;
    h.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148);
    const buf = gzipSync(Buffer.concat([h, Buffer.concat([Buffer.from("x"), Buffer.alloc(511)]), end]));
    await expect(extractTarGz(buf, dir)).rejects.toThrow(/unsafe path/);
  });
  it("accepts a normal ustar prefix", async () => {
    const h = header("file.txt", 1, "0");
    h.write("t/some/dir", 345);
    h.write("        ", 148);
    let sum = 0;
    for (const b of h) sum += b;
    h.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148);
    await extractTarGz(gzipSync(Buffer.concat([h, Buffer.concat([Buffer.from("x"), Buffer.alloc(511)]), end])), dir);
    expect(await readFile(join(dir, "some/dir/file.txt"), "utf8")).toBe("x");
  });
  it("caps unpacked size", async () => {
    const buf = tgz(entry("t/big", "x".repeat(5000)));
    await expect(extractTarGz(buf, dir, { maxBytes: 1000 })).rejects.toThrow(/unpacked size|too large/);
  });
  it("caps the number of entries", async () => {
    const buf = tgz(entry("t/1", "a"), entry("t/2", "a"), entry("t/3", "a"));
    await expect(extractTarGz(buf, dir, { maxEntries: 2 })).rejects.toThrow(/entries/);
  });
  it("rejects a truncated archive and non-gzip input", async () => {
    await expect(extractTarGz(Buffer.from("not gzip"), dir)).rejects.toThrow(/gzip|tar/i);
    const bad = gzipSync(Buffer.concat([header("t/a", 5000, "0"), Buffer.from("short")]));
    await expect(extractTarGz(bad, dir)).rejects.toThrow(/truncated/);
  });
});
