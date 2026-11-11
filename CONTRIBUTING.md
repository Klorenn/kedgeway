# Contributing to kedgeway

Thanks for helping. This guide keeps changes easy to review.

## Setup

Requires Node >= 22.12 (`.nvmrc` pins 22).

```sh
npm ci
npm test            # vitest run
npm run typecheck   # tsc --noEmit
```

The website lives in `site/` and has its own `package.json`: `cd site && npm ci && npm run build`.

## Test-first (TDD)

The CLI is developed test-first. Write a failing test, see it fail for the right reason, then write the minimum code to pass, then refactor. PRs that change behavior without a test will be asked to add one.

## Architecture rules

kedgeway is hexagonal:

- `src/core` is pure logic. **No I/O**: no filesystem, network, process, clock or environment access. Inputs come in as data, results go out as data.
- `src/ports` defines the interfaces core and the CLI depend on.
- `src/adapters` implements ports (filesystem, Raven/MCP, auth storage). All I/O lives here.
- `src/cli` wires adapters to core and handles flags, output and exit codes.

Dependencies point inward: adapters and CLI may import core and ports; core must never import adapters or the CLI.

## Adding a finding rule

1. Add a failing test in `src/core/diagnose.test.ts` that describes the new finding (code, severity, message).
2. Implement the rule in `src/core/diagnose.ts`. Use a new `SCREAMING_SNAKE` code and the lowest severity that is honest.
3. If the rule needs new facts from the repo, extend `src/core/repo-facts.ts` (with tests in `repo-facts.test.ts`).
4. Document the code in the finding codes table in `README.md` and in the site docs under `site/`, and add an entry to `CHANGELOG.md` under `[Unreleased]`.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, optionally scoped (`feat(core): ...`). Keep commits focused. Do not add AI attribution lines (such as `Co-Authored-By` for an assistant) to commit messages.

## Pull request checklist

- [ ] A failing test came first; tests cover the change
- [ ] `npm test` and `npm run typecheck` pass
- [ ] `src/core` still has no I/O
- [ ] README, site docs and `CHANGELOG.md` updated where behavior changed
- [ ] Commits follow Conventional Commits, with no AI attribution lines
- [ ] No secrets, tokens or personal data in code, fixtures or logs

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE).
