import { ImageResponse } from "next/og";
import { hatchGeometry, STATIC_FRAME } from "@/lib/hatch";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_ALT = "kedgeway: Diagnose Stellar SDK drift.";

async function googleFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@${weight}`, { signal: AbortSignal.timeout(5000) })).text();
    const url = /src: url\((.+?)\) format\('truetype'\)/.exec(css)?.[1];
    if (!url) throw new Error("no truetype url in font CSS");
    return await (await fetch(url, { signal: AbortSignal.timeout(5000) })).arrayBuffer();
  } catch (e) {
    console.warn(`og: font ${family} ${weight} unavailable, using fallback (${e instanceof Error ? e.message : String(e)})`);
    return null;
  }
}

// Fetched once per process and shared by opengraph-image and twitter-image.
const fontsPromise: Promise<[ArrayBuffer | null, ArrayBuffer | null]> = Promise.all([googleFont("Geist", 400), googleFont("Geist+Mono", 500)]);

/** The static hatch horse as an SVG data URI (ImageResponse renders SVG through <img>). */
function horseDataUri(): string {
  const g = hatchGeometry(STATIC_FRAME, { weight: 1.5, trails: true });
  const trails = g.trails.map((t) => `<path d="${t.d}" stroke-width="${t.width}"/>`).join("");
  const main = g.main.map((m) => `<path d="${m.d}" stroke-width="${m.width}"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 17 160 76" width="640" height="304"><g fill="none" stroke="#F2EFE9" stroke-linecap="round"><g opacity="0.35">${trails}</g>${main}</g></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export async function renderOg(): Promise<ImageResponse> {
  const [sans, mono] = await fontsPromise;
  const fonts: { name: string; data: ArrayBuffer; weight: 400 | 500; style: "normal" }[] = [];
  if (sans) fonts.push({ name: "Geist", data: sans, weight: 400, style: "normal" });
  if (mono) fonts.push({ name: "Geist Mono", data: mono, weight: 500, style: "normal" });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0B0B0C",
          color: "#F2EFE9",
          padding: "64px 72px",
          fontFamily: sans ? "Geist" : "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontFamily: mono ? "Geist Mono" : "monospace", fontSize: 34, fontWeight: 500, letterSpacing: -0.4 }}>
          kedgeway
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 76, lineHeight: 1.05, letterSpacing: -2, maxWidth: 460 }}>Diagnose Stellar SDK drift.</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={horseDataUri()} width={600} height={285} alt="" />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: mono ? "Geist Mono" : "monospace", fontSize: 24, color: "#9A978F" }}>
          <div style={{ display: "flex" }}>kedgeway.xyz</div>
          <div style={{ display: "flex" }}>Muybridge, pl. 626 — 1878</div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts },
  );
}
