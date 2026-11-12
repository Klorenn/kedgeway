/**
 * Shared UI dictionary: header, footer, docs chrome, shared components and the 404 page.
 * Plain strings only, because it crosses into client components through LocaleProvider.
 * Strings with `{name}` placeholders are filled with `fill()`.
 */
export type DocsGroupId = "start" | "use" | "integrations" | "reference" | "more";
export type DocsPageId =
  | "overview"
  | "getting-started"
  | "authentication"
  | "commands"
  | "findings"
  | "ci"
  | "fixtures"
  | "sdk"
  | "mcp"
  | "github-action"
  | "migrate"
  | "what-it-scans"
  | "data-sources"
  | "architecture"
  | "limitations"
  | "faq";

export interface UiDict {
  /** Accessible label of the Open Graph image (the image text itself stays English). */
  ogAlt: string;
  /** Default description for pages that set none. */
  siteDescription: string;
  skip: string;
  header: {
    home: string;
    nav: string;
    navMobile: string;
    install: string;
    docs: string;
    findings: string;
    faq: string;
    changelog: string;
    github: string;
    openMenu: string;
    closeMenu: string;
    /** Name of THIS locale's language, written in itself ("English", "Español"): shown on the toggle in the other locale. */
    languageName: string;
  };
  footer: {
    blurb: string;
    nav: string;
    product: string;
    project: string;
    resources: string;
    author: string;
    install: string;
    docs: string;
    findings: string;
    sdk: string;
    mcp: string;
    action: string;
    migrate: string;
    changelog: string;
    github: string;
    license: string;
    security: string;
    contributing: string;
    conduct: string;
    gettingStarted: string;
    authentication: string;
    ci: string;
    fixtures: string;
    faq: string;
    x: string;
    xLabel: string;
    githubLabel: string;
    legal: string;
    madeBy: string;
  };
  docs: {
    crumb: string;
    navMobile: string;
    nav: string;
    menu: string;
    inThisSection: string;
    onThisPage: string;
    pager: string;
    previous: string;
    next: string;
    note: string;
    warning: string;
    groups: Record<DocsGroupId, string>;
    pages: Record<DocsPageId, { title: string; summary: string }>;
  };
  code: {
    terminal: string;
    output: string;
    copy: string;
    copied: string;
    copyToClipboard: string;
  };
  /** "{label}, scroll horizontally" */
  asciiScroll: string;
  asciiDefault: string;
  /** "fig. 1 — ... · frame {frame} of 11" */
  plateCaption: string;
  plateCredit: string;
  notFound: {
    title: string;
    lead: string;
    em: string;
    status: string;
    back: string;
  };
}

/** Replace `{name}` placeholders. */
export const fill = (s: string, vars: Record<string, string | number>): string =>
  s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
