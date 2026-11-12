export interface EcosystemSnapshot {
  observedAt: string; // ISO
  sorobanSdk: { currentMajor: number | null; currentVersion?: string | null; deprecatedVersions: string[]; source: string };
  jsSdk: { currentVersion: string | null; source: string };
  /** Current Stellar CLI release from the official software-versions page. */
  stellarCli: { currentVersion: string | null; source: string };
  protocolCurrent: number | null;
  /** Human-readable notes about data sources that failed or could not be parsed. */
  degraded: string[];
  notes: { title: string; url: string; snippet: string }[]; // upgrade/breaking-change docs hits
}

export interface EcosystemPort {
  fetchSnapshot(): Promise<EcosystemSnapshot>;
}
