"use client";

/** "Back to top": smooth scroll, instant under reduced motion. */
export default function BackToTop({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}
    >
      Back to top ↑
    </button>
  );
}
