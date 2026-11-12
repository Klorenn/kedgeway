"use client";

import { useEffect, useRef, useState } from "react";
import PixelIcon from "./icons/pixel";
import styles from "./CodeBlock.module.css";

/** "Copy" button for a code block. Announces "Copied" politely for 1.5s. */
export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard can be blocked (insecure context or permissions); fall back to a hidden textarea.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <button type="button" className={styles.copy} onClick={copy}>
      <span aria-live="polite" className={styles.copyLabel}>
        {copied ? <PixelIcon name="check" size={16} /> : null}
        <span className={copied ? styles.sr : undefined}>{copied ? "Copied" : "Copy"}</span>
      </span>
    </button>
  );
}
