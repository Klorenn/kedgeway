import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { readLine } from "./stdin-prompt.js";

describe("readLine", () => {
  it("resolves with the first line and prints the prompt", async () => {
    const input = new PassThrough();
    const out: string[] = [];
    const p = readLine(new AbortController().signal, { input, prompt: "paste: ", write: (s) => out.push(s), isTTY: true });
    input.write("hello world\nsecond\n");
    expect(await p).toBe("hello world");
    expect(out.join("")).toBe("paste: ");
  });

  it("rejects when aborted", async () => {
    const input = new PassThrough();
    const ac = new AbortController();
    const p = readLine(ac.signal, { input, prompt: "", write: () => undefined, isTTY: true });
    ac.abort();
    await expect(p).rejects.toThrow(/abort/i);
  });

  it("stays pending on EOF (the callback may still finish the login) until aborted", async () => {
    const input = new PassThrough();
    const ac = new AbortController();
    let settled = false;
    const p = readLine(ac.signal, { input, prompt: "", write: () => undefined, isTTY: true });
    p.then(
      () => (settled = true),
      () => (settled = true),
    );
    input.end();
    await new Promise((r) => setTimeout(r, 30));
    expect(settled).toBe(false);
    ac.abort();
    await expect(p).rejects.toThrow();
  });

  it("without a TTY prints a notice, never reads and waits for abort (callback-only)", async () => {
    const input = new PassThrough();
    const out: string[] = [];
    const ac = new AbortController();
    let settled = false;
    const p = readLine(ac.signal, { input, prompt: "paste: ", write: (s) => out.push(s), isTTY: false, notice: "not a terminal\n" });
    p.then(
      () => (settled = true),
      () => (settled = true),
    );
    input.write("typed anyway\n");
    await new Promise((r) => setTimeout(r, 30));
    expect(settled).toBe(false);
    expect(out.join("")).toBe("not a terminal\n");
    ac.abort();
    await expect(p).rejects.toThrow(/abort/i);
  });
});
