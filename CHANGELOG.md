# Changelog

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- feat(action): when pinned to a semver tag (`@v1.2.3`) the action installs that exact version with `npm install -g kedgeway@1.2.3` instead of building from source; a version that is not on npm fails with an error (no silent fallback). Other refs (`@main`, SHAs, branches, the local `./`) still build from source. New `version` input overrides the detected version (`source` forces the build). Detection lives in `scripts/resolve-version.sh`.

## [0.1.0] - 2026-11-12

### Added

- feat(cli): `kedgeway --version` / `-V` prints the version from `package.json`. `kedgeway init [path]` writes `.github/workflows/kedgeway.yml` using the published action (pinned to the CLI version, `fail-on: warning`, `auth: ${{ secrets.KEDGEWAY_AUTH }}`); it refuses to overwrite unless `--force` (exit 1), `--print` writes the YAML to stdout, and it prints the written path plus a hint to set the `KEDGEWAY_AUTH` secret.
- feat(migrate): `kedgeway migrate` leads with a guide: published version, protocol, observation time, numbered steps, and up to 20 import sites for `soroban-client` and unscoped `stellar-sdk`. Raven doc hits are cited only when the title or url is a migration document. SDK: `buildGuide`, `formatGuide`, `migrationDocs`, `findImportHits`. The edits are still version strings only.
- feat(lockfile): `Cargo.lock`, `package-lock.json` (v1/v2/v3), `pnpm-lock.yaml` and `yarn.lock` (classic and berry) resolution of the DIRECT dependency (Cargo: the entry satisfying the manifest requirement, else `ambiguous in Cargo.lock`; pnpm: the importer's entry; yarn: the `name@range` descriptor). `DetectedDep` gains `resolved`, `resolvedFrom` and an optional `lockNote`; diagnosis compares `resolved ?? version` and evidence names the lockfile (`resolved 21.7.6 from Cargo.lock; manifest ^21`). `migrate` still edits manifests only; when the manifest already allows the current major but the lock is older it emits a "refresh the lockfile" manual step and always notes touched lockfiles. The text report hints at a lockfile above the scan root.
- feat(cache): the ecosystem snapshot is cached at `$XDG_CACHE_HOME/kedgeway/snapshot.json` (mode 0600, exclusive temp file, directory 0700); degraded snapshots are never cached and cached degraded or future-dated snapshots count as stale. `diagnose` and `migrate` gain `--offline`, `--no-cache` and `--max-age <duration>` (default `24h`; `--offline --no-cache` is rejected; `--offline` is ignored with `--fixture`); a failed Raven fetch falls back to the cache, and stale or fallback snapshots raise `DATA_DEGRADED`.
- feat(auth): `kedgeway login --export` prints the stored credentials as a base64 blob for CI. The `KEDGEWAY_AUTH` environment variable (base64 or base64url, whitespace tolerated) replaces `auth.json`, is never written to disk and refreshes in memory only. Caveat: if Raven rotates refresh tokens the secret can go stale and must be re-exported (see SECURITY.md). `login --export` never removes stored credentials.
- feat(action): new `auth` input (secret, sets `KEDGEWAY_AUTH`); the action now requires `fixture` or `auth` and names both when neither is set.
- feat(sarif): `kedgeway diagnose --sarif <file>` writes SARIF 2.1.0 with the 12 finding codes as rules; `diagnose --format <text|json|sarif>` chooses stdout (`--json` stays, and conflicts with `--format`). URIs are percent-encoded, realpath-relative, with absolute `file://` URIs outside the working directory. Action input `sarif` and output `sarif` (`$RUNNER_TEMP/kedgeway.sarif`); MCP `diagnose` accepts `format: "sarif"`. SDK: `buildSarif`, `toSarif`, `SnapshotCache`, `CachingEcosystem`.
- docs: README sections for lockfile resolution, the snapshot cache, CI authentication and SARIF; SECURITY.md notes the scope and rotation of the exported token.

- test(lockfile): real-lockfile corpus (`fixtures/lockfiles/`, sources and commits in `SOURCES.md`) for Cargo.lock v4, package-lock v3, pnpm-lock v9 and yarn classic and berry; `src/core/lockfile.corpus.test.ts` asserts the resolved direct dependency from each.
- feat(lockfile): JS ranges are matched with the `semver` package (hyphen ranges, `||`, x-ranges, npm prerelease rules); Cargo keeps a custom matcher. New runtime dependency: `semver`.
- feat(auth): `kedgeway login --no-browser` prints the authorization URL and accepts the redirect URL or code on stdin: invalid input is rejected with a one-line error and the prompt repeats; the OAuth state is checked for pasted URLs only (a bare code carries none) and the check fails closed; with no TTY on stdin pasting is disabled and only the callback can finish the login; document the `ssh -L` port-forward trick. Combines with `--export`.
- feat(annotations): `diagnose --format annotations` and `--annotations <file>` emit GitHub `::error`/`::warning`/`::notice` commands with the manifest file and line (`DetectedDep.line`, `Finding.line`); action input `annotations`, on by default when `GITHUB_ACTIONS=true`. SDK: `toAnnotations`, `formatAnnotations`.
- feat(doctor): `kedgeway doctor` checks Node, auth state, cache path and age, and Raven reachability (one `search` call with a 10 s timeout, skipped with `--offline`, run with a read-only auth store so a token refresh cannot touch `auth.json`); exits 1 when a check fails.

### Fixed

- `kedgeway doctor` fails the auth check when `auth.json` exists but cannot be read. Only a missing file stays a warning. `logout` and the read-only auth store used by doctor propagate read errors other than a missing file.
- MCP `migrate` with `write: true` names the steps it could not apply, and no longer describes that result as a dry run.
- The GitHub Action exits 1 if printing the report or the annotations fails, instead of keeping the CLI's exit code.
- `package.json` aliases such as `"stellar-sdk": "npm:@stellar/stellar-sdk@17.4.0"` are read as the real `@stellar/stellar-sdk` instead of being reported as the legacy `stellar-sdk` package (found in the stellar/freighter manifest while building the corpus); `migrate` edits the aliased member (`DetectedDep.declaredKey` / `declaredRaw`). Manifest lines now come from the span-aware JSON scanner, so `overrides.dependencies` cannot win; the action sanitises finding text before printing it so it cannot inject workflow commands.

### Changed

- Finding descriptions mention lockfile-resolved versions and cached snapshots.
- `DATA_DEGRADED` is also raised when a stale or fallback cached snapshot is used.

- `migrate` hardening: git guard never fails open (only "git missing" or "not a repository" count as no repo; `-z` parsing, timeout, scrubbed `GIT_DIR`); writes re-read files first, abort the batch on any change, and use atomic same-directory renames preserving mode; symlinked manifests are never edited.
- `package.json` edits now replace only the affected spans instead of re-serialising the file (byte-exact elsewhere, including BOM, minified layout and big numbers).
- Only plain versions are bumped; ranges like `12.x`, `12 || 13` or `a, <b` become manual steps.
- `kedgeway migrate` exit codes: manual-only dry run exits 0; `--write` with a skipped step exits 2.
- MCP `migrate` is annotated destructive and `write: true` requires `kedgeway mcp --allow-write`.
- Build cleans `dist` first and no longer emits declaration maps; `check-dist` resolves relative to the script and rejects leaked test files.
- Core no longer imports `node:path`; the diff trims common prefix/suffix and marks missing trailing newlines.
- `tsconfig.build.json` emits declarations; `prepublishOnly` runs `scripts/check-dist.mjs` to verify `dist/index.d.ts` exists.
- The GitHub Action runs `diagnose` once through `scripts/action-run.sh`, always writes its outputs, then exits with the CLI's code.
- `kedgeway mcp` stays alive until the transport closes, reports the package version, and never starts OAuth: without stored credentials live tools fail with `Run "kedgeway login" first`.
- The fail-on predicate lives in core as `meetsThreshold`.
- Findings for a dependency carry a `dependency` reference; workspace-inherited deps record `declaredIn`; the soroban snapshot carries `currentVersion`.

- `scanRepo` now throws when the path does not exist or is not a directory (previously reported as a manifest warning).

### Added

- `kedgeway migrate [path]` (experimental): dry run by default (unified diff, exit 2 when there is a plan), `--write` to apply. SDK: `planMigration`, `applyMigration`, `migrate`. Refuses to write over uncommitted git changes. MCP: new `migrate` tool.
- `kedgeway mcp`: stdio MCP server with tools `diagnose`, `findings_reference` and `ecosystem_snapshot`, built on the SDK.
- GitHub Action (`action.yml`) with `path`, `fail-on`, `fixture` and `json` inputs and `summary` / `report-json` outputs; self-test workflow and a committed ecosystem fixture (`fixtures/ecosystem-2026-11-11.json`).
- TypeScript SDK: `import { diagnose, scanRepo, diagnoseRepo, createRavenEcosystem, FakeEcosystem, loadFixture } from "kedgeway"` with `exports` map and bundled types. The CLI now runs on top of the SDK.
- `kedgeway diagnose [path]` with human-readable and `--json` output, `--fail-on <critical|warning|info>` and offline `--fixture` mode.
- `kedgeway login` and `kedgeway logout`: OAuth (dynamic client registration, authorization code + PKCE) against Stellar Raven, with credentials stored in `~/.config/kedgeway/auth.json` (mode 0600).
- Detection of `soroban-sdk` in `Cargo.toml` (string/table forms, renamed deps, workspace dependencies).
- Detection of `@stellar/stellar-sdk`, `@stellar/stellar-base`, `stellar-sdk` and `soroban-client` in `package.json`.
- Findings: `SDK_DEPRECATED`, `SDK_BEHIND`, `SDK_CURRENT`, `SDK_UNKNOWN`, `JS_SDK_DEPRECATED`, `JS_SDK_BEHIND`, `JS_SDK_CURRENT`, `JS_SDK_UNKNOWN`, `JS_LEGACY_PACKAGE`, `NO_SDK_FOUND`, `MANIFEST_UNPARSEABLE`, `DATA_DEGRADED`.
- Exit codes: `0` ok, `1` tool error, `2` a finding met `--fail-on`.
- Marketing and docs website in `site/`.
- Open-source scaffolding: license, contributing guide, code of conduct, security policy, CI and release workflows, issue and PR templates.

### Known

- No device-flow login: Stellar Raven's OAuth metadata (`/.well-known/oauth-authorization-server`, checked 2026-11-11) advertises only the `authorization_code` and `refresh_token` grants and no `device_authorization_endpoint`, so headless login uses `login --no-browser` instead. Revisit if Raven adds RFC 8628.

- The GitHub Action builds kedgeway from source on every run until built `dist/` is committed on release tags; pin a tag (`@v0.1.0`) rather than `@main`.
