# Changelog

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

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

- The GitHub Action builds kedgeway from source on every run until built `dist/` is committed on release tags; pin a tag (`@v0.1.0`) rather than `@main`.
