# Changelog

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- feat(remote): diagnose a repository by URL. `kedgeway diagnose <path-or-url>` and `kedgeway migrate <path-or-url>` accept `https://` / `ssh://` / `git@host:o/r` URLs (GitHub `/tree/<ref>` and GitLab `/-/tree/<ref>` included) and the `owner/repo` GitHub shorthand (an existing local path always wins), with `--ref <ref>`. The repo is cloned with `git clone --depth 1 --single-branch --no-tags` (execFile, no shell, `GIT_TERMINAL_PROMPT=0`, 60 s timeout, SIGKILL) into a 0700 temp dir that is always removed; without git on a github.com source, the codeload tarball is fetched and unpacked with Node only (regular files, no `..`/absolute paths, 50 MB and 20k entries caps). `file://`, `javascript:`, non-http(s)/ssh schemes, embedded credentials and unsafe refs are rejected. The report header shows `github.com/o/r@ref`, finding files and SARIF/annotation paths stay repo-relative. `migrate --write` on a remote source exits 2 (dry run only).
- fix(security): hardening of remote sources and of scanning untrusted repos. Clones run with `core.symlinks=false`, `http.followRedirects=false`, git-lfs filters off (`GIT_LFS_SKIP_SMUDGE=1`), `protocol.allow=never` plus only the URL's own transport, and `GIT_SSH_COMMAND="ssh -oBatchMode=yes"` unless already set. Every repo file read (manifests, lockfiles, toolchain files, sources, migration inputs) now goes through an lstat regular-file check with a size cap (`src/adapters/safe-read.ts`); a symlinked `Cargo.lock` is ignored instead of read. Hosts that are IP literals (any notation), `localhost`, single-label or `.local`/`.internal`-style names are rejected; the MCP server accepts https/ssh only. Rejection messages no longer echo the input; clone errors are cut to 2000 characters before credential masking (bounded regex, no quadratic time), show the repo name instead of the temp path, and tell a git output overflow from a timeout. Tarball downloads are rejected on a declared size over 50 MB and streamed with a byte cap. MCP `diagnose`/`migrate` are annotated `openWorldHint`. Using the `o/r` shorthand prints a one-line stderr note.
- feat(sdk): exports `parseRepoSource`, `resolveRepoSource`, `diagnoseRemote`, `migrateRemote` and the `RemoteSource`, `RepoSource`, `RemoteDiagnoseOptions`, `RemoteRepoOptions` types; `DetailedDiagnosis` gains an optional `display`.
- feat(mcp): `diagnose` and `migrate` accept `url` (and `ref`) as an alternative to `path` (exactly one); `migrate` with `url` never writes, even with `--allow-write`.
- feat(action): optional `repo` input scans a remote URL instead of `path` (annotations are skipped for it; values starting with `-` are refused).
- feat(toolchain): checks beyond the SDKs. `EcosystemSnapshot` gains `stellarCli: { currentVersion, source }`, parsed from the "Stellar CLI" row of the official software-versions table (a missing row raises `DATA_DEGRADED`); old cached snapshots without the field load with `stellarCli.currentVersion: null` and source `cache (field missing)`. `RepoFacts` gains an optional `toolchain` (stellar-cli pins, `wasm32-unknown-unknown`/`wasm32v1-none` declarations and the pinned Rust channel, each with file and line) read from workflows, `Dockerfile*`, `Makefile`, `*.sh` (root and `scripts/`), `.tool-versions`, `package.json`, `rust-toolchain(.toml)` and `.cargo/config.toml`.
- feat(findings): six new codes. `CLI_DEPRECATED` (critical, pinned CLI 2+ majors behind), `CLI_BEHIND` (warning, one behind), `CLI_CURRENT` (info), `CLI_UNKNOWN` (warning), one finding per pin and nothing when no pin exists; `RUST_TARGET_LEGACY` (warning, `wasm32-unknown-unknown` without `wasm32v1-none` in a `soroban-sdk` repo); `RUST_TOOLCHAIN_OLD` (warning, pinned Rust below 1.84.0 in a `soroban-sdk` repo). They flow through the text report, `--json`, annotations, SARIF (now 18 rules) and the MCP `findings_reference` and `diagnose` tools. `NO_SDK_FOUND` and `--fail-on` are unchanged.
- feat(sarif): results point at the finding's line (`region.startLine`) when it has one instead of always line 1.
- feat(doctor): a `stellar-cli` check runs `stellar --version` (no shell, 5 s timeout): not installed is a `warn` (optional); with a snapshot, the current major or newer is `ok`, one major behind `warn`, two or more `fail`; with `--offline` or no snapshot it is `ok` ("current unknown"). `DoctorDeps` gains an injectable `exec`.
- fix(toolchain): the scanner no longer uses backtracking regex scans (token matching on command segments instead; logical lines over 8 KB are skipped), so hostile files cannot stall it. A `--version` from another command on the same line is not a pin; only a `cargo install|binstall` segment that names `stellar-cli` counts. New pin forms: `--tag`, legacy `soroban-cli`, `npm i -g @stellar/stellar-cli@X`, release-download URLs. A rust channel with a host triple is parsed. `RUST_TARGET_LEGACY` is `info` when the line also uses wasm-pack, wasm-bindgen or trunk. A `[build] target` line wins over a `[target."..."]` header. SARIF `startLine` is at least 1.
- fix(doctor): the `stellar --version` call is killed with SIGKILL and raced against doctor's own 5 s timer.
- fix(cache): a snapshot cached before `stellarCli` existed is refetched instead of counted fresh; when used anyway it carries a `DATA_DEGRADED` note, as does a Raven payload without `stellarCliCurrent`.
- feat(sdk): exports the `CliPin`, `CliPinSource`, `RustTargetDecl`, `RustTargetName`, `RustToolchainPin` and `ToolchainFacts` types.

## [0.1.1] - 2026-11-12

### Changed

- feat(action): when pinned to a semver tag (`@v1.2.3`) the action installs that exact version with `npm install -g kedgeway@1.2.3` instead of building from source; a version that is not on npm fails with an error (no silent fallback). Other refs (`@main`, SHAs, branches, the local `./`) still build from source. New `version` input overrides the detected version (`source` forces the build). Detection lives in `scripts/resolve-version.sh`. The resolve step runs before `setup-node` because the runner overwrites `github.action_ref` after a nested `uses:` step; the npm install runs with `--ignore-scripts`; the semver check is strict (no leading zeros, no empty prerelease identifiers).

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
