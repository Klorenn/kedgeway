import { permanentRedirect } from "next/navigation";

// The roadmap has shipped (SDK, MCP server, GitHub Action, migration mode); send old links to the docs home.
export default function Roadmap(): never {
  permanentRedirect("/docs"); // 308: the page is gone for good
}
