# kedgeway — brand system v1

## Idea

A kedge is the small anchor a crew rows out from a drifting ship and hauls in to pull it back on course.
kedgeway does that for a Stellar repo: it measures how far your SDK has drifted and pulls you back.

Core metaphor: **measuring motion**. Muybridge photographed a galloping horse frame by frame to settle
an argument with evidence. kedgeway photographs your toolchain against the live ecosystem and settles
"are we behind?" with evidence. The horse is the mark; the dot grid is the instrument.

Personality: precise, calm, evidence-first, a little old-school scientific. Never playful-startup, never neon.

## Logo

- **Mark**: the fully extended Muybridge gallop frame (frame 8, public domain, Library of Congress),
  rendered as **horizontal hatch strokes**: the silhouette is sliced into thin horizontal bands and
  each band is drawn as one or more ink streaks of varying weight and length, with short seeded
  overshoots to the left (the direction the horse leaves behind), so the figure reads as speed drawn
  with a dry brush. No dots, no outline, no fill. Horse only (rider masked out).
- **Construction**: the mark sits inside a golden-ratio rectangle; the Fibonacci spiral starts at the
  hind hoof and ends at the eye. The spiral is a construction device: shown as 1px `--construct` lines in
  once as a draw-on behind the hero mark (1.6s, then the rectangle settles at 35% and the spiral fades out entirely). Never in the header.
- **Compact mark** (favicon, 16–32px): 12 horizontal strokes approximating the silhouette, no spiral.
- **Wordmark**: `kedgeway`, Geist Mono, 500, lowercase, letter-spacing −0.01em.
- **Lockup**: mark (height = cap height × 1.6) + 12px gap + wordmark. Mark always to the left.
- **Motion**: the 11-frame gallop cycle at 10fps is allowed in the hero; the footer plays the same frames as a film strip at 8fps. The mark is static everywhere else.
  Everywhere else the mark is static.

## Color

Monochrome, **dark**. White ink on near-black, like a negative of an engraving plate. No accent color in UI. The only
chroma is the construction red, used exclusively for construction lines (golden rectangle, spiral, labels).

| Token          | Value     | Use                                               |
|----------------|-----------|---------------------------------------------------|
| `--bg`         | `#0B0B0C` | page (near-black)                                 |
| `--ink`        | `#F2EFE9` | the horse, headings, primary button fill          |
| `--ink-2`      | `#9A978F` | body, captions                                    |
| `--ink-3`      | `#4A4A4F` | dots and decoration only (2.2:1 on `--bg`, never text) |
| `--rule`       | `#1F1F22` | hairlines, "supported" dots                       |
| `--construct`  | `#C8322B` | construction lines only, 1px, never fills or text |

Data states (grid only): deprecated = `--ink`; current = `--ink-2`; supported = `--rule`; unknown = `--ink-3`.
The report's `$` line and `[CRITICAL]` tags are `--ink` at 600 weight, not colored. No glow, no shadows.
Backdrop: a full-viewport animated dithered cloud field (4x4 Bayer, 2px cells, `--rule` / `--ink-3` / `--ink-2` dots with sparse `--ink` highlights), drifting slowly behind everything, darkened behind the content column so text stays at 4.5:1 or better; quieter on the docs. The footer ends in a dithered mountain band (four ridges, farther is darker, drifting 2-6px/s). Both are static under reduced motion. The hero keeps a static baseline with ticks under the horse.

## Typography

- **Geist Sans**: headings 500, body 400, via `next/font/google`.
- **Geist Mono**: wordmark (header and the large footer wordmark, 500), overlines, commands, the report, labels.
- Two typefaces only. No italics anywhere.
- Scale: hero `clamp(2.5rem, 5vw, 4.5rem)` / 1 / -0.035em (one line from 56rem), hero sub 1.125rem/1.5 in 34rem, section heading `clamp(1.75rem, 2.6vw, 2.25rem)` / 1.1 / -0.025em, final CTA `clamp(2.5rem, 5vw, 4rem)`, body 1.0625rem/1.6, overline 0.75rem mono uppercase tracking 0.12em.
- Headings are sentence case, single-tone: Geist 500 in `--ink`. No gray phrase, no italics, no second typeface. No bold heavier than 500.
- Example hero: `Your Soroban SDK is drifting.` on one line at desktop widths.

## Layout rules

- **No boxes.** No cards, no bordered panels, no filled surfaces behind text. **Two exceptions: code blocks** (surface `#101113`, 1px `--rule` border, 2px radius, copy button top-right) **and icon buttons** (40px square, hairline `--rule` border, 2px radius, icon 18px, ink-2 to ink on hover). Structure comes from
  hairlines (`--rule`, 1px) and whitespace.
- Content column 40rem for text, 64rem for data. Centered.
- Vertical rhythm: every section opens with a hairline. Anchor sections (ecosystem, report, install) get 10rem of padding (6rem on mobile); light ones (how it works, what it catches, FAQ, roadmap) get 6rem (3.5rem on mobile). Overlines (`01 — the ecosystem`) only on the anchor sections; no page numbers.
- Header and content share the 64rem container; the header is transparent, and once scrolled gets `rgb(11 11 12 / .72)` with `blur(12px) saturate(140%)` and a hairline (64px tall).
- Pixel icons: 16/24/32px, 1-bit, used only inside diagrams and feature rows (how it works, what it catches, works with), never as decoration (not in navs, footers or headings).
- Code and commands: the `CodeBlock` (mono, label bar, Copy button, no `$` prompts in copyable text). The report in section 03 is output, so it stays plain mono lines.
- The report: plain mono lines on the page, prompt line and severity tag in `--ink` at weight 600, no color, no panel.
- Buttons: one filled `--ink` with `--bg` text (mono, label "Get started"; hover mixes 12% toward `--bg`, pressed moves 1px down), one text link with `→`. Radius 2px. Nothing else is a button.
- Links in body: underline 1px `--ink-2`, no color change.

## Motion

- Hero gallop at 10fps; the cloud field (24fps) and footer mountains (20fps) pause when hidden and are static under reduced motion.
- Outside the hero, motion happens once and stops: the grid wave (1.2s), the diagram packet, the report typewriter, . No scroll reveals.

## Image direction

Engraving / etching language: black ink hatching on paper. The hero may carry one wide illustration
band (clouds, sea, or a horizon rendered as engraved hatching, generated as SVG from noise, not a photo),
sitting behind or beside the mark, bleeding to the edges, never behind text. Elsewhere: none.
Subjects: Muybridge plates, nautical charts, measuring instruments. No stock people, no 3D blobs, no photos.

## Voice

Short sentences. Evidence first ("1,285 of 5,863 repos"). No exclamation marks. Say what the tool
does and does not do. Roadmap items are labeled as not shipped.
