# kedgeway redesign spec (Figma → site)

Source of truth: https://www.figma.com/design/6rKIUe1E0xiVb0s8PfSJK3 (deep-link `?node-id=30-1573`, replace `:` with `-`). When Figma and this document disagree, Figma wins. Read sizes, spacing and states off components, not screenshots. This document supersedes BRAND.md.

## 0. Frames and components

| Frame | Node |
|---|---|
| Landing / Desktop 1440 / Dark | 30:1573 |
| Landing / Desktop 1440 / Paper | 32:4122 |
| Landing / Mobile 390 / Dark | 31:2837 |
| Landing / Mobile 390 / Paper | 32:4259 |
| Docs / Desktop 1440 / Dark | 34:6742 |
| Docs / Desktop 1440 / Paper | 35:8463 |
| Docs / Mobile 390 / Dark | 34:7546 |
| Docs / Mobile 390 / Paper | 35:8543 |
| Docs / Mobile 390 / Dark (section menu open) | 34:8244 |
| Docs / Mobile 390 / Paper (section menu open) | 35:8586 |
| Motion spec | 43:6370 |
| Logo sheet | 47:6417 |
| Open Graph 1200×630 | 5:2073 |
| Social 1080×1080 / 1600×900 / GitHub 1280×640 | 5:2370 / 5:2667 / 5:2964 |
| Favicons 16 / 32 / 32@8x / 180 / 512 | 6:52 / 6:27 / 6:77 / 47:7737 / 6:2 |

| Component | Node | Variants / states |
|---|---|---|
| Logo/Mark (rearing horse) | 47:6412 | fill = ink |
| Logo/Lockup | 47:6413 | mark + 16px gap + wordmark |
| Lockup/Nav | 8:2 | — |
| Nav/Desktop, Nav/Mobile | 27:347, 27:655 | — |
| Button | 27:306 | Primary / Secondary / Link × Default / Hover |
| Nav link | 27:313 | Default / Hover |
| Copy button | 27:320 | Default / Hover |
| Social button | 27:335 | X / GitHub × Default / Hover |
| Menu button | 27:344 | Default / Hover |
| Card/Stat, Card/Step, Card/Finding | 27:954, 27:957, 27:961 | static |
| Card/Way | 27:972 | Default / Hover (whole card is the link) |
| FAQ item | 27:988 | Collapsed / Hover / Expanded |
| Code block | 27:991 | header + Copy button |
| Sidebar link | 33:6735 | Default / Hover / Active |
| Pager link | 33:6748 | Previous / Next × Default / Hover |
| Section menu (docs mobile) | 33:6816 | Collapsed / Hover / Expanded |
| Footer/Desktop, Footer/Mobile | 30:884, 30:1249 | — |
| Horse (Muybridge gallop, 11 frames) | 40:10207 | Frame=01…11 (default 08) |
| Background/Clouds | 38:10233 | Desktop/Mobile × Dark/Paper × 6 key frames |
| Background/Landscape | 38:10282 | Desktop/Mobile × Dark/Paper × 6 key frames |
| Texture/Ground | 48:1359 | Desktop / Mobile |
| Plate/Index | 48:1657 | Desktop / Mobile |
| Figure/Ecosystem field (fig. 2) | 50:2151 | Desktop / Mobile |
| Diagram/Pipeline (fig. 3) | 50:2190 | Desktop / Mobile |
| Diagram/Report anatomy (fig. 4) | 50:2229 | Desktop / Mobile |
| Diagram/Severity scale (fig. 5) | 50:2262 | Desktop / Mobile |
| Diagram/Install timeline (fig. 6) | 50:2301 | Desktop / Mobile |
| Texture/Cloud study (fig. 7) | 50:2320 | Desktop / Mobile |
| Diagram/Integrations hub (fig. 8) | 50:2357 | Desktop / Mobile |
| ASCII/Gallop (fig. 9) | 56:2738 | Desktop / Mobile |
| ASCII/Stats table | 56:2745 | Desktop / Mobile |
| ASCII/Findings table | 56:2752 | Desktop / Mobile |
| ASCII/Terminal report | 56:2759 | Desktop / Mobile |
| ASCII/Rule (section divider) | 56:2776 | Desktop / Mobile, text prop Label |

Canvas sections: Components 32:7014, Motion 38:10184, Assets 50:2127, ASCII 56:2723. The Archivo page holds old versions; implement nothing from it.

## 1. Design rules (non-negotiable)

