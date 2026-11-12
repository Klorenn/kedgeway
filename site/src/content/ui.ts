import type { Locale } from "@/i18n/config";
import type { UiDict } from "./schema/ui";
import en from "./en/ui";
import es from "./es/ui";

export const UI: Record<Locale, UiDict> = { en, es };
