# kedgeway demo script (60–90 s)

Record a terminal at a large font (18 pt+), dark theme, window ~110×30. One take per block; cut between blocks.

## 0. Setup (off camera)

```bash
cd /tmp && rm -rf kedgeway-demo && git clone -q https://github.com/Klorenn/kedgeway-demo && cd kedgeway-demo && clear
```

Close the open PR first so the recording shows a fresh create:

```bash
gh pr close 1 --repo Klorenn/kedgeway-demo --delete-branch
```

## 1. Diagnose a repo you have not cloned (15 s)

```bash
npx kedgeway diagnose Klorenn/kedgeway-demo
```

Pause 3 s on the output: two criticals (SDK, stellar-cli), the wasm target and Rust warnings, each with file:line.

## 2. Show the plan (15 s)

```bash
kedgeway migrate .
```

Pause on the guide: the version edit, the manual steps, the protocol line.

## 3. Let it open the PR (20 s)

```bash
GITHUB_TOKEN=$(gh auth token) kedgeway pr .
```

It prints the PR URL. Cmd-click it (or switch to the browser) and show the PR: title, findings table, edits, checklist, migration guide. Pause 5 s.

## 4. Run it again (10 s)

```bash
GITHUB_TOKEN=$(gh auth token) kedgeway pr .
```

Output says `update`, same URL. One PR, never two.

## 5. Close (5 s)

Show the site: https://kedgeway.vercel.app

Caption for X:

> kedgeway: Stellar-aware Dependabot. Diagnoses a repo by URL, explains what's behind the protocol, and opens the migration PR. Live data from Stellar Raven. npm i -g kedgeway
