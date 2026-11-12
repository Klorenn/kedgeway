export interface DocsPageMeta {
  href: string;
  title: string;
  summary: string;
}
export interface DocsGroup {
  label: string;
  pages: DocsPageMeta[];
}

export const DOCS_GROUPS: DocsGroup[] = [
  {
    label: "Start",
    pages: [
      { href: "/docs", title: "Overview", summary: "What kedgeway is and is not." },
      { href: "/docs/getting-started", title: "Getting started", summary: "Install from source, log in, run your first diagnosis." },
    ],
  },
  {
    label: "Use",
    pages: [
      { href: "/docs/authentication", title: "Authentication", summary: "How login works and what is stored." },
      { href: "/docs/commands", title: "Commands", summary: "Every command, flag and exit code." },
      { href: "/docs/findings", title: "Findings", summary: "Every finding code and what to do about it." },
      { href: "/docs/ci", title: "CI", summary: "Failing a build on drift." },
      { href: "/docs/fixtures", title: "Fixtures", summary: "Run offline with a saved snapshot." },
    ],
  },
  {
    label: "Integrations",
    pages: [
      { href: "/docs/sdk", title: "TypeScript SDK", summary: "Call diagnose and migrate from your own code." },
      { href: "/docs/mcp", title: "MCP server", summary: "Let AI assistants diagnose a repo." },
      { href: "/docs/github-action", title: "GitHub Action", summary: "Gate pull requests on drift." },
      { href: "/docs/migrate", title: "Migration mode", summary: "A guide from the snapshot, then version bumps." },
    ],
  },
  {
    label: "Reference",
    pages: [
      { href: "/docs/what-it-scans", title: "What it scans", summary: "Manifest forms, skipped folders, version ranges." },
      { href: "/docs/data-sources", title: "Data sources", summary: "Where ground truth comes from." },
      { href: "/docs/architecture", title: "Architecture", summary: "Core, ports, adapters, CLI." },
      { href: "/docs/limitations", title: "Limitations", summary: "What kedgeway does not do." },
    ],
  },
  {
    label: "More",
    pages: [
      { href: "/docs/faq", title: "FAQ", summary: "Short answers." },
    ],
  },
];

export const DOCS_FLAT: DocsPageMeta[] = DOCS_GROUPS.flatMap((g) => g.pages);
