import type { ReactNode } from "react";

/** Prose that may contain inline markup (<code>, <strong>, locale links). */
export type Rich = ReactNode;

/** Per-page metadata: <title>, description (also used for Open Graph and Twitter). */
export interface PageMetaDict {
  title: string;
  description: string;
}
