import type { Metadata, Viewport } from "next";
import { SITE } from "@/lib/seo";
import "./globals.css";

// The <html> element (and its lang) is rendered per locale by app/[locale]/layout.tsx and, for URLs outside any
// locale, by app/not-found.tsx. This root layout only carries what every locale shares.
export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
};

// theme-color needs literal values (metadata API); they mirror --color-bg for Dark and Paper.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0c" },
    { media: "(prefers-color-scheme: light)", color: "#f4f2ee" },
  ],
  colorScheme: "dark light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
