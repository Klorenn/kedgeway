import { redirect } from "next/navigation";

// The roadmap has shipped (SDK, MCP server, GitHub Action, migration mode); send old links to the docs home.
export default function Roadmap(): never {
  redirect("/docs");
}
