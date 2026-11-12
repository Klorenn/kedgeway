# Real lockfile corpus

Unmodified lockfiles fetched with `curl` from `raw.githubusercontent.com` at the pinned commit, used by
`src/core/lockfile.corpus.test.ts`. They are third-party files kept as test data only (never executed).

| File | Source repository | Commit | Path in repo |
| ---- | ----------------- | ------ | ------------ |
| `cargo-v4.Cargo.lock` | stellar/soroban-examples | 03d42aa6b973dcf3a453a99d0c6a6e8d25a196e2 | `account/Cargo.lock` |
| `package-lock-v3.json` | syronlabs/stellar-mcp | 259ba77c96e720a13039ce81396e238b5f866f7f | `package-lock.json` |
| `pnpm-v9-safeswap.yaml` | Kaizenode/SafeSwap | 7b0f764eb20b6ccedbddb5fabd7b716307802e43 | `p2p-safe-swap/pnpm-lock.yaml` |
| `pnpm-v9-walletskit.yaml` | Creit-Tech/Stellar-Wallets-Kit | 9db6b363f678eb7ba95b6349d4a32a60d5b1253b | `examples/vite-react/pnpm-lock.yaml` |
| `yarn-classic-soroban-react.lock` | paltalabs/soroban-react | a822748a178afdd84e8a58bae83f82627f7a97d9 | `yarn.lock` |
| `yarn-classic-disbursement.lock` | stellar/stellar-disbursement-platform-frontend | b80c9864e0b98851150f3ee6196bbbc7cb24bd64 | `yarn.lock` |
| `yarn-berry-freighter.lock` | stellar/freighter | 1d3486980f7b44b91696f8350d84be9bc28f8656 | `yarn.lock` |

| Repository | License |
| ---------- | ------- |
| stellar/soroban-examples | Apache-2.0 |
| syronlabs/stellar-mcp | MIT |
| Kaizenode/SafeSwap | MIT |
| Creit-Tech/Stellar-Wallets-Kit | MIT |
| paltalabs/soroban-react | Apache-2.0 |
| stellar/stellar-disbursement-platform-frontend | Apache-2.0 |
| stellar/freighter | Apache-2.0 |

These lockfiles are test data only. They are not part of the published npm package (`package.json` `files` lists `dist`, `README.md`, `LICENSE` and `CHANGELOG.md`), so they are not redistributed in the tarball.

URL pattern: `https://raw.githubusercontent.com/<repo>/<commit>/<path>`. Each repository keeps its own license (above).
