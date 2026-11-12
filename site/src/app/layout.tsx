import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

const SITE = "https://kedgeway.vercel.app";
const TITLE = "kedgeway — Stellar toolchain diagnosis";
const DESCRIPTION = "kedgeway asks the live Stellar ecosystem what is current and tells you how far behind your Soroban SDK is.";
const OG_TITLE = "Your Soroban SDK is drifting.";
const OG_DESCRIPTION = "1,285 Soroban repos are on a deprecated SDK. kedgeway diagnoses yours against the live ecosystem.";
const OG_ALT = "kedgeway: Your Soroban SDK is drifting. 1,285 Soroban repos on a deprecated SDK.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: TITLE, template: "%s" },
  description: DESCRIPTION,
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
  openGraph: {
    type: "website",
    siteName: "kedgeway",
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    url: SITE,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: OG_ALT }],
  },
  twitter: {
    card: "summary_large_image",
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    images: [{ url: "/og.png", alt: OG_ALT }],
  },
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
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body>
        <a className="skip" href="#main">Skip to main content</a>
        <SiteHeader />
        <main id="main" tabIndex={-1}>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
