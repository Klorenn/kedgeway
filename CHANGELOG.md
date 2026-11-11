# Changelog

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `kedgeway diagnose [path]` with human-readable and `--json` output, `--fail-on <critical|warning|info>` and offline `--fixture` mode.
- `kedgeway login` and `kedgeway logout`: OAuth (dynamic client registration, authorization code + PKCE) against Stellar Raven, with credentials stored in `~/.config/kedgeway/auth.json` (mode 0600).
- Detection of `soroban-sdk` in `Cargo.toml` (string/table forms, renamed deps, workspace dependencies).
- Detection of `@stellar/stellar-sdk`, `@stellar/stellar-base`, `stellar-sdk` and `soroban-client` in `package.json`.
- Findings: `SDK_DEPRECATED`, `SDK_BEHIND`, `SDK_CURRENT`, `SDK_UNKNOWN`, `JS_SDK_DEPRECATED`, `JS_SDK_BEHIND`, `JS_SDK_CURRENT`, `JS_SDK_UNKNOWN`, `JS_LEGACY_PACKAGE`, `NO_SDK_FOUND`, `MANIFEST_UNPARSEABLE`, `DATA_DEGRADED`.
- Exit codes: `0` ok, `1` tool error, `2` a finding met `--fail-on`.
- Marketing and docs website in `site/`.
- Open-source scaffolding: license, contributing guide, code of conduct, security policy, CI and release workflows, issue and PR templates.
