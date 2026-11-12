import type { DocsGroupId, DocsPageId } from "@/content/schema/ui";

/** Docs structure: groups and pages in nav order. Titles and summaries live in the UI dictionary (docs.pages). */
export interface DocsPageMeta {
  id: DocsPageId;
  /** English (unprefixed) path; use href(locale, path) to link. */
  href: string;
}
export interface DocsGroup {
  id: DocsGroupId;
  pages: DocsPageMeta[];
}

const p = (id: DocsPageId): DocsPageMeta => ({ id, href: id === "overview" ? "/docs" : `/docs/${id}` });

export const DOCS_GROUPS: DocsGroup[] = [
  { id: "start", pages: [p("overview"), p("getting-started")] },
  { id: "use", pages: [p("authentication"), p("commands"), p("findings"), p("ci"), p("fixtures")] },
  { id: "integrations", pages: [p("sdk"), p("mcp"), p("github-action"), p("migrate")] },
  { id: "reference", pages: [p("what-it-scans"), p("data-sources"), p("architecture"), p("limitations")] },
  { id: "more", pages: [p("faq")] },
];

export const DOCS_FLAT: DocsPageMeta[] = DOCS_GROUPS.flatMap((g) => g.pages);
