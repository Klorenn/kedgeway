/** Picks the no-WebGL fallback PNG (public/backgrounds) for the current viewport and theme. */
export function backdropSrc(kind: "clouds" | "landscape"): string {
  const mobile = window.innerWidth < 768;
  const pinned = document.documentElement.dataset.theme;
  const paper = pinned === "paper" || (pinned !== "dark" && window.matchMedia("(prefers-color-scheme: light)").matches);
  return `/backgrounds/${kind}-${mobile ? "mobile" : "desktop"}-${paper ? "paper" : "dark"}-frame1.png`;
}
