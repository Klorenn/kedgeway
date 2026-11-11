# Security Policy

## Reporting a vulnerability

Email **security@kedgeway.xyz**, or use GitHub's [private vulnerability reporting](https://github.com/kedgeway/kedgeway/security/advisories/new) as an alternative channel. Please do not open a public issue for security problems. Include what you found, how to reproduce it, and the version or commit affected. We will acknowledge your report and keep you updated while we work on a fix.

## Scope

In scope:

- **Auth token storage**: how credentials and client registration are written to `~/.config/kedgeway/auth.json` (permissions, leakage into logs or output).
- **OAuth flow**: dynamic client registration, authorization code + PKCE, the local callback server on `127.0.0.1`, state and redirect handling.
- **Repo scanning**: path traversal, symlink handling, unsafe parsing of `Cargo.toml` / `package.json`, or any way a scanned repository can make kedgeway execute code or read outside the scanned path.

Out of scope: vulnerabilities in Stellar Raven itself or in third-party dependencies (report those upstream), and issues requiring a machine that is already compromised.

## Supported versions

| Version | Supported |
| ------- | --------- |
| 0.x (latest minor only) | Yes |
| Older 0.x minors | No |

## Disclosure

We follow a 90-day coordinated disclosure window: please give us up to 90 days from your report to ship a fix before publishing details. We will credit reporters who want credit.
