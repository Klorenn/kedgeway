import type { Metadata } from "next";
import Link from "next/link";
import CodeBlock from "@/components/CodeBlock";
import Callout from "@/components/docs/Callout";
import PrevNext from "@/components/docs/PrevNext";
import styles from "../docs.module.css";

export const metadata: Metadata = {
  title: "Migration mode — kedgeway docs",
  description: "Plan and apply SDK version bumps with kedgeway migrate: what it changes and what it refuses.",
  alternates: { canonical: "/docs/migrate" },
  openGraph: { title: "Migration mode — kedgeway docs", description: "Plan and apply SDK version bumps with kedgeway migrate: what it changes and what it refuses.", url: "/docs/migrate", images: [{ url: "/docs/opengraph-image", width: 1200, height: 630 }] },
};

export default function Page() {
  return (
    <>
      <h1>Migration mode</h1>
      <p className={styles.lede}>An experimental, deliberately narrow command that bumps SDK versions in your manifests. It does not rewrite your source code.</p>

      <h2>Run it</h2>
      <CodeBlock code={`kedgeway migrate [path]            # dry run (default): prints a unified diff, edits nothing
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
        <li>Anything it cannot do safely is listed as a manual step with its reason. kedgeway never guesses.</li>
      </ul>

      <h2>Exit codes</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th scope="col">Code</th><th scope="col">Meaning</th></tr></thead>
          <tbody>
            <tr><th scope="row"><code>0</code></th><td>Nothing to do, or the edits were applied.</td></tr>
            <tr><th scope="row"><code>2</code></th><td>The plan has steps and this was a dry run, so CI can gate on it.</td></tr>
            <tr><th scope="row"><code>1</code></th><td>Error.</td></tr>
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
