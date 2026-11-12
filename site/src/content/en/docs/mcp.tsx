import type { DocsMcpDict } from "../../schema/docs-mcp";
import { linkFor } from "@/i18n/Link";

const L = linkFor("en");

export default {
  meta: { title: "MCP server — kedgeway docs", description: "Run kedgeway as an MCP server so AI assistants can diagnose and migrate a repo." },
  h1: "MCP server",
  lede: <><code>kedgeway mcp</code> runs an MCP server over stdio, so an AI assistant such as Claude Code or Cursor can diagnose a repo directly. It exposes five tools.</>,
  toolsH: "Tools",
  cols: { tool: "Tool", input: "Input", returns: "Returns" },
  none: "none",
  returns: {
    diagnose: <>A text summary and the Diagnosis JSON, or a SARIF 2.1.0 log with <code>format: &quot;sarif&quot;</code>.</>,
    findings_reference: <>The 18 finding codes with severity, meaning, and what <code>migrate</code> does for them.</>,
    migrate: <>Summary, including the guide, plus the plan JSON and a unified diff. A dry run unless <code>write: true</code>.</>,
    ecosystem_snapshot: <>The ecosystem snapshot: live via Raven unless a fixture is given.</>,
    pr: <>Opens or updates the migration pull request. <code>dry_run: true</code> returns the title and body instead.</>,
  },
  remoteH: "Remote repositories",
  remote: <><code>diagnose</code> and <code>migrate</code> take exactly one of <code>path</code> or <code>url</code>. <code>url</code> is an https or ssh git URL, or <code>owner/repo</code>. <code>ref</code> is a branch or tag and only applies with <code>url</code>. The repository is shallow-cloned into a temporary directory and deleted afterwards. See <L to="/docs/what-it-scans#remote-repositories">Remote repositories</L>.</>,
  remoteDry: <><code>migrate</code> with <code>url</code> is always a dry run. <code>write: true</code> returns an error, even with <code>--allow-write</code>.</>,
  prH: "Opening a pull request",
  pr: <>The <code>pr</code> tool runs the same flow as <L to="/docs/commands#pr"><code>kedgeway pr</code></L>: it creates the branch <code>kedgeway/migrate-&lt;major&gt;</code> from the base, applies the manifest edits, commits, force-pushes that branch and creates or updates one pull request. It needs a local checkout with a clean working tree: <code>url</code> is refused with an error.</>,
  prBranch: <>The <code>pr</code> tool never accepts <code>allow_any_branch</code>: a branch outside <code>kedgeway/</code> is refused.</>,
  prDry: <>Opening a pull request, anything but <code>dry_run: true</code>, requires the server to be started with <code>kedgeway mcp --allow-write</code> and a <code>GITHUB_TOKEN</code> in the environment of the server process. The token is deliberately not a tool parameter. <code>dry_run: true</code> works without <code>--allow-write</code> and without a token, and touches neither git nor the network.</>,
  configH: "Configure your assistant",
  config: <>For Claude Code add this to <code>.mcp.json</code>; for Cursor, to <code>.cursor/mcp.json</code>:</>,
  loginH: "Login",
  loginWarning: <>The MCP server never starts an OAuth flow. Without stored Raven credentials, live calls fail immediately with <code>Run &quot;kedgeway login&quot; first</code>. Run <code>kedgeway login</code> once in a terminal, or pass <code>fixture</code>.</>,
  loginBody: <><code>diagnose</code>, <code>migrate</code> and <code>ecosystem_snapshot</code> read the <code>path</code> or <code>fixture</code> you give them from the local disk. <code>migrate</code> with <code>write: true</code> edits files there, but only if you started the server with <code>kedgeway mcp --allow-write</code>. Without that flag <code>write: true</code> returns an error and dry runs still work. The tool is annotated as destructive and non-read-only.</>,
} satisfies DocsMcpDict;