- Two fonts only: Geist (sans) and Geist Mono. Self-hosted through the framework font system, `font-display: swap`.
- One accent color (light coffee), only on clickable elements: primary button fill, text links, active/hover of interactive elements. Never for decoration, headings or illustrations.
- WCAG 2.2 AA: body ≥ 4.5:1, large text/UI ≥ 3:1. Text never below 14px.
- One primary button per view. Sentence case labels.
- No icon fonts. Only icons: X and GitHub SVGs inside Social button. Arrows are text glyphs (→).
- Hover/focus states only on interactive elements.
- Footer: no language switcher; X and GitHub as icons.
- Every color, space and radius comes from tokens (CSS custom properties). No hard-coded hex in components.

## 2. Tokens

| Token | Dark | Paper | Use |
|---|---|---|---|
| --color-bg | #0B0B0C | #F4F2EE | page background |
| --color-surface | #141416 | #EBE8E2 | code blocks, terminal, cards on hover, alternating bands |
| --color-ink | #F2EFE9 | #111111 | primary text, logo, emphasis in ASCII |
| --color-ink-2 | #9A978F | #5C5A55 | secondary text, captions, ASCII body |
| --color-ink-3 | #4A4A4F | #A6A39C | decorative only: dither, ticks, evidence lines. Never text |
| --color-rule | #1F1F22 | #DDD9D1 | hairlines, borders |
| --color-accent | #C9A27E | #8A5A3B | clickable only |
| --color-on-accent | #0B0B0C | #F4F2EE | label on accent fill |

