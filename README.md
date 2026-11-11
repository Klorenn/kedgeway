# kedgeway

Diagnostic CLI that reports how outdated a Stellar/Soroban repository's toolchain is, grounded on live ecosystem data from the [Stellar Raven](https://raven.stellar.org/mcp) MCP server.

Soroban moves fast, and repos fall behind quietly. On 2026-11-11, Scout scanned 5,863 Stellar repositories and found that 1,285 of them (22%) depend on a deprecated `soroban-sdk`. kedgeway tells you where your repo stands before that becomes a surprise: it reads your manifests, compares them with what the ecosystem is shipping today, and reports findings you can act on or gate CI with.

## Name

A kedge is a small anchor carried out from a drifting ship and hauled in to pull it back on course. kedgeway does that for a Stellar repo's SDK versions.

## Install

Requires Node >= 22.12. kedgeway is not published to npm yet (publishing is coming), so build it from source:

```sh
git clone https://github.com/kedgeway/kedgeway.git
cd kedgeway
npm ci
npm run build   # emits dist/cli.js
npm link        # optional: exposes `kedgeway`
```

## Usage

```sh
kedgeway login                      # force the OAuth flow
kedgeway logout                     # delete stored credentials
kedgeway diagnose [path]            # human-readable report
kedgeway diagnose . --json          # Diagnosis as JSON
kedgeway diagnose . --fail-on warning   # exit 2 if any finding >= warning
kedgeway diagnose . --fixture snapshot.json   # offline, no Raven
```

Example (abridged: the real report also prints an `evidence:` line under each finding):

```text
$ kedgeway diagnose ./my-contract
kedgeway: ./my-contract
Ecosystem: soroban-sdk current major 28, observed 2026-11-11T22:00:57Z

[CRITICAL] SDK_DEPRECATED  contracts/hello/Cargo.toml
  soroban-sdk 21.0.0 is on a major listed as deprecated (current: 28). Upgrade.
[CRITICAL] JS_LEGACY_PACKAGE  package.json
  soroban-client 1.0.0 is a legacy package; replace it with @stellar/stellar-sdk.

Summary: 2 critical, 0 warning, 0 info
```

### Exit codes

| Code | Meaning |
| ---- | ------- |
| `0` | OK |
| `1` | Tool error |
| `2` | A finding met `--fail-on` |

### What it detects

`soroban-sdk` in every `Cargo.toml` (string/table forms, renamed deps via `package = "soroban-sdk"`, `[workspace.dependencies]`, `workspace = true`; duplicates across dependency tables are collapsed), and `@stellar/stellar-sdk`, `stellar-sdk`, `@stellar/stellar-base`, `soroban-client` in every `package.json` (max depth 4; `node_modules`, `target`, `dist`, `.git`, `.next`, `vendor`, `build`, `coverage` skipped).

Version ranges that do not pin a major (`<21`, `<=21`, `a || b`) are reported as `*_UNKNOWN`.

### Finding codes

| Code | Severity | Meaning |
| ---- | -------- | ------- |
| `SDK_DEPRECATED` | critical | `soroban-sdk` major is in the Scout deprecated sample and below the current major, or more than one major behind |
| `SDK_BEHIND` | warning | `soroban-sdk` is exactly one major behind the current major |
| `SDK_CURRENT` | info | `soroban-sdk` is on the current major |
| `SDK_UNKNOWN` | warning | `soroban-sdk` version could not be resolved |
| `JS_SDK_DEPRECATED` | critical | `@stellar/stellar-sdk` / `@stellar/stellar-base` two or more majors behind (no deprecation list exists for JS) |
| `JS_SDK_BEHIND` | warning | JS SDK is exactly one major behind |
| `JS_SDK_CURRENT` | info | JS SDK is on the current major |
| `JS_SDK_UNKNOWN` | warning | JS SDK version could not be resolved |
| `JS_LEGACY_PACKAGE` | critical | Legacy package such as `soroban-client` or `stellar-sdk` |
| `NO_SDK_FOUND` | info | No Stellar SDK dependency found |
| `MANIFEST_UNPARSEABLE` | warning | A manifest or directory could not be read or parsed, so it was not checked |
| `DATA_DEGRADED` | warning | Part of the ecosystem data could not be fetched or parsed |

## How Raven auth works

Raven is OAuth-protected. Each run first tries stored credentials silently (no browser, no local server). Only if Raven answers 401 does the CLI start the local callback server and perform dynamic client registration, then an authorization-code + PKCE flow: it prints the authorization URL, opens your browser, and receives the callback on `http://127.0.0.1:<port>/callback`. Tokens and client info are stored in `~/.config/kedgeway/auth.json` (mode 0600). The callback port is remembered so the stored client registration stays valid. `kedgeway logout` deletes the file.

## Limitations

- "Current" versions come from the official software-versions page (`/docs/networks/software-versions`), parsed inside Raven's sandbox. If that page changes shape the tool reports `DATA_DEGRADED` / `SDK_UNKNOWN` instead of guessing.
- Scout's deprecated-version set is a capped sample and can disagree with the official docs; it is only used for majors below the official current major, and matching is by major.
- `@stellar/stellar-base` is compared against the `@stellar/stellar-sdk` current major, which assumes the two packages keep aligned major versions.
- Scanning skips `node_modules`, `target`, `dist`, `.git`, `.next`, `vendor`, `build`, `coverage` and stops at depth 4.
- Diagnosis only: no migration yet.
- The live OAuth flow against Raven is not covered by automated tests.

## Repository layout

| Path | What it is |
| ---- | ---------- |
| `src/` | The CLI (TypeScript, hexagonal: `core`, `ports`, `adapters`, `cli`) |
| `site/` | The website and docs (Next.js) |

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). Report vulnerabilities as described in [SECURITY.md](SECURITY.md). Release notes live in [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)

## Built on Stellar Raven

kedgeway is built on [Stellar Raven](https://raven.stellar.org/mcp), the Stellar ecosystem MCP gateway, and on Scout ecosystem data served through it.
