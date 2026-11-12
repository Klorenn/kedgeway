import type { DocsMigrateDict } from "../../schema/docs-migrate";

export default {
  meta: { title: "Migration guide — kedgeway docs", description: "A migration guide from the live snapshot, then narrow SDK version bumps." },
  h1: "Migration guide",
  lede: <>A guide from the snapshot, then a narrow edit of the version strings. It does not rewrite your source code.</>,
  guideH: "The guide",
  guideIntro: <>A dry run prints this before the diff.</>,
  guide: {
    where: <>Where the dependency is, the version Stellar publishes, the protocol, and the observation time. If the snapshot has no protocol number, the guide says so.</>,
    steps: <>Numbered steps: the version string kedgeway will change, the commands you run, and a check that your Stellar CLI and the network you deploy to target that protocol. kedgeway reads neither.</>,
    legacy: <>For <code>soroban-client</code> and unscoped <code>stellar-sdk</code>, the files and lines that import them, up to 20. The search uses the same depth and skipped directories as the manifest scan, and does not follow symlinks.</>,
    docs: <>Raven doc hits whose title or url is a migration document. A page that only mentions a migration inside a snippet is left out. If none qualify, the guide says no upgrade guide came back.</>,
  },
  runH: "Run it",
  changesH: "What it changes",
  changes: {
    rust: <><strong>Rust.</strong> A deprecated or behind <code>soroban-sdk</code> is bumped to the exact current version (for example <code>28.0.0</code>). Only the quoted version string on that one line changes, so comments, <code>features</code> and formatting stay. <code>workspace = true</code> members are left alone and the workspace root is bumped instead. <code>=</code>, <code>~</code> and <code>^</code> prefixes are kept; other ranges (<code>&gt;=</code>, <code>&lt;</code>) become manual steps.</>,
    js: <><strong>JavaScript.</strong> <code>@stellar/stellar-sdk</code> is bumped to the current version, keeping <code>^</code> or <code>~</code> (exact pins stay exact). <code>package.json</code> keeps its key order and indentation.</>,
    legacy: <><strong>Legacy packages.</strong> <code>soroban-client</code> and the unscoped <code>stellar-sdk</code> are replaced by <code>@stellar/stellar-sdk</code> at <code>^current</code>, plus a manual step listing <code>rg</code> patterns for the imports you must update yourself.</>,
    aliases: <><strong>Aliases.</strong> A member such as <code>&quot;stellar-sdk&quot;: &quot;npm:@stellar/stellar-sdk@^12.0.0&quot;</code> is read as the real package. A bump rewrites the value in place to <code>npm:@stellar/stellar-sdk@^&lt;current&gt;</code>, keeping the prefix. An alias of a legacy package is replaced wholesale by <code>&quot;@stellar/stellar-sdk&quot;: &quot;^&lt;current&gt;&quot;</code>. An alias with no version becomes a manual step.</>,
  },
  refusesH: "What it refuses",
  refuses: {
    base: <><code>@stellar/stellar-base</code> is a manual step, because the snapshot has no current base version.</>,
    noRun: <>It never runs <code>cargo</code> or <code>npm</code>. It prints the follow-up commands instead: <code>cargo update -p soroban-sdk</code> and <code>npm install</code>.</>,
    git: <><code>--write</code> is refused if a file it would touch has uncommitted changes in git. The check passes silently only when git is not installed or the path is not in a repository. Any other git failure also refuses the write.</>,
    manual: <>Anything it cannot do safely is listed as a manual step with its reason. Only plain versions are edited: <code>12.x</code>, <code>12 || 13</code> and comma ranges become manual steps, and dependencies in <code>peerDependencies</code>, <code>optionalDependencies</code>, <code>overrides</code> or <code>resolutions</code> are left alone. kedgeway never guesses.</>,
    exact: <>Edits are byte-exact: for <code>package.json</code> only the affected spans change, and writes are atomic. Symlinked manifests are never edited.</>,
  },
  lockfilesH: "Lockfiles",
  lockfiles: {
    resolved: <><code>migrate</code> decides from the <strong>resolved</strong> version when a lockfile exists, then edits the <strong>manifest</strong> only. It never edits a lockfile.</>,
    refresh: <>When the manifest already allows the current major but the lockfile pins an older version, a bump would change nothing. kedgeway emits a manual step to refresh the lockfile instead: <code>cargo update -p soroban-sdk</code>, <code>npm update &lt;name&gt;</code>, <code>pnpm update &lt;name&gt;</code> or <code>yarn upgrade &lt;name&gt;</code>.</>,
    reminder: <>Whenever a planned file has a lockfile, the plan also reminds you that the edits do not update it.</>,
  },
  exitH: "Exit codes",
  exitCols: { code: "Code", meaning: "Meaning" },
  exit: {
    ok: <>Nothing to do, only manual steps in a dry run, or the edits were applied cleanly.</>,
    gate: <>A dry run has at least one automatic edit (so CI can gate on it), or <code>--write</code> could not apply some step.</>,
    error: <>Error, including a refused write.</>,
  },
  warning: <>A major bump can contain breaking API changes that kedgeway does not rewrite. Always review the diff and run your tests.</>,
} satisfies DocsMigrateDict;
