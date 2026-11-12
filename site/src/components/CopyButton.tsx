"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/i18n/LocaleProvider";
import styles from "./CodeBlock.module.css";

/** "Copy" button. Announces "Copied" through a polite live region for ~1.2s. */
export default function CopyButton({ text }: { text: string }) {
  const { ui } = useLocale();
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
    <>
      <button type="button" className={styles.copy} onClick={copy}>
        <span aria-hidden="true">{copied ? ui.code.copied : ui.code.copy}</span>
        <span className="sr-only">{ui.code.copyToClipboard}</span>
      </button>
      <span className="sr-only" role="status" aria-live="polite">{copied ? ui.code.copied : ""}</span>
    </>
  );
}
