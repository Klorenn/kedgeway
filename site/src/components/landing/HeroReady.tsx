"use client";

import { useEffect, useRef } from "react";

/** Sets `data-ready` on the hero stage once hydrated (a hook for tests and styling). The entrance itself is CSS-only
 *  and starts on first paint, so the hero text never waits for JavaScript. Renders nothing. */
export default function HeroReady() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    ref.current?.parentElement?.setAttribute("data-ready", "");
  }, []);
  return <span ref={ref} hidden />;
}
