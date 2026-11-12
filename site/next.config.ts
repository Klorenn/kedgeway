import type { NextConfig } from "next";

/**
 * Localized routing without a URL prefix for English.
 * Pages live in app/[locale]/... (prerendered for "en" and "es"). Spanish is served as-is under /es. Every other
 * page path is rewritten internally to /en/... before the filesystem is checked, so / and /docs/* keep their URLs.
 * Excluded from the rewrite: /es, /en (redirected below), anything starting with "_" (_next, dev endpoints) and any
 * path containing a dot (public files: favicon.ico, og.png, sitemap.xml, robots.txt, site.webmanifest).
 */
const NOT_LOCALIZED = "(?!(?:es|en)(?:/|$))(?!_)[^.]*";

const nextConfig: NextConfig = {
  // A lockfile in the parent folder confuses workspace-root inference; pin the root to this app.
  turbopack: { root: import.meta.dirname },
  async redirects() {
    // English never shows /en: direct hits go to the unprefixed URL (301).
    return [
      { source: "/en", destination: "/", statusCode: 301 },
      { source: "/en/:path*", destination: "/:path*", statusCode: 301 },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", destination: "/en" },
        { source: `/:path(${NOT_LOCALIZED})`, destination: "/en/:path" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
