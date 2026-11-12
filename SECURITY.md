# Security Policy

## Reporting a vulnerability

Email **security@kedgeway.xyz**, or use GitHub's [private vulnerability reporting](https://github.com/Klorenn/kedgeway/security/advisories/new) as an alternative channel. Please do not open a public issue for security problems. Include what you found, how to reproduce it, and the version or commit affected. We will acknowledge your report and keep you updated while we work on a fix.

## Scope

In scope:

- **Auth token storage**: how credentials and client registration are written to `~/.config/kedgeway/auth.json` (permissions, leakage into logs or output), and how `KEDGEWAY_AUTH` / `login --export` handle them.
- **OAuth flow**: dynamic client registration, authorization code + PKCE, the local callback server on `127.0.0.1`, state and redirect handling.
- **Repo scanning**: path traversal, symlink handling, unsafe parsing of `Cargo.toml` / `package.json`, or any way a scanned repository can make kedgeway execute code or read outside the scanned path.

Note on the MCP server (`kedgeway mcp`): its tools take a `path` and `fixture` and read those local paths (and, for `migrate` with `write: true`, edit manifests there) by design. Writing is disabled unless the server is started with `--allow-write`. It is a local stdio tool run by the user's own assistant, not a network service; do not expose it to untrusted callers.

Out of scope: vulnerabilities in Stellar Raven itself or in third-party dependencies (report those upstream), and issues requiring a machine that is already compromised.

## CI credentials (`KEDGEWAY_AUTH`)

`kedgeway login --export` prints a base64 JSON blob containing the OAuth client registration and the access and refresh tokens for Stellar Raven. Treat it exactly like a password:

- **Scope**: the token carries the `mcp` scope Raven granted to kedgeway, nothing more. Anyone holding it can call Raven's tools as you until it is revoked or expires; it does not grant access to your repository or machine.
- **Handling**: store it only as a CI secret (for example the repository secret `KEDGEWAY_AUTH`). Never commit, print or log it. kedgeway reads it from the environment, keeps it in memory, never writes it to disk and refreshes it in memory only.
- **Rotation**: rotate it periodically and whenever it may have leaked. Run `kedgeway logout` (deletes the local credentials), then `kedgeway login --export` and replace the secret. Remove the old secret value from CI.
- **Rotating refresh tokens**: kedgeway refreshes the token in memory only and cannot write a new refresh token back to the secret. If Raven rotates refresh tokens, the stored secret can go stale or be invalidated after use; re-export and replace the secret when runs start failing, and treat any failure as a reason to rotate.
- Fork pull requests do not receive repository secrets; the action will fail there with its "set `fixture` or `auth`" message unless you use `fixture`.

The snapshot cache (`$XDG_CACHE_HOME/kedgeway/snapshot.json`, mode 0600) holds only public ecosystem data, no credentials.

## Supported versions

| Version | Supported |
| ------- | --------- |
| 0.x (latest minor only) | Yes |
| Older 0.x minors | No |

## Disclosure

We follow a 90-day coordinated disclosure window: please give us up to 90 days from your report to ship a fix before publishing details. We will credit reporters who want credit.
