import type { Metadata } from "next";
import Link from "next/link";
import CodeBlock from "@/components/CodeBlock";
import Callout from "@/components/docs/Callout";
import PrevNext from "@/components/docs/PrevNext";
import styles from "../docs.module.css";

export const metadata: Metadata = {
  title: "Migration guide — kedgeway docs",
  description: "A migration guide from the live snapshot, then narrow SDK version bumps.",
  alternates: { canonical: "/docs/migrate" },
  openGraph: { title: "Migration guide — kedgeway docs", description: "A migration guide from the live snapshot, then narrow SDK version bumps.", url: "/docs/migrate", images: [{ url: "/docs/opengraph-image", width: 1200, height: 630 }] },
};

export default function Page() {
  return (
    <>
      <h1>Migration guide</h1>
      <p className={styles.lede}>A guide from the snapshot, then a narrow edit of the version strings. It does not rewrite your source code.</p>

      <h2>The guide</h2>
      <p>A dry run prints this before the diff.</p>
      <ul>
        <li>Where the dependency is, the version Stellar publishes, the protocol, and the observation time. If the snapshot has no protocol number, the guide says so.</li>
        <li>Numbered steps: the version string kedgeway will change, the commands you run, and a check that your Stellar CLI and the network you deploy to target that protocol. kedgeway reads neither.</li>
        <li>For <code>soroban-client</code> and unscoped <code>stellar-sdk</code>, the files and lines that import them, up to 20. The search uses the same depth and skipped directories as the manifest scan, and does not follow symlinks.</li>
        <li>Raven doc hits whose title or url is a migration document. A page that only mentions a migration inside a snippet is left out. If none qualify, the guide says no upgrade guide came back.</li>
      </ul>

      <h2>Run it</h2>
      <CodeBlock code={`kedgeway migrate [path]            # dry run (default): prints a guide and a diff, edits nothing
kedgeway migrate [path] --write    # applies the edits
kedgeway migrate . --fixture snapshot.json`} />

      <h2>What it changes</h2>
      <ul>
        <li><strong>Rust.</strong> A deprecated or behind <code>soroban-sdk</code> is bumped to the exact current version (for example <code>28.0.0</code>). Only the quoted version string on that one line changes, so comments, <code>features</code> and formatting stay. <code>workspace = true</code> members are left alone and the workspace root is bumped instead. <code>=</code>, <code>~</code> and <code>^</code> prefixes are kept; other ranges (<code>&gt;=</code>, <code>&lt;</code>) become manual steps.</li>
        <li><strong>JavaScript.</strong> <code>@stellar/stellar-sdk</code> is bumped to the current version, keeping <code>^</code> or <code>~</code> (exact pins stay exact). <code>package.json</code> keeps its key order and indentation.</li>
        <li><strong>Legacy packages.</strong> <code>soroban-client</code> and the unscoped <code>stellar-sdk</code> are replaced by <code>@stellar/stellar-sdk</code> at <code>^current</code>, plus a manual step listing <code>rg</code> patterns for the imports you must update yourself.</li>
      </ul>

      <h2>What it refuses</h2>
      <ul>
        <li><code>@stellar/stellar-base</code> is a manual step, because the snapshot has no current base version.</li>
        <li>It never runs <code>cargo</code> or <code>npm</code>. It prints the follow-up commands instead: <code>cargo update -p soroban-sdk</code> and <code>npm install</code>.</li>
        <li><code>--write</code> is refused if a file it would touch has uncommitted changes in git. The check is skipped when git is not installed or the path is not in a repo.</li>
        <li>Anything it cannot do safely is listed as a manual step with its reason. Only plain versions are edited: <code>12.x</code>, <code>12 || 13</code> and comma ranges become manual steps, and dependencies in <code>peerDependencies</code>, <code>optionalDependencies</code>, <code>overrides</code> or <code>resolutions</code> are left alone. kedgeway never guesses.</li>
        <li>Edits are byte-exact: for <code>package.json</code> only the affected spans change, and writes are atomic. Symlinked manifests are never edited.</li>
      </ul>

      <h2>Lockfiles</h2>
      <ul>
        <li><code>migrate</code> decides from the <strong>resolved</strong> version when a lockfile exists, then edits the <strong>manifest</strong> only. It never edits a lockfile.</li>
        <li>When the manifest already allows the current major but the lockfile pins an older version, a bump would change nothing. kedgeway emits a manual step to refresh the lockfile instead: <code>cargo update -p soroban-sdk</code>, <code>npm update &lt;name&gt;</code>, <code>pnpm update &lt;name&gt;</code> or <code>yarn upgrade &lt;name&gt;</code>.</li>
        <li>Whenever a planned file has a lockfile, the plan also reminds you that the edits do not update it.</li>
      </ul>

      <h2>Exit codes</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th scope="col">Code</th><th scope="col">Meaning</th></tr></thead>
          <tbody>
            <tr><th scope="row"><code>0</code></th><td>Nothing to do, only manual steps in a dry run, or the edits were applied cleanly.</td></tr>
            <tr><th scope="row"><code>2</code></th><td>A dry run has at least one automatic edit (so CI can gate on it), or <code>--write</code> could not apply some step.</td></tr>
            <tr><th scope="row"><code>1</code></th><td>Error, including a refused write.</td></tr>
          </tbody>
        </table>
      </div>
      <Callout kind="warning">
        <p>A major bump can contain breaking API changes that kedgeway does not rewrite. Always review the diff and run your tests.</p>
      </Callout>
      <PrevNext href="/docs/migrate" />
    </>
  );
}
