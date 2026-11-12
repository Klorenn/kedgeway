"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import styles from "./Typewriter.module.css";

const CHARS_PER_SECOND = 900;

/**
 * Types its (server-rendered, complete) children when they first scroll into view, at ~900 chars/s,
 * with a block cursor. Under reduced motion, without JS, or when already in view on load, the text just shows.
 */
export default function Typewriter({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (root.getBoundingClientRect().top < window.innerHeight) return; // already visible: no animation

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes: { node: Text; full: string }[] = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = n as Text;
      if (t.data.length > 0) nodes.push({ node: t, full: t.data });
    }
    const total = nodes.reduce((sum, n) => sum + n.full.length, 0);

    // Reserve the final height so typing causes no layout shift.
    root.style.minHeight = `${root.getBoundingClientRect().height}px`;
    nodes.forEach((n) => (n.node.data = ""));
    const cursor = document.createElement("span");
    cursor.className = styles.cursor as string;
    cursor.setAttribute("aria-hidden", "true");

    let raf = 0;
    let started = false;
    const type = (): void => {
      started = true;
      const t0 = performance.now();
      const tick = (now: number): void => {
        let remaining = Math.min(total, Math.floor(((now - t0) / 1000) * CHARS_PER_SECOND));
        let last = nodes[0]?.node;
        for (const n of nodes) {
          const take = Math.max(0, Math.min(n.full.length, remaining));
          n.node.data = n.full.slice(0, take);
          remaining -= take;
          if (take > 0) last = n.node;
        }
        if (last?.parentNode) last.parentNode.insertBefore(cursor, last.nextSibling);
        if (now - t0 < (total / CHARS_PER_SECOND) * 1000) raf = requestAnimationFrame(tick);
        else nodes.forEach((n) => (n.node.data = n.full));
      };
      raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (!started && entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          type();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(root);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      nodes.forEach((n) => (n.node.data = n.full));
      cursor.remove();
    };
  }, []);

  return <div ref={ref}>{children}</div>;
}
