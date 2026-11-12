import type { Metadata } from "next";

/** Shared social image: the exported 1200x630 Open Graph card, reused by every page. */
export const OG_IMAGE = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: "kedgeway: Your Soroban SDK is drifting. 1,285 Soroban repos on a deprecated SDK.",
} as const;

/** Metadata for a docs page: own title and description, canonical URL, og.png for Open Graph and Twitter. */
export function docsMeta(title: string, description: string, path: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: "kedgeway", title, description, url: path, images: [OG_IMAGE] },
    twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE.url] },
  };
}
