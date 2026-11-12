"use client";

import { useEffect, useState } from "react";

const ID = "kw-frame-sprite";
let pending: Promise<void> | null = null;

/**
 * Injects the 11 gallop frames once, as <symbol id="kw-frame-NN"> in a hidden SVG, from a code-split chunk. The hero
 * gallop, the footer gallop and the Plate/Index thumbnails all draw them with <use>, so the frames exist in the page
 * (and in the HTML) zero times until needed instead of three.
 */
export function ensureFrameSprite(): Promise<void> {
  if (document.getElementById(ID)) return Promise.resolve();
  pending ??= import("@/generated/frames.generated").then(({ FRAMES, FRAME_VIEWBOX }) => {
    if (document.getElementById(ID)) return;
    const symbols = FRAMES.map((inner, i) => `<symbol id="kw-frame-${String(i + 1).padStart(2, "0")}" viewBox="${FRAME_VIEWBOX}" overflow="visible">${inner}</symbol>`).join("");
    document.body.insertAdjacentHTML(
      "beforeend",
      `<svg id="${ID}" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>${symbols}</defs></svg>`,
    );
  });
  return pending;
}

/** true once the sprite is in the document. */
export function useFrameSprite(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    ensureFrameSprite().then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);
  return ready;
}
