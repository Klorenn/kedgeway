"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, type ReactNode } from "react";
import type { Locale } from "./config";
import { stripLocale } from "./href";
import type { UiDict } from "@/content/schema/ui";

interface LocaleValue {
  locale: Locale;
  ui: UiDict;
}

const Ctx = createContext<LocaleValue | null>(null);

/** Puts the active locale and the shared UI dictionary (header, footer, docs chrome) in context for client components. */
export function LocaleProvider({ locale, ui, children }: LocaleValue & { children: ReactNode }) {
  return <Ctx.Provider value={{ locale, ui }}>{children}</Ctx.Provider>;
}

export function useLocale(): LocaleValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLocale must be used inside <LocaleProvider>");
  return v;
}

/**
 * The current path without its locale prefix ("/docs/mcp" on both /docs/mcp and /es/docs/mcp). The server sees the
 * rewritten path (/en/docs/mcp) and the browser the requested one (/docs/mcp); stripping makes both agree, so there
 * is no hydration mismatch.
 */
export function useLocalePath(): string {
  return stripLocale(usePathname() ?? "/");
}
