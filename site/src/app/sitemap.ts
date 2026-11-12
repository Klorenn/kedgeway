import type { MetadataRoute } from "next";
import { DOCS_FLAT } from "@/data/docs-nav";

const BASE = "https://kedgeway.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["/", ...DOCS_FLAT.map((p) => p.href).filter((h) => h !== "/")];
  return [...new Set(routes)].map((path) => ({
    url: `${BASE}${path}`,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.6,
  }));
}