Contrast: ink/bg 17.1 (Dark) 16.9 (Paper); ink-2/bg 6.7 / 6.2, on surface 6.3 / 5.6; accent/bg 8.39 / 5.21, on surface 7.84 / 4.76; on-accent/accent 8.39 / 5.21. The previous red accent (#E5534B / #B42E27) is fully removed.

Theme: follow `prefers-color-scheme` by default (paper for light); `data-theme` attribute. Keep a toggle only if one exists today (it does not).

Spacing: 4, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 120, 160 px. Radius: 4, 8 px. Scrim opacity 0.8.

| Style | Font | Weight | Size / LH | Notes |
|---|---|---|---|---|
| Hero/Sans | Geist | 500 | 72/72 | desktop H1 |
| Display/Mobile | Geist | 500 | 40/44 | mobile H1 |
| Display/OG | Geist | 500 | 60/60, −2% | OG/social only |
| Heading/Sans | Geist | 500 | 36/39.6 | desktop H2; 2nd line ink-2 |
| Heading/Mobile | Geist | 500 | 28/32 | mobile H2 |
| Heading/Card | Geist | 500 | 20/28 | |
| Stat | Geist | 500 | 48/56 | |
| Body | Geist | 400 | 17/27.2 | |
| Body/Medium | Geist | 500 | 17/27.2 | |
| Body/Small | Geist | 400 | 15/24 | |
| Label/Overline | Geist Mono | 400 | 14/20 | uppercase |
| Label/Mono | Geist Mono | 400 | 14/24 | captions, fig. labels |
| Button | Geist Mono | 500 | 14/16 | sentence case |
| Mono/Command | Geist Mono | 400 | 14/22 | code |
| Mono/Command Strong | Geist Mono | 600 | 14/22 | |
| Wordmark/Nav | Geist Mono | 500 | 20/26 | |
| Wordmark/Display | Geist Mono | 500 | 48/56, −1% | lockup |
| Wordmark/Giant | Geist Mono | 500 | 216/100%, −4% | footer desktop; clamp() to width |
| Wordmark/Giant Mobile | Geist Mono | 500 | 72/100%, −4% | footer mobile |
| ASCII/Art | Geist Mono | 400 | 14/14 | text art |
| ASCII/Table | Geist Mono | 400 | 14/20 | tables and terminal |

## 3. Layout

Design widths 1440 and 390. Desktop grid: 12 cols, 120 side margins, 24 gutters, content 1200. Mobile: 4 cols, 24 margins, 16 gutters, content 342. Mobile layout below 768; desktop from 1024; between: fluid container, desktop structure, stack when a column would drop below 320. Must not break at 320/768/1024/1280/1440/1920. Cap content at 1200, centered. Desktop widths: 5 cols = 486, 6 = 588, 7 = 690.

Section rhythm: desktop 96 top / 120 bottom; mobile 64 / 80. Inner gap 64 desktop, 40 mobile. No top hairlines; each section opens with an ASCII/Rule. "How it works" and "Findings" sit on a full-bleed surface band.

## 4. Landing (30:1573 / 31:2837)

**Hero stage** (full-bleed, clipped): nav + copy + gallop plate over Background/Clouds (§7).
- Nav: Lockup/Nav (rearing mark 24px + "kedgeway" Wordmark/Nav). Desktop links: Install, Docs, Findings, FAQ, Changelog + GitHub Secondary button. Mobile: lockup + Menu button. Transparent over sky.
- Copy centered (max 960): overline "Stellar toolchain diagnosis"; H1 "Your Soroban SDK is drifting."; subhead (max 560, ink-2); Primary "Get started" + Link "Read the docs →"; proof line "1,285 Soroban repos are on a deprecated SDK today. Scout via Raven, 2026-11-11." (first 19 chars ink).
- Scrim behind copy: bg rect at 0.8 opacity, 48px blur, 64px radius (16 mobile).
- Gallop plate: horse (§6) 960 desktop / 342 mobile on Texture/Ground (1200×64 / 342×40), overlap −48 / −16 so hooves touch. Below, Plate/Index: desktop contact sheet of 11 frames at 100px (static); baseline rule; frame ruler 01–11 with ticks (current tick ink, 2px, follows playing frame); caption "fig. 1 — Sallie Gardner at a gallop · frame 08 of 11" + credit "E. Muybridge, pl. 626 · Palo Alto, 1878" right (stacks on mobile).

**01 — The ecosystem**: ASCII/Rule; split heading block (486) | "Distribution" (588): chart title, Figure/Ecosystem field (391 stippled cells ≈15 repos each; deprecated dense ink, current ink-2, supported sparse ink-3), fig. 2 caption, ASCII/Stats table, source line. Below: 4 × Card/Stat (5,863 / 1,285 / 22% / 28).

**02 — How it works** (surface band): ASCII/Rule; heading (690) | Diagram/Pipeline (486, fig. 3); 3 × Card/Step; "Works with" row.

**03 — The report**: ASCII/Rule; left (486) heading + Diagram/Report anatomy (fig. 4); right (690) ASCII/Terminal report (replaces code block).

**04 — Findings** (surface band): ASCII/Rule; heading (486) | Diagram/Severity scale (588, fig. 5); ASCII/Findings table (replaces card grid); link "All 12 finding codes →".

**05 — Install**: ASCII/Rule; left heading + token note + Diagram/Install timeline (fig. 6); right (690) Code block "Terminal" with existing commands + Copy.

**06 — FAQ**: ASCII/Rule; left heading + Texture/Cloud study (fig. 7); right (690) 6 × FAQ item, first expanded, `button[aria-expanded]` + region.

**07 — Integrations**: ASCII/Rule; heading (690) | Diagram/Integrations hub (486, fig. 8); 4 × Card/Way: TypeScript SDK, MCP server, GitHub Action, Migration mode.

**Closing CTA**: centered ASCII/Gallop (fig. 9 "frame 05, set in type"); H1 "Stop drifting. / Diagnose, then migrate." (2nd line ink-2); Primary "Get started" + Link "Read the docs →"; Code block "Clone". Footer (§9).

Illustration rule: each section uses a different asset, none repeats. Vector figures as inline SVG with fill/stroke `currentColor` or tokens; decorative (`aria-hidden`), meaning in nearby text.

## 5. Docs (34:6742 / 34:7546)

Same nav and footer. Desktop: sticky left sidebar with groups Start, Use, Integrations, Reference, More (Sidebar link Default/Hover/Active with `aria-current="page"`); article in Body/Heading; inline code Mono on surface; links accent + underlined; optional on-page TOC if it exists today; Pager Previous/Next at bottom. Mobile: Section menu (disclosure) under nav replaces sidebar (34:8244). Keep every route and all content; "Getting started" (Install, Log in, Run your first diagnosis, Read the output) is the reference layout.

## 6. Muybridge gallop (illustration and motion; never the logo)

11 SVG frames (40:10207, Frame=01…11), one 180×101 viewBox, hoof baseline y = 89.8. Strokes ink; onion-skin trail group ink-2. Each frame has its own dithered ground shadow (Bayer 4×4 stipple, ink-2): narrower/lighter airborne (02–03), dithered hoof contacts when grounded; export with frames.

Timing: 80 ms/frame (~12.5 fps), 50 ms linear cross-dissolve, loop. Run only while ≥30% in view (IntersectionObserver); pause when tab hidden. Implementation: stack 11 frames as inline SVG `<g>` (or `<symbol>/<use>`), rAF clock, fade incoming over 50 ms then hide previous. No per-frame CSS animations. Reduced motion: no animation, Frame 08 with shadow, tick 08 marked. Plate/Index thumbnails static. Footer small gallop: Frame 05, 200 desktop / 120 mobile, on the landscape band, same timing/reduced rule.

## 7. Dithered backgrounds

Keep the live WebGL shaders (fbm clouds, ridge landscape), 4×4 Bayer, 5 token levels fed from theme tokens.
- Hero sky: 0.5× resolution, pixelated; drift ~10px/s, slow evolution, 24 fps, linear, infinite; clear center behind copy, clearing grows 0.34 → 0.46 with scroll; covers full hero stage incl. gallop plate.
- Footer landscape: 4 ridge layers parallax 2 / 3.4 / 4.8 / 6.2 px/s, 20 fps; far ridge 0.1× with scroll; band 342 desktop / 240 mobile.
- Pause offscreen and hidden tabs; DPR-aware sizing. Reduced motion: static frames (clouds t=40s, landscape t=30s). No WebGL: static PNG of Frame 1 for current theme (key frames in Figma component sets).
- Hero entrance: blocks rise 8px + fade 400 ms ease-out, 60 ms stagger; off under reduced motion.

## 8. ASCII components (56:2723)

Geist Mono 14px, fixed grid (0.6em = 8.4px/char), `white-space: pre`, `font-variant-ligatures: none`. Plain ASCII only: `+ - | = # . : * % @` (Geist Mono lacks box-drawing/block glyphs). Body ink-2; emphasis ink (dense chars, finding codes, critical, [CRITICAL], # bar runs). Never ink-3 for ASCII text.

- ASCII/Rule: `+-- {LABEL} ------------ kedgeway --+` full content width; mobile ends with `+`. Flex: fixed pieces + growing middle clipping a long dash run (`overflow: hidden`). Label = section overline (e.g. "02 — How it works", Label/Overline uppercase), a real heading-level element; dashes `aria-hidden`.
- ASCII/Stats table: desktop 70 cols (status | repos | 36-char share bar | %); mobile 40 cols, 7-char bar. Values: deprecated 1,285 (22.0%), current 197 (3.4%), supported 4,330 (73.9%), unknown 51 (0.9%). Accessible `<table>` with same data (visually hidden or as generation source).
- ASCII/Findings table: desktop 142 cols: code (22) | severity (10) | what it means (100, wrapped); mobile 40 cols, one box per finding, code + severity first line, description wrapped at 36. Rows: SDK_DEPRECATED critical, JS_LEGACY_PACKAGE critical, SDK_BEHIND warning, MANIFEST_UNPARSEABLE warning, DATA_DEGRADED warning, NO_SDK_FOUND info. Semantic table too.
- ASCII/Terminal report: surface panel, 8px radius, rule border, 24px padding (16 mobile); 76 cols desktop / 36 mobile; header box (ecosystem, observed, source), two findings with wrapped messages, tally (critical 2 / warning 0 / info 0 as # and . bars).
- ASCII/Gallop: Frame 05 as ASCII with ramp ` .:-=+*#%@`: 70×24 desktop / 40×14 mobile; caption "fig. 9 · frame 05, set in type"; aria-hidden.
- Generate ASCII at build time (script rendering the SVG frame to a char grid) or copy verbatim from Figma text layers. Never compute at runtime per view.

## 9. Footer (30:884 / 30:1249; every landing and docs page)

Desktop: padding 96 top, 120 sides. Top row: brand column (384) with Body/Small ink-2 description + Social buttons X and GitHub (icon-only, aria-label, 44px hit area); 4 link columns Product, Project, Resources, Author (Label/Overline ink headings, Nav link items). Signature row: Logo/Mark 160px tall, 32px gap, giant "kedgeway" wordmark (Wordmark/Giant, ink, fitted to remaining width, `aria-hidden`). Legal bar: top hairline; "© 2026 kedgeway contributors. MIT licensed." left, "Made by Kl0ren" (link) right. Landscape band: full bleed, 342px, with small gallop (§6).

Mobile (centered): Logo/Mark 64px; description; X and GitHub icons; wrapping link row Install, Docs, Findings, FAQ, Changelog, Security, License MIT; giant wordmark 72px; stacked legal lines; landscape band 240px with gallop 120px. No language switcher.

## 10. Logo, favicons, OG, social

Logo = rearing-horse silhouette (47:6412), Pau's vector exactly, one path `fill="currentColor"`. Lockup: mark + 16px + "kedgeway" Geist Mono 500; mark height 1.17× wordmark size; clear space ¼ mark height; min 16px tall. The gallop never stands in for the logo.

Exports: favicon.svg; favicon-16.png, favicon-32.png (6:52, 6:27); apple-touch-icon.png 180 (47:7737); icon-512.png (6:2) + site.webmanifest (192, 512 on #0B0B0C); favicon.ico (16+32). OG/social PNG 1× and 2×: og.png 1200×630 (5:2073), social-1080.png (5:2370), social-1600x900.png (5:2667), github-social.png 1280×640 (5:2964; upload manually in GitHub settings). Layout: lockup, overline, headline, key stat "1,285 Soroban repos on a deprecated SDK" with ASCII bar ("22% of 5,863"), URL + source line, ASCII gallop on ASCII ground.

URL: kedgeway.xyz is NOT live → use https://kedgeway.vercel.app in image and meta.

Meta (framework metadata API): title "kedgeway — Stellar toolchain diagnosis"; description "kedgeway asks the live Stellar ecosystem what is current and tells you how far behind your Soroban SDK is."; theme-color per scheme (#0B0B0C / #F4F2EE); icons (ico any, svg, apple-touch); manifest; og:type website, og:site_name kedgeway, og:title "Your Soroban SDK is drifting.", og:description "1,285 Soroban repos are on a deprecated SDK. kedgeway diagnoses yours against the live ecosystem.", og:url, og:image https://kedgeway.vercel.app/og.png 1200×630 with alt "kedgeway: Your Soroban SDK is drifting. 1,285 Soroban repos on a deprecated SDK."; twitter summary_large_image + image. Docs pages: own title/description, reuse og.png.

## 11. Component states

Button Primary: accent fill, on-accent label, 4px radius, 48px high (Figma 27:306); hover = label underlined (no opacity). Secondary: rule border, ink label; hover bg surface. Link: accent text; hover underlined. Nav link: ink-2 → ink. Sidebar link Active: ink + 2px ink left bar (Figma 33:6735; the bar is ink, not accent). Card/Way: whole card link; hover surface bg + underlined link. FAQ item: hover surface; expanded shows answer, − / + flips. Copy button: copies, announces "Copied" via polite live region. Social button: 44×44, hover surface. Focus: `:focus-visible` ring 2px solid accent, 2px offset, ≥3:1. Static cards, ASCII and figures: no hover.

## 12. Accessibility

AA in both themes; text ≥14px; never ink-3 on text; scrim keeps hero copy AA in every sky frame. One `<h1>`; sections `<h2>` with ASCII/Rule label as overline. Landmarks header/nav/main/footer + skip link. Decorative SVG/canvas/ASCII `aria-hidden`; ASCII data also as semantic `<table>`. Reduced motion everywhere. Full keyboard path: nav, menu, FAQ, section menu, copy buttons, pager.

## 13. Acceptance

Match Figma at 1440 and 390 (±4px), tokens exact in Dark and Paper. Only Geist + Geist Mono load. Accent only on clickables (grep + visual). Rearing-horse logo in nav, footer signature, favicons, OG, social; old mark nowhere. Hero gallop: 11 frames at 80 ms, 50 ms dissolve, loops, pauses offscreen, Frame 08 under reduced motion. Shaders theme-aware, pause offscreen/hidden, static under reduced motion, PNG fallback without WebGL. ASCII aligned, no fallback glyphs, data available to AT. Footer per §9, same on landing and docs. Meta present; og.png 1200×630 < 300 KB. Lighthouse mobile: A11y ≥95, Best Practices ≥95, SEO ≥95, Perf ≥85; CLS < 0.05. No route/link/content lost; build and lint pass.

## 14. QA checklist

Dark + Paper with prefers-color-scheme · widths 320/390/768/1024/1280/1440/1920 no horizontal scroll, ASCII fits (mobile variants on narrow) · keyboard-only path with visible focus · screen reader: one H1, sections by heading, decorative hidden, tables readable, "Copied" announced · contrast spot-checks (ink-2 on surface bands, primary button in Paper, links on surface, hero copy over brightest sky) · reduced motion: no gallop/sky/landscape/entrance, Frame 08 · gallop cadence ~80 ms in Performance panel, observer pauses offscreen · WebGL disabled → PNG fallbacks · favicons Chrome/Safari/iOS, valid manifest · OG previews Slack/X/LinkedIn/iMessage, GitHub social uploaded · footer icons with labels, no language switcher, decorative wordmark · docs sidebar active, mobile section menu, pager, inline code/links · no console errors; shaders and gallop lazy-loaded below the fold where possible.
