import type { MetadataRoute } from "next";
import { DOCS_FLAT } from "@/data/docs-nav";
import { LOCALES } from "@/i18n/config";
import { href } from "@/i18n/href";
import { SITE } from "@/lib/seo";

/** Every page in every locale, each entry listing its language alternates (x-default = English). */
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [...new Set(["/", ...DOCS_FLAT.map((p) => p.href)])];
  return paths.flatMap((path) => {
    const languages: Record<string, string> = { "x-default": `${SITE}${href("en", path)}` };
    for (const l of LOCALES) languages[l] = `${SITE}${href(l, path)}`;
    return LOCALES.map((locale) => ({
      url: `${SITE}${href(locale, path)}`,
      changeFrequency: path === "/" ? ("weekly" as const) : ("monthly" as const),
      priority: path === "/" ? 1 : 0.6,
      alternates: { languages },
    }));
  });
}
