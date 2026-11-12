import type { Metadata } from "next";
import Link from "next/link";
import CodeBlock from "@/components/CodeBlock";
import Callout from "@/components/docs/Callout";
import PrevNext from "@/components/docs/PrevNext";
import styles from "../docs.module.css";

export const metadata: Metadata = {
  title: "MCP server — kedgeway docs",
  description: "Run kedgeway as an MCP server so AI assistants can diagnose and migrate a repo.",
  alternates: { canonical: "/docs/mcp" },
  openGraph: { title: "MCP server — kedgeway docs", description: "Run kedgeway as an MCP server so AI assistants can diagnose and migrate a repo.", url: "/docs/mcp", images: [{ url: "/docs/opengraph-image", width: 1200, height: 630 }] },
};

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
            <tr><th scope="row"><code>diagnose</code></th><td><code>{"{ path, fixture?, failOn? }"}</code></td><td>A text summary and the Diagnosis JSON.</td></tr>
            <tr><th scope="row"><code>findings_reference</code></th><td>none</td><td>The 12 finding codes with severity, meaning, and what <code>migrate</code> does for them.</td></tr>
            <tr><th scope="row"><code>migrate</code></th><td><code>{"{ path, fixture?, write? }"}</code></td><td>Summary, plan JSON and a unified diff. A dry run unless <code>write: true</code>.</td></tr>
            <tr><th scope="row"><code>ecosystem_snapshot</code></th><td><code>{"{ fixture? }"}</code></td><td>The ecosystem snapshot: live via Raven unless a fixture is given.</td></tr>
          </tbody>
        </table>
      </div>

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
      <p><code>diagnose</code>, <code>migrate</code> and <code>ecosystem_snapshot</code> read the <code>path</code> or <code>fixture</code> you give them from the local disk. <code>migrate</code> with <code>write: true</code> edits files there, so review what your assistant is allowed to call.</p>
      <PrevNext href="/docs/mcp" />
    </>
  );
}
