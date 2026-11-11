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
  the brand/construction panel and, once, as a draw-on behind the hero mark. Never in the header.
- **Compact mark** (favicon, 16–32px): 12 horizontal strokes approximating the silhouette, no spiral.
- **Wordmark**: `kedgeway`, Geist Mono, 500, lowercase, letter-spacing −0.01em.
- **Lockup**: mark (height = cap height × 1.6) + 12px gap + wordmark. Mark always to the left.
- **Motion**: the 11-frame gallop cycle at 10fps is allowed in exactly one place, the hero.
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
Background particles: a sparse field of ink dust (1px, ≤ 400 particles) drifting slowly upward across the whole page, 20% opacity, pausing under reduced motion.

## Typography

- **Geist Sans** (headings, body) via `next/font/google`.
- **Instrument Serif, italic** (one emphasized phrase inside each heading, never a whole heading).
- **Geist Mono** (wordmark, overlines, commands, the report).
- Scale: hero 3rem/1.05 (serif italic phrase at 1.08×), section heading 1.75rem/1.15, body 1.0625rem/1.6, overline 0.75rem mono uppercase tracking 0.12em.
- Headings are sentence case, weight 400 for sans with the italic serif carrying the emphasis. No bold heavier than 500.
- Example hero: `Your Soroban SDK <em>is drifting.</em>` — sans + serif italic.

## Layout rules

- **No boxes.** No cards, no bordered panels, no filled surfaces behind text. Structure comes from
  hairlines (`--rule`, 1px) and whitespace.
- Content column 40rem for text, 64rem for data. Centered.
- Vertical rhythm: sections separated by 9rem desktop / 5rem mobile, each opened by a hairline and an overline (`01 — the ecosystem`).
- Code and commands: mono text with a 2px `--ink` left rule, no background, no border.
- The report: plain mono lines on the page, prompt line and severity tag in `--ink` at weight 600, no color, no panel.
- Buttons: one filled `--ink` with `--bg` text (mono), one text link with `→`. Radius 2px. Nothing else is a button.
- Links in body: underline 1px `--ink-2`, no color change.

## Motion

- Hero gallop at 10fps, pauses off-screen, static under reduced motion.
- Grid: deprecated dots light in a left-to-right wave once (1.2s). Nothing else animates. No scroll reveals.

## Image direction

Engraving / etching language: black ink hatching on paper. The hero may carry one wide illustration
band (clouds, sea, or a horizon rendered as engraved hatching, generated as SVG from noise, not a photo),
sitting behind or beside the mark, bleeding to the edges, never behind text. Elsewhere: none.
Subjects: Muybridge plates, nautical charts, measuring instruments. No stock people, no 3D blobs, no photos.

## Voice

Short sentences. Evidence first ("1,285 of 5,863 repos"). No exclamation marks. Say what the tool
does and does not do. Roadmap items are labeled as not shipped.
