"use client";

import { usePathname } from "next/navigation";
import { DOCS_GROUPS } from "@/data/docs-nav";

/** "Docs / Start / Getting started": the current page and the group it belongs to. */
export default function DocsBreadcrumb({ className }: { className?: string }) {
  const pathname = usePathname();
  for (const g of DOCS_GROUPS) {
    const page = g.pages.find((p) => p.href === pathname);
    if (page) return <p className={className}>Docs / {g.label} / {page.title}</p>;
  }
  return <p className={className}>Docs</p>;
}
