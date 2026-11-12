import { describe, expect, it } from "vitest";
import { findImportHits } from "./source-hits.js";

describe("findImportHits", () => {
  it("records the line of an exact specifier and ignores a longer package name", () => {
    const hits = findImportHits(
      [
        { file: "src/a.ts", text: 'import { Server } from "soroban-client";\nconst x = 1;\n' },
        { file: "src/b.ts", text: "import x from 'stellar-sdk'\n" },
        { file: "src/c.ts", text: 'import { x } from "@stellar/stellar-sdk"\n' },
      ],
      ["soroban-client", "stellar-sdk"],
    );
    expect(hits).toEqual([
      { file: "src/a.ts", line: 1, name: "soroban-client" },
      { file: "src/b.ts", line: 1, name: "stellar-sdk" },
    ]);
  });
});
