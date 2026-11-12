import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { EcosystemPort, EcosystemSnapshot } from "../ports/ecosystem.js";

export const SnapshotSchema = z.object({
  observedAt: z.string(),
  sorobanSdk: z.object({
    currentMajor: z.number().int().nullable(),
    currentVersion: z.string().nullable().default(null),
    deprecatedVersions: z.array(z.string()),
    source: z.string(),
  }),
  jsSdk: z.object({ currentVersion: z.string().nullable(), source: z.string() }),
  stellarCli: z
    .object({ currentVersion: z.string().nullable(), source: z.string() })
    .default({ currentVersion: null, source: "fixture (field missing)" }),
  protocolCurrent: z.number().nullable().default(null),
  degraded: z.array(z.string()).default([]),
  notes: z.array(z.object({ title: z.string(), url: z.string(), snippet: z.string() })),
});

export class FakeEcosystem implements EcosystemPort {
  constructor(private readonly snapshot: EcosystemSnapshot) {}

  fetchSnapshot(): Promise<EcosystemSnapshot> {
    return Promise.resolve(this.snapshot);
  }
}

export async function loadFixture(path: string): Promise<FakeEcosystem> {
  const parsed = SnapshotSchema.parse(JSON.parse(await readFile(path, "utf8")));
  return new FakeEcosystem(parsed);
}
