import type { Metadata } from "next";
import Shell from "@/components/Shell";
import NotFoundBody from "@/components/NotFoundBody";
import { UI } from "@/content/ui";

// URLs outside every locale (never rewritten, e.g. a missing file). English, with its own <html>.
export const metadata: Metadata = { title: UI.en.notFound.title };

export default function NotFound() {
  return (
    <Shell locale="en">
      <NotFoundBody withTitle={false} />
    </Shell>
  );
}
