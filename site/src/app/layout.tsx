import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import Particles from "@/components/Particles";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], variable: "--font-serif-face", display: "swap", weight: "400", style: "italic" });

export const metadata: Metadata = {
  metadataBase: new URL("https://kedgeway.xyz"),
  title: { default: "kedgeway: Stellar toolchain diagnosis", template: "%s" },
  description:
    "kedgeway is a CLI that diagnoses how outdated a Stellar or Soroban repo's toolchain is, using live data from Stellar Raven.",
  icons: { icon: "/icon.svg" },
  openGraph: {
    type: "website",
    siteName: "kedgeway",
    title: "kedgeway: Stellar toolchain diagnosis",
    description:
      "kedgeway is a CLI that diagnoses how outdated a Stellar or Soroban repo's toolchain is, using live data from Stellar Raven.",
  },
  twitter: {
    card: "summary_large_image",
    title: "kedgeway: Stellar toolchain diagnosis",
    description: "Diagnose Stellar SDK drift.",
  },
};

export const viewport: Viewport = { themeColor: "#0b0b0c" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${serif.variable}`}>
      <body>
        <Particles />
        <a className="skip" href="#main">Skip to content</a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
