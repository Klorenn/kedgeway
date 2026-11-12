import type { PageMetaDict, Rich } from "./common";

export interface DocsWhatItScansDict {
  meta: PageMetaDict;
  h1: string;
  lede: Rich;
  cargoIntro: Rich;
  cargo: { tables: Rich; renames: Rich; workspaces: Rich; duplicates: Rich };
  pkgIntro: Rich;
  pkgLegacy: string;
  pkgLegacyUnscoped: string;
  pkgPeer: Rich;
  aliasesH: string;
  aliasesIntro: Rich;
  aliasesVersion: Rich;
  whereH: string;
  where: { walk: Rich; skips: Rich; unreadable: Rich };
  versionsH: string;
  versionsIntro: Rich;
  versionCols: { declared: string; readAs: string };
  versionRows: { plain: Rich; gte: Rich; x: Rich; upper: Rich; compound: Rich; emptyLabel: Rich; empty: Rich };
  versionsUnknown: Rich;
  versionsLockfile: Rich;
  lockfilesH: string;
  lockfilesIntro: Rich;
  lockCols: { lockfile: string; how: string };
  lockRows: { cargo: Rich; npm: Rich; pnpm: Rich; yarn: Rich };
  lockNotes: { ambiguous: Rich; where: Rich; ranges: Rich; limits: Rich; tested: Rich };
  remoteH: string;
  remoteIntro: Rich;
  remote: { fetch: Rich; private: Rich; noGit: Rich; rejected: Rich; output: Rich; migrate: Rich };
  toolchainH: string;
  toolchainIntro: Rich;
  toolchain: { cli: Rich; target: Rich; rust: Rich };
}
