import { permanentRedirect } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { href } from "@/i18n/href";

// The roadmap has shipped (SDK, MCP server, GitHub Action, migration mode); send old links to the docs home.
export default async function Roadmap({ params }: PageProps<"/[locale]/docs/roadmap">): Promise<never> {
  const { locale } = await params;
  permanentRedirect(href(isLocale(locale) ? locale : "en", "/docs")); // 308: the page is gone for good
}
