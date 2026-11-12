import { notFound } from "next/navigation";

// Any path inside a locale that no page matches: throw so [locale]/not-found.tsx renders in that locale, with a 404.
export default function CatchAll(): never {
  notFound();
}
