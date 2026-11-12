import type { Metadata } from "next";
import { docsMeta } from "@/lib/seo";
import Link from "next/link";
import CodeBlock from "@/components/CodeBlock";
import Callout from "@/components/docs/Callout";
import PrevNext from "@/components/docs/PrevNext";
import styles from "../docs.module.css";

export const metadata: Metadata = docsMeta("MCP server — kedgeway docs", "Run kedgeway as an MCP server so AI assistants can diagnose and migrate a repo.", "/docs/mcp");

export default function Page() {
  return (
    <>
      <h1>MCP server</h1>
      <p className={styles.lede}><code>kedgeway mcp</code> runs an MCP server over stdio, so an AI assistant such as Claude Code or Cursor can diagnose a repo directly.</p>

      <h2>Tools</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th scope="col">Tool</th><th scope="col">Input</th><th scope="col">Returns</th></tr></thead>
          <tbody>
            <tr><th scope="row"><code>diagnose</code></th><td><code>{"{ path | url, ref?, fixture?, failOn?, format? }"}</code></td><td>A text summary and the Diagnosis JSON, or a SARIF 2.1.0 log with <code>format: &quot;sarif&quot;</code>.</td></tr>
            <tr><th scope="row"><code>findings_reference</code></th><td>none</td><td>The 18 finding codes with severity, meaning, and what <code>migrate</code> does for them.</td></tr>
            <tr><th scope="row"><code>migrate</code></th><td><code>{"{ path | url, ref?, fixture?, write? }"}</code></td><td>Summary, including the guide, plus the plan JSON and a unified diff. A dry run unless <code>write: true</code>.</td></tr>
            <tr><th scope="row"><code>ecosystem_snapshot</code></th><td><code>{"{ fixture? }"}</code></td><td>The ecosystem snapshot: live via Raven unless a fixture is given.</td></tr>
          </tbody>
        </table>
      </div>

      <h2>Remote repositories</h2>
      <p><code>diagnose</code> and <code>migrate</code> take exactly one of <code>path</code> or <code>url</code>. <code>url</code> is an https or ssh git URL, or <code>owner/repo</code>. <code>ref</code> is a branch or tag and only applies with <code>url</code>. The repository is shallow-cloned into a temporary directory and deleted afterwards. See <Link href="/docs/what-it-scans#remote-repositories">Remote repositories</Link>.</p>
      <p><code>migrate</code> with <code>url</code> is always a dry run. <code>write: true</code> returns an error, even with <code>--allow-write</code>.</p>

      <h2>Configure your assistant</h2>
      <p>For Claude Code add this to <code>.mcp.json</code>; for Cursor, to <code>.cursor/mcp.json</code>:</p>
      <CodeBlock code={`{
  "mcpServers": {
    "kedgeway": { "command": "kedgeway", "args": ["mcp"] }
  }
}`} />

      <h2>Login</h2>
      <Callout kind="warning">
        <p>The MCP server never starts an OAuth flow. Without stored Raven credentials, live calls fail immediately with <code>Run &quot;kedgeway login&quot; first</code>. Run <code>kedgeway login</code> once in a terminal, or pass <code>fixture</code>.</p>
      </Callout>
      <p><code>diagnose</code>, <code>migrate</code> and <code>ecosystem_snapshot</code> read the <code>path</code> or <code>fixture</code> you give them from the local disk. <code>migrate</code> with <code>write: true</code> edits files there, but only if you started the server with <code>kedgeway mcp --allow-write</code>. Without that flag <code>write: true</code> returns an error and dry runs still work. The tool is annotated as destructive and non-read-only.</p>
      <PrevNext href="/docs/mcp" />
    </>
  );
}
