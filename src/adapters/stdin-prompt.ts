import { createInterface } from "node:readline";
import type { Readable } from "node:stream";

export interface PromptOptions {
  input?: Readable;
  prompt?: string;
  write?: (text: string) => void;
  /** Whether input is interactive (default: `process.stdin.isTTY`, or true for an injected `input`). */
  isTTY?: boolean;
  /** Printed instead of the prompt when input is not a terminal. */
  notice?: string;
}

/**
 * Reads one line from stdin (or `input`). Rejects when aborted; on EOF it stays pending so another
 * source (the OAuth callback) can still win the race.
 */
export function readLine(signal: AbortSignal, opts: PromptOptions = {}): Promise<string> {
  const write = opts.write ?? ((s: string) => void process.stderr.write(s));
  const interactive = opts.isTTY ?? (opts.input === undefined ? process.stdin.isTTY === true : true);
  if (!interactive) {
    // Never read piped stdin (it could be anything); the OAuth callback is then the only way to finish.
    write(opts.notice ?? "");
    return new Promise<string>((_, reject) => {
      const onAbort = (): void => reject(new Error("prompt aborted"));
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    });
  }
  write(opts.prompt ?? "");
  return new Promise<string>((resolve, reject) => {
    const rl = createInterface({ input: opts.input ?? process.stdin });
    const onAbort = (): void => {
      rl.close();
      reject(new Error("prompt aborted"));
    };
    if (signal.aborted) return onAbort();
    signal.addEventListener("abort", onAbort, { once: true });
    rl.once("line", (line) => {
      signal.removeEventListener("abort", onAbort);
      rl.close();
      resolve(line);
    });
  });
}
