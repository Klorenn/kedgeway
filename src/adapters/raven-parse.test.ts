import { describe, expect, it } from "vitest";
import { extractLeadingJson, parseRavenResult, EXECUTE_SCRIPT } from "./raven-parse.js";

const payload = {
  observedAt: "2026-11-11T10:00:00.000Z",
  rustSdkCurrent: "28.0.0",
  jsSdkCurrent: "17.2.1",
  protocolCurrent: 29,
  deprecatedVersions: ["29.0.0", "27.0.2", "26.0.1"],
  scoutGeneratedAt: "2026-11-10T00:00:00Z",
  notes: [{ title: "Upgrade guide", url: "https://developers.stellar.org/up", snippet: "Breaking changes" }],
  degraded: [] as string[],
};
const footer = '\n\n--- SOURCE METADATA ---\n{"sources":[{"id":"scout"}]}\n';

describe("extractLeadingJson", () => {
  it("ignores the metadata footer and its JSON", () => {
    expect(extractLeadingJson(JSON.stringify(payload) + footer)).toEqual(payload);
  });

  it("handles prefix text and braces inside strings", () => {
    const text = `Result:\n${JSON.stringify({ a: "x } y { z", b: { c: 1 } })} trailing {"no":1}`;
    expect(extractLeadingJson(text)).toEqual({ a: "x } y { z", b: { c: 1 } });
  });

  it("skips a brace-containing preface that is not JSON", () => {
    expect(extractLeadingJson(`Ran {script} ok:\n{"a":1}`)).toEqual({ a: 1 });
  });

  it("matches the footer marker only at line start", () => {
    const obj = { note: "see --- SOURCE METADATA --- docs", n: 1 };
    expect(extractLeadingJson(JSON.stringify(obj) + footer)).toEqual(obj);
  });

  it("throws when no JSON object is present", () => {
    expect(() => extractLeadingJson("nothing here")).toThrow(/JSON/);
  });

  it("throws on unbalanced JSON", () => {
    expect(() => extractLeadingJson('{"a": {"b": 1}')).toThrow(/JSON/);
  });
});

describe("parseRavenResult", () => {
  it("maps a realistic response (with footer) into an EcosystemSnapshot", () => {
    const snap = parseRavenResult(JSON.stringify(payload) + footer);
    expect(snap.observedAt).toBe(payload.observedAt);
    expect(snap.sorobanSdk.currentMajor).toBe(28);
    expect(snap.sorobanSdk.currentVersion).toBe("28.0.0");
    expect(snap.sorobanSdk.deprecatedVersions).toEqual(["29.0.0", "27.0.2", "26.0.1"]);
    expect(snap.sorobanSdk.source).toContain("raven");
    expect(snap.jsSdk.currentVersion).toBe("17.2.1");
    expect(snap.protocolCurrent).toBe(29);
    expect(snap.degraded).toEqual([]);
    expect(snap.notes).toEqual(payload.notes);
  });

  it("returns null currentMajor and passes degraded through when the rust row is missing", () => {
    const snap = parseRavenResult(
      JSON.stringify({ ...payload, rustSdkCurrent: null, protocolCurrent: null, degraded: ["software-versions: rust sdk row not found"] }),
    );
    expect(snap.sorobanSdk.currentMajor).toBeNull();
    expect(snap.protocolCurrent).toBeNull();
    expect(snap.degraded).toEqual(["software-versions: rust sdk row not found"]);
  });

  it("tolerates note hits without url or title", () => {
    const snap = parseRavenResult(JSON.stringify({ ...payload, notes: [{ snippet: "s" }] }));
    expect(snap.notes).toEqual([{ title: "", url: "", snippet: "s" }]);
  });

  it("wraps schema errors in a readable message", () => {
    expect(() => parseRavenResult(JSON.stringify({ observedAt: 5 }))).toThrow(/Unexpected Raven response/);
  });
});

describe("EXECUTE_SCRIPT", () => {
  it("is an async arrow reading the official versions page, Scout and docs search", () => {
    expect(EXECUTE_SCRIPT.trimStart().startsWith("async () =>")).toBe(true);
    expect(EXECUTE_SCRIPT).toContain("stellarDocs.get_doc_page");
    expect(EXECUTE_SCRIPT).toContain("/docs/networks/software-versions");
    expect(EXECUTE_SCRIPT).toContain("scout.analyzeEcosystem");
    expect(EXECUTE_SCRIPT).toContain("degraded");
  });
});

describe("EXECUTE_SCRIPT behaviour in a fake sandbox", () => {
  type Fn = () => Promise<Record<string, unknown>>;
  const run = (globals: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const names = Object.keys(globals);
    const fn = new Function(...names, `return (${EXECUTE_SCRIPT});`)(...names.map((n) => globals[n])) as Fn;
    return fn();
  };
  const ok = (data: unknown) => Promise.resolve({ ok: true, data });
  const page = [
    "Protocol 29 is live",
    "| Smart Contract Rust SDK | `v28.0.0` |",
    "| Stellar JS Stellar SDK | `17.2.1` |",
  ].join("\n");

  it("extracts versions from the official page table and reports no degradation", async () => {
    const out = await run({
      stellarDocs: {
        get_doc_page: () => ok({ content: page }),
        search_docs: () => ok({ hits: [{ title: "T", url: "u", snippet: "s" }] }),
      },
      scout: { analyzeEcosystem: () => ok({ toolchain: { deprecatedRepos: [{ sorobanSdkVersion: "27.0.2" }, { sorobanSdkVersion: "27.0.2" }] }, meta: { generatedAt: "g" } }) },
    });
    expect(out).toMatchObject({
      rustSdkCurrent: "28.0.0",
      jsSdkCurrent: "17.2.1",
      protocolCurrent: 29,
      deprecatedVersions: ["27.0.2"],
      scoutGeneratedAt: "g",
      degraded: [],
    });
  });

  it("records degraded entries when services fail", async () => {
    const fail = () => Promise.resolve({ ok: false, error: { message: "down" } });
    const out = await run({
      stellarDocs: { get_doc_page: fail, search_docs: fail },
      scout: { analyzeEcosystem: fail },
    });
    expect(out["rustSdkCurrent"]).toBeNull();
    expect(out["degraded"]).toEqual([
      "stellarDocs.get_doc_page: down",
      "scout.analyzeEcosystem: down",
      "stellarDocs.search_docs: down",
    ]);
  });
});
