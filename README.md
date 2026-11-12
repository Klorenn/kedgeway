<div align="center">

<img src="assets/banner.png" alt="kedgeway: a white hatch-stroke Muybridge horse on a dark field" width="100%">

<h3>Diagnose Stellar SDK drift against the live ecosystem.</h3>

[![CI](https://github.com/Klorenn/kedgeway/actions/workflows/ci.yml/badge.svg)](https://github.com/Klorenn/kedgeway/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/kedgeway)](https://www.npmjs.com/package/kedgeway)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node >= 22.12](https://img.shields.io/badge/node-%3E%3D22.12-339933)](package.json)

[Website](https://kedgeway.vercel.app) · [Docs](https://kedgeway.vercel.app/docs) · [Changelog](CHANGELOG.md)

<img src="assets/demo.gif" alt="Terminal demo: kedgeway diagnose reports 3 critical findings and exits with code 2" width="100%">

</div>

## Why

Soroban moves fast, and repos fall behind quietly. On 2026-11-11, Scout (via Stellar Raven) counted **5,863** Stellar repositories and found **1,285 of them (22%)** on a deprecated `soroban-sdk`.

kedgeway tells you where your repo stands before that becomes a surprise, and lets you gate CI on it.

## How it works

- **Scan.** Reads every `Cargo.toml` and `package.json` in your repo, locally.
- **Ask Raven.** Fetches the current SDK versions and the deprecated set from the [Stellar Raven](https://raven.stellar.org/mcp) MCP server.
- **Diagnose.** Compares the two and reports findings with severity and evidence.

What leaves your machine: only the script kedgeway sends to Raven's `execute` tool. Your repo contents never do.

## Install

Requires Node >= 22.12.

```sh
npm install -g kedgeway
```

To work on the source instead:

```sh
git clone https://github.com/Klorenn/kedgeway
cd kedgeway
npm ci
npm run build   # emits dist/cli.js
npm link        # optional: exposes `kedgeway`
```

## Usage

```sh
kedgeway --version                            # print the version (-V)
kedgeway init [path]                          # write .github/workflows/kedgeway.yml (--force, --print)
kedgeway login                                # force the OAuth flow
kedgeway login --export                       # print credentials as a base64 secret for CI
kedgeway login --no-browser                   # headless login: print the URL, paste the redirect back
kedgeway doctor                               # self-check: Node, auth, cache, stellar-cli, Raven reachability
kedgeway logout                               # delete stored credentials
kedgeway diagnose [path]                      # human-readable report
kedgeway diagnose . --json                    # Diagnosis as JSON
kedgeway diagnose . --fail-on warning         # exit 2 on any finding >= warning
kedgeway diagnose . --fixture snapshot.json   # offline, no Raven
kedgeway diagnose . --offline                 # use the cached Raven snapshot
kedgeway diagnose . --sarif kedgeway.sarif    # also write SARIF 2.1.0
kedgeway diagnose . --format sarif            # print SARIF instead of the report
kedgeway diagnose . --format annotations      # GitHub annotations, then the report
kedgeway migrate [path]                       # guide plus a dry-run plan
kedgeway migrate [path] --write               # apply them
kedgeway mcp                                  # MCP server over stdio
```

Raven is OAuth-protected. Each run tries stored credentials silently; only on a 401 does it open the browser (authorization code + PKCE). Credentials live in `~/.config/kedgeway/auth.json` (mode 0600).

### Flags

| Flag | Meaning |
| ---- | ------- |
| `--json` | Print the Diagnosis as JSON |
| `--fixture <file>` | Use an ecosystem snapshot JSON instead of Raven (offline) |
| `--fail-on <severity>` | Exit 2 if any finding is at or above `critical`, `warning` or `info` |
| `--format <text\|json\|sarif\|annotations>` | `diagnose` only: stdout format (`annotations` prints GitHub workflow commands, then the text report). `--json` is `--format json`; combining the two exits 1 |
| `--annotations <file>` | `diagnose` only: also write the GitHub annotations to `file` |
| `--sarif <file>` | `diagnose` only: also write SARIF 2.1.0 to `file` (stdout follows `--format`) |
| `--offline` | `diagnose` / `migrate`: use the cached ecosystem snapshot only; exit 1 if there is none. Contradicts `--no-cache` (exit 1); ignored, with a warning, when `--fixture` is set |
| `--no-cache` | `diagnose` / `migrate`: ignore the cached snapshot and fetch live (the result is still written to the cache) |
| `--max-age <duration>` | `diagnose` / `migrate`: how old a cached snapshot may be before it is refetched. `30s`, `15m`, `24h`, `2d`; default `24h` |

### Exit codes

| Code | Meaning |
| ---- | ------- |
| `0` | OK |
| `1` | Tool error |
| `2` | A finding met `--fail-on` |

`kedgeway migrate` uses the same codes with these meanings: `0` nothing to do, only manual steps in a dry run, or edits applied cleanly; `2` a dry run has at least one automatic edit (so CI can gate), or `--write` could not apply some step (`skipped`); `1` error (including a refused write).

## Findings

kedgeway detects `soroban-sdk` in every `Cargo.toml` (string and table forms, renamed deps, `[workspace.dependencies]`, `workspace = true`) and `@stellar/stellar-sdk`, `stellar-sdk`, `@stellar/stellar-base` and `soroban-client` in every `package.json`.

| Code | Severity | Meaning |
| ---- | -------- | ------- |
| `SDK_DEPRECATED` | critical | `soroban-sdk` major is in the Scout deprecated sample and below current, or 2+ majors behind |
| `SDK_BEHIND` | warning | `soroban-sdk` is exactly one major behind |
| `SDK_CURRENT` | info | `soroban-sdk` is on the current major |
| `SDK_UNKNOWN` | warning | `soroban-sdk` version could not be resolved |
| `JS_SDK_DEPRECATED` | critical | `@stellar/stellar-sdk` / `@stellar/stellar-base` two or more majors behind |
| `JS_SDK_BEHIND` | warning | JS SDK is exactly one major behind |
| `JS_SDK_CURRENT` | info | JS SDK is on the current major |
| `JS_SDK_UNKNOWN` | warning | JS SDK version could not be resolved |
| `JS_LEGACY_PACKAGE` | critical | Legacy package such as `soroban-client` or `stellar-sdk` |
| `CLI_DEPRECATED` | critical | A pinned `stellar-cli` is two or more majors behind the current Stellar CLI |
| `CLI_BEHIND` | warning | A pinned `stellar-cli` is exactly one major behind |
| `CLI_CURRENT` | info | A pinned `stellar-cli` is on the current major (or newer) |
| `CLI_UNKNOWN` | warning | A `stellar-cli` pin exists but its version is unparseable, or the current CLI version is unavailable |
| `RUST_TARGET_LEGACY` | warning (info with wasm-pack, wasm-bindgen or trunk) | `wasm32-unknown-unknown` is declared in a repo with `soroban-sdk` and no `wasm32v1-none`; Stellar CLI 23+ builds for `wasm32v1-none` |
| `RUST_TOOLCHAIN_OLD` | warning | A pinned Rust channel is below 1.84.0 in a repo with `soroban-sdk` |
| `NO_SDK_FOUND` | info | No Stellar SDK dependency found |
| `MANIFEST_UNPARSEABLE` | warning | A manifest or directory could not be read or parsed, so it was not checked |
| `DATA_DEGRADED` | warning | Part of the ecosystem data could not be fetched or parsed |

Version ranges that do not pin a major (`<21`, `a || b`) are reported as `*_UNKNOWN`, unless a lockfile pins the dependency (see below).

### Toolchain checks

Beyond the SDKs, kedgeway reads the toolchain a repo pins. Every finding carries the file and line it came from (`pinned in .github/workflows/ci.yml:23`), so annotations and SARIF point at it.

- **Stellar CLI pins** (one finding per pin; nothing at all when the repo pins none): `cargo install ... stellar-cli --version X` (or `--tag X` for a git install), `cargo install stellar-cli@X`, `cargo binstall stellar-cli@X`, `stellar-cli@X`, `npm i -g @stellar/stellar-cli@X`, legacy `soroban-cli` installs (reported as a pin, with the evidence saying "legacy soroban-cli") and release-download URLs (`.../releases/download/vX/`, `stellar-cli-X-<triple>.tar.gz`) in `.github/workflows/*.yml|yaml`, `Dockerfile*`, `Makefile`, `*.sh` in the root and `scripts/`; the `version:` input of a `stellar/stellar-cli` action step (the action ref itself is not a CLI version); `stellar-cli X` in `.tool-versions`; and `@stellar/stellar-cli` in `package.json`. The pin is compared with the "Stellar CLI" row of the official [software versions](https://developers.stellar.org/docs/networks/software-versions) table by major: 2+ behind is `CLI_DEPRECATED`, one behind `CLI_BEHIND`, otherwise `CLI_CURRENT`; an unparseable pin (`main`, a CI expression) or an unavailable current version is `CLI_UNKNOWN`. A missing row raises `DATA_DEGRADED`. A cache written before this check existed is refetched; when it must be used anyway (`--offline`, or Raven down) a `DATA_DEGRADED` note says the CLI version is missing.
- **Rust target**: `wasm32-unknown-unknown` is read from `rust-toolchain.toml` (`targets`), `.cargo/config.toml` (`[build] target`) and `rustup target add`, `--target`, `targets:` or `CARGO_BUILD_TARGET` lines in workflows, Dockerfiles, Makefiles and scripts. `RUST_TARGET_LEGACY` fires once per declaration site when a `soroban-sdk` dependency exists and `wasm32v1-none` is declared nowhere: Stellar CLI 23+ builds contracts for `wasm32v1-none`, so run `rustup target add wasm32v1-none`. When the declaring line also uses `wasm-pack`, `wasm-bindgen` or `trunk` (browser Wasm in a monorepo) it is reported as `info` instead of `warning`.
- **Rust toolchain pin**: a numeric `channel` in `rust-toolchain.toml` (or a legacy `rust-toolchain` file; a host triple such as `1.81.0-x86_64-unknown-linux-gnu` is ignored) below 1.84.0 is `RUST_TOOLCHAIN_OLD` when a `soroban-sdk` dependency exists. The [setup guide](https://developers.stellar.org/docs/build/smart-contracts/getting-started/setup) requires Rust v1.84.0 or higher because the `wasm32v1-none` target is only available in recent versions. `stable` and `nightly` channels are not pins and are never reported.

Only the command that installs the CLI counts: a `--version` belonging to another command on the same line (`&&`, `;`, `|`) is never read as a pin. Commented-out lines are ignored, backslash continuations are joined, lines longer than 8 KB are skipped, and the scan keeps the same depth and ignore rules as the manifest scan. `NO_SDK_FOUND` is unaffected: a repo with only a CLI pin gets `NO_SDK_FOUND` plus its `CLI_*` finding. `--fail-on` works as before, and `migrate` edits none of these files.

## Lockfile resolution

A manifest range like `^21` says little about what you actually build. When a lockfile exists, kedgeway reports the **resolved** version of each detected dependency and uses it (`resolved ?? manifest version`) for every comparison. Evidence says which one it used, for example `resolved 21.7.6 from Cargo.lock; manifest ^21: major 21 < ...`.

kedgeway resolves the **direct** dependency, never "the highest entry in the file":

| Lockfile | How the direct dependency is found |
| -------- | ---------------------------------- |
| `Cargo.lock` | Among the entries for the crate, the one whose version satisfies the manifest requirement (Cargo rules: bare `21` is `^21`, plus `~`, `=`, `>=`, `<`, wildcards). If none or several satisfy, the dependency stays unresolved and evidence says `ambiguous in Cargo.lock: ...`; the manifest version is then used |
| `package-lock.json` | `packages["node_modules/<name>"]` (v2/v3), else `dependencies[<name>]` (v1) |
| `pnpm-lock.yaml` | The importer's (`.` or the member path) `dependencies` / `devDependencies` / `optionalDependencies` entry; else the one package version satisfying the manifest range (several: `ambiguous in pnpm-lock.yaml`). Minimal parser, lockfile v5 to v9 |
| `yarn.lock` | The block whose descriptor is `name@<manifest range>` (classic) or `name@npm:<manifest range>` (berry; the `resolution` field is a fallback for the version). Minimal parser |

The lockfile is the nearest one walking up from the manifest's directory to the scan root that has a verdict for that dependency; kedgeway never reads above the scan root (if one exists above it, the text report prints a `hint:`). `kedgeway migrate` still edits the **manifest** only: it decides from the resolved verdict, then bumps the manifest. When the manifest already allows the current major but the lockfile pins an older version, the bump would be a no-op, so migrate emits a manual step to refresh the lockfile instead (`cargo update -p soroban-sdk`, `npm update <name>`, `pnpm update <name>` or `yarn upgrade <name>`). Whenever a planned file has a lockfile, migrate also reminds you that the edits do not update it. JS ranges (the pnpm fallback) are matched with the [`semver`](https://www.npmjs.com/package/semver) package (hyphen ranges, `||`, x-ranges, npm prerelease rules); Cargo requirements use kedgeway's own matcher (bare `1.2.3` is `^1.2.3`, `*`, `>=, <` combinations, `=`). The parsers are exercised against real lockfiles from public repositories in `fixtures/lockfiles/` (see `SOURCES.md` there for repository and commit). `DetectedDep` (SDK and facts) gains `resolved` and `resolvedFrom`.

## Annotations

`kedgeway diagnose --format annotations` prints one GitHub workflow command per finding before the normal report, with the dependency's line in the manifest: `::error file=contracts/a/Cargo.toml,line=7,title=SDK_DEPRECATED::...` (`critical` is `error`, `warning` is `warning`, `info` is `notice`). Findings that are not about a file (`DATA_DEGRADED`, `NO_SDK_FOUND`) have no `file`. The line comes from a plain scan of the manifest (the first matching key), so it is best effort; paths are relative to the directory you run from. GitHub caps annotations at 10 per type (error, warning, notice) per step and 50 per job, so a large repo shows only the first ones; the full report is still printed. In the GitHub Action the `annotations` input defaults to on when `GITHUB_ACTIONS=true` (set `annotations: "false"` to disable).

## Headless login

Raven's OAuth server supports authorization code + PKCE and refresh tokens only (no device authorization grant), so there is no `--device` flow. On a machine without a browser use:

```sh
kedgeway login --no-browser        # add --export to print the CI secret afterwards
```

It prints the authorization URL (and does not try to open a browser). Open it in any browser and sign in; the browser is then redirected to `http://127.0.0.1:<port>/callback`, which only exists on the machine running kedgeway. Either paste the full redirect URL (or just its `code`) into the terminal and press Enter, or forward the callback port from your own machine first so the redirect lands on kedgeway directly:

```sh
ssh -L <port>:127.0.0.1:<port> user@remote-host   # <port> is shown in the printed URL's redirect_uri
```

Invalid input gets a one-line error and the prompt repeats. A pasted URL is checked against the login attempt's OAuth `state` (a bare code carries no state, so it cannot be); if there is no state to check, a pasted URL is refused. When stdin is not a terminal, pasting is disabled and only the callback can finish the login. For CI, do this once on a trusted machine and use `login --export` plus the `KEDGEWAY_AUTH` secret.

## `kedgeway init`

`kedgeway init [path]` writes `.github/workflows/kedgeway.yml` (default: the current directory) with the [GitHub Action](#github-action) pinned to this kedgeway version, `fail-on: warning` and `auth: ${{ secrets.KEDGEWAY_AUTH }}`. It refuses to overwrite an existing file (exit `1`) unless you pass `--force`; `--print` writes the YAML to stdout and touches no file. It prints the path it wrote and a reminder to create the `KEDGEWAY_AUTH` secret (see [CI authentication](#ci-authentication)). The pinned tag only exists once that version is released.

## `kedgeway doctor`

`kedgeway doctor` is a self-check that changes nothing: Node version (>= 22.12), auth state (`KEDGEWAY_AUTH` valid in the environment, `auth.json` with tokens, or none), the snapshot cache (path and age), and the Stellar CLI (`stellar --version`, run without a shell with a 5 s timeout, killed with SIGKILL and also bounded by doctor's own timer: not installed is a `warn` since it is optional; with a cached snapshot, the current major or newer is `ok`, one major behind `warn`, two or more `fail`; with `--offline` or no snapshot it is `ok` and only reports the installed version), and Raven reachability (one cheap non-interactive `search` call with a 10 s timeout, skipped with `--offline`; it uses a read-only copy of the credentials, so a token refresh cannot modify `auth.json`). It prints one line per check (`ok`, `warn`, `fail` or `skip`) and exits `1` if any check failed, `0` otherwise (warnings do not fail it).

## Snapshot cache and offline mode

After every successful Raven fetch, kedgeway writes the ecosystem snapshot to `$XDG_CACHE_HOME/kedgeway/snapshot.json` (default `~/.cache/kedgeway/`, mode 0600). Later runs reuse it:

- A snapshot with `DATA_DEGRADED` notes is never written to the cache, and a cached one that carries notes counts as stale.
- Fresh cache (younger than `--max-age`, default `24h`, and not dated in the future): used without calling Raven.
- Stale cache: refetched. If Raven then fails, the stale cache is used and a `DATA_DEGRADED` finding says `using cached snapshot from <observedAt>`.
- `--offline`: never calls Raven. Errors with exit 1 if there is no cache; a stale cache is used with a `DATA_DEGRADED` finding (`snapshot is N hours old`).
- `--no-cache`: skips reading the cache (and the failure fallback) but still writes the fresh snapshot.
- `--fixture` bypasses the cache entirely.

Applies to `diagnose` and `migrate`.

## Migration guide

```sh
kedgeway migrate [path]            # dry run (default): prints a guide and a diff, edits nothing
kedgeway migrate [path] --write    # applies the edits
kedgeway migrate . --fixture snapshot.json
```

The dry run leads with a guide, then the diff. The guide states the published SDK version, the protocol and the observation time from the snapshot. Numbered steps say what kedgeway will edit, which commands you run, and that you must confirm the Stellar CLI and the deploy network target that protocol. kedgeway reads neither. For `soroban-client` and unscoped `stellar-sdk` it also lists import sites it found (up to 20, same depth and skip rules as the manifest scan). Doc hits are cited only when the title or url itself is a migration document; a snippet that merely mentions one is not. If none qualify, the guide says Raven returned no upgrade guide.

The edits stay narrow:

- **Rust**: a deprecated or behind `soroban-sdk` is bumped to the exact current version (for example `28.0.0`). Only the quoted version string on that one line changes, so comments, `features` and formatting are untouched. `workspace = true` members are left alone and the workspace root is bumped instead. `=`, `~` and `^` prefixes are kept; other ranges (`>=`, `<`) become manual steps.
- **JS**: `@stellar/stellar-sdk` is bumped to the current version, keeping `^` or `~` (exact pins stay exact). `@stellar/stellar-base` is a manual step because the snapshot has no current base version. `soroban-client` and unscoped `stellar-sdk` are replaced by `@stellar/stellar-sdk` at `^current`, plus a manual step listing `rg` patterns to update imports. `package.json` is edited by replacing only the affected version (and, for legacy packages, key) spans, so every other byte of the file is preserved (indent, line endings, BOM, number formatting, escapes, key order, minified layout). Only plain versions are edited: `12.x`, `12 || 13`, `a - b` and comma ranges become manual steps. Deps declared in `peerDependencies`, `optionalDependencies`, `overrides` or `resolutions` are not edited.
- **Aliases**: a member such as `"stellar-sdk": "npm:@stellar/stellar-sdk@^12.0.0"` is read as the real package; migrate rewrites its value in place (`npm:@stellar/stellar-sdk@^<current>`, prefix kept), and replaces an alias of a legacy package wholesale with `"@stellar/stellar-sdk": "^<current>"`.
- **Manual steps** are listed with their reason; kedgeway never guesses.
- It never runs `cargo` or `npm`. It prints the follow-up commands (`cargo update -p soroban-sdk`, `npm install`).
- `--write` is refused if a file it would touch has uncommitted changes in git. The check only passes silently when git is not installed or the path is not in a repository; any other git failure also refuses the write. Files are re-read right before writing (the whole batch aborts if one changed) and each file is replaced atomically with its mode preserved. Symlinked manifests are never planned or edited.
- Exit codes: see the table above. A manual-only dry run exits `0` and prints the manual steps.

Always review the diff and run your tests: a major bump can contain breaking API changes that kedgeway does not rewrite.

## Library (TypeScript SDK)

```ts
import { diagnose, createRavenEcosystem } from "kedgeway";

const diagnosis = await diagnose({ path: ".", ecosystem: createRavenEcosystem() });
// or offline: await diagnose({ path: ".", fixture: "snapshot.json" });
```

Also exported: `scanRepo(path)`, the pure `diagnoseRepo(facts, snapshot)`, `diagnoseDetailed` (facts + snapshot + diagnosis), `loadFixture`, `FakeEcosystem`, `planMigration`, `applyMigration`, `migrate`, `buildGuide`, `formatGuide`, `migrationDocs`, `findImportHits`, and the types `Diagnosis`, `Finding`, `Severity`, `EcosystemSnapshot`, `RepoFacts`, `MigrationPlan`, `MigrationStep`, `MigrationGuide`, `SourceHit`.

ESM only (Node >= 22.12). The package `exports` map has no `default` or `require` condition, so `require("kedgeway")` is not supported. Type declarations (`dist/index.d.ts`) are emitted by the build and checked before publishing.

## MCP server

`kedgeway mcp` runs an MCP server over stdio, so an AI assistant can diagnose a repo directly. Tools:

| Tool | Input | Returns |
| ---- | ----- | ------- |
| `diagnose` | `{ path, fixture?, failOn?, format? }` | a text summary and the Diagnosis JSON, or a SARIF 2.1.0 log with `format: "sarif"` |
| `findings_reference` | none | the 18 finding codes with severity, meaning and what `migrate` does for them |
| `migrate` | `{ path, fixture?, write? }` | summary including the guide, plan JSON and unified diff; dry run unless `write: true` |
| `ecosystem_snapshot` | `{ fixture? }` | the ecosystem snapshot (live via Raven unless a fixture is given) |

Claude Code (`.mcp.json`) or Cursor (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "kedgeway": { "command": "kedgeway", "args": ["mcp"] }
  }
}
```

The MCP server never starts an OAuth flow: without stored Raven credentials, live calls fail immediately with `Run "kedgeway login" first`. Run `kedgeway login` once in a terminal (or pass `fixture`). `diagnose`, `migrate` and `ecosystem_snapshot` read the `path` / `fixture` you give them from the local disk; `migrate` with `write: true` edits files there, but only if you started the server with `kedgeway mcp --allow-write`; without it `write: true` returns an error and dry runs still work. The `migrate` tool is annotated as destructive and non-read-only.

## GitHub Action

```yaml
- uses: actions/checkout@v4
- uses: Klorenn/kedgeway@v0.1.0
  with:
    path: .
    fail-on: warning
    auth: ${{ secrets.KEDGEWAY_AUTH }}   # live Raven data; or use `fixture:` for offline
```

| Input | Default | Meaning |
| ----- | ------- | ------- |
| `path` | `.` | directory to scan |
| `fail-on` | `warning` | fail on any finding at or above this severity; empty disables |
| `fixture` | none | ecosystem snapshot JSON (offline). Set this **or** `auth` |
| `auth` | none | Raven credentials from `kedgeway login --export`, as a secret. Set this **or** `fixture` |
| `json` | `false` | print JSON instead of text |
| `sarif` | `false` | also write SARIF 2.1.0 to `$RUNNER_TEMP/kedgeway.sarif` |
| `version` | action tag | kedgeway version to run: empty uses the tag you pinned, a semver (`1.2.3`) overrides it, `source` builds the checked-out action |
| `annotations` | on in Actions | emit GitHub annotations (file and line) for each finding; `"false"` disables |

Pin a release tag as above: `@v1.2.3` installs exactly kedgeway 1.2.3 from npm (no build) and fails with a clear error if that version is not published. Any other ref (`@main`, a SHA, a branch, or the local `./` in this repo's own CI) builds the checked-out source (`npm ci && npm run build`), which is slower; `@main` is unpinned and can change under you. The `version` input overrides the detected version (strict semver such as `1.2.3`, or `source` to force the source build). A pinned tag therefore runs what the npm registry holds for that version (installed with `--ignore-scripts`), not the code at the git tag; `version: source` keeps the git tag as the trust anchor.

Outputs: `summary` (`critical=0 warning=1 info=2`), `report-json` (path to the JSON report under `RUNNER_TEMP`) and `sarif` (path to the SARIF file, only when `sarif: true`).

The action needs a data source and fails fast, naming both inputs, if you set neither:

- `fixture`: a committed snapshot (see `fixtures/ecosystem-2026-11-11.json` for the shape). Offline and deterministic; refresh it yourself.
- `auth`: live Raven data using stored OAuth credentials.

### CI authentication

Log in once on your machine, then store the credentials as a repository secret:

```sh
kedgeway login --export | pbcopy     # macOS; use xclip/wl-copy elsewhere
```

Create a repository secret named `KEDGEWAY_AUTH` with that value (Settings, Secrets and variables, Actions). `login --export` never removes stored credentials and only opens the browser flow when nothing is stored; it prints only a base64 JSON blob (OAuth client registration and tokens) to stdout and warns on stderr that it is a secret; it logs you in first if you are not.

At runtime `KEDGEWAY_AUTH` replaces `auth.json`: kedgeway decodes it, never writes it to disk and refreshes the token in memory only. The decoder accepts base64 wrapped across lines and base64url. If Raven rejects it (expired or revoked) the run fails with a pointer to re-export; a malformed value fails with a one-line `KEDGEWAY_AUTH is not valid` message (CLI and MCP). If Raven rotates refresh tokens, the in-memory refresh cannot update the secret, so it can go stale: re-export when runs start failing. Outside the action you can set `KEDGEWAY_AUTH` yourself (for example `KEDGEWAY_AUTH=... kedgeway diagnose .`). Treat the value like a password and see [SECURITY.md](SECURITY.md) for scope and rotation.

### SARIF and code scanning

```yaml
permissions:
  contents: read
  security-events: write
steps:
  - uses: actions/checkout@v4
  - id: kedgeway
    uses: Klorenn/kedgeway@v0.1.0
    with:
      auth: ${{ secrets.KEDGEWAY_AUTH }}
      sarif: "true"
      fail-on: ""            # let the upload step report instead of failing here
  - uses: github/codeql-action/upload-sarif@v3
    if: always()
    with:
      sarif_file: ${{ steps.kedgeway.outputs.sarif }}
```

The SARIF 2.1.0 log has one run for tool `kedgeway`, a rule per finding code (18) with `shortDescription`, `fullDescription` and a default level (`critical` is `error`, `warning` is `warning`, `info` is `note`), and one result per finding with `ruleId`, `level`, `message.text`, and the repo-relative path and line (`uriBaseId: "%SRCROOT%"`). Findings that are not about a file (`DATA_DEGRADED`, `NO_SDK_FOUND`) have no location. URIs are percent-encoded and relative to the directory you run from (resolved with realpath); `%SRCROOT%` is declared in `originalUriBaseIds` with a description only. If the scan path lies outside the working directory, URIs are absolute `file://` ones without a `uriBaseId`. Locally: `kedgeway diagnose . --sarif kedgeway.sarif`, `--format sarif`, or the MCP `diagnose` tool with `format: "sarif"`.

## CI

```yaml
name: kedgeway
on: [push, pull_request]
jobs:
  diagnose:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: |
          git clone https://github.com/Klorenn/kedgeway /tmp/kedgeway
          (cd /tmp/kedgeway && npm ci && npm run build && npm link)
      - run: kedgeway diagnose . --fail-on warning --fixture snapshot.json
```

For live data in CI set the `KEDGEWAY_AUTH` secret (see [CI authentication](#ci-authentication)); `--fixture` remains the fully offline path.

## Data sources

- **Official docs** (`/docs/networks/software-versions`): the "current" versions, parsed inside Raven's sandbox.
- **Scout**: a sample of deprecated `soroban-sdk` versions, used only for majors below the official current.
- **Stellar Raven**: the MCP gateway that serves both.

## Limitations

- If the software-versions page changes shape, kedgeway reports `DATA_DEGRADED` / `SDK_UNKNOWN` instead of guessing.
- Scout's deprecated set is a capped sample and can disagree with the docs; matching is by major.
- `@stellar/stellar-base` is compared against the `@stellar/stellar-sdk` major.
- Lockfile parsing for `pnpm-lock.yaml` and `yarn.lock` is minimal; unusual layouts resolve to nothing and fall back to the manifest version. Prerelease tags are ignored when testing a version against a manifest requirement. Only `Cargo.lock`, `package-lock.json`, `pnpm-lock.yaml` and `yarn.lock` are read.
- The snapshot cache is a single global file; `--max-age` applies to its `observedAt`.
- `KEDGEWAY_AUTH` refreshes tokens in memory only. If Raven rotates refresh tokens, the stored secret can go stale and must be re-exported.
- Scanning stops at depth 4 and skips `node_modules`, `target`, `dist`, `.git`, `.next`, `vendor`, `build`, `coverage`.
- Migration prints a guide and bumps version strings. It does not rewrite source, and it does not invent a changelog when Raven's doc search returns none.
- The live OAuth flow is not covered by automated tests.

## Roadmap

Not shipped yet:

- [x] Guided migration, not just diagnosis
- [ ] Publish to npm

## The name

A kedge is a small anchor carried out from a drifting ship and hauled in to pull it back on course. kedgeway does that for a Stellar repo's SDK versions.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). Report vulnerabilities as described in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)

<div align="center">

Built on [Stellar Raven](https://raven.stellar.org/mcp) · Mark after Muybridge, *The Horse in Motion* (1878)

</div>
