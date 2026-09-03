# Reference measurements

## Method

Measurements use the three 853 x 1844 standalone renders for high-resolution
color and geometry evidence, with the five composite boards used to confirm
recurring patterns and missing states.

Colors below are median RGB values sampled from broad, mostly flat regions at a
two-pixel interval. Median sampling reduces the effect of text, compression,
shadows, gradients, and antialiasing. Raster samples are evidence, not literal
CSS tokens: generated screenshots contain subtle noise and post-processing, so
candidate colors are rationalized into reusable semantic roles.

The standalone browser viewport remains a `430x932` candidate. Absolute CSS
geometry therefore remains provisional, while ratios and repeated design
patterns are reliable.

## High-resolution color evidence

| Reference | Region | Median sample |
| --- | --- | --- |
| Dashboard | Outer canvas | `#F9FBFB` |
| Dashboard | Primary dark action | `#012A32` |
| Dashboard | Card surface | `#FEFEFE` |
| Orders | Selected filter | `#01262D` |
| Orders | Card surface | `#FEFEFE` |
| Orders | Mint status background | `#E4F7F5` |
| Wallet | Outer canvas | `#FBFCFC` |
| Wallet | Dark balance card | `#04212A` |
| Wallet | Bright mint action | `#A0F2DB` |

Dominant quantized accent evidence across the standalone renders includes dark
teal near `#002830`, mint near `#78E0C0`, aqua near `#48C8E0`, pale mint near
`#E8F8F0`, pale violet near `#F0F0F8`, and pale coral near `#F8F0E8`.

## Geometry evidence

- Main phone gutters repeatedly occupy roughly 4.5-5% of the canvas width,
  supporting 20px gutters around a 390-430px viewport and 16px at 320px.
- Controls consistently appear in the 44-48px logical-height range.
- Primary bottom-navigation action circles are approximately 56px with a
  28-32px icon.
- Cards consistently use larger corners than controls. The existing 12px
  control, 20px card, 24px panel, and 28px sheet hierarchy matches the visual
  ratios and is retained as the candidate.
- Repeated vertical spacing follows a 4px-derived rhythm, with 16px internal
  compact gaps, 20px standard card padding, and 24-32px section gaps.
- Phone navigation remains approximately 68px before the bottom safe area.
- Shadows are broad and low-opacity; visible borders remain 1px.

## Typography evidence and limitation

The reference text has compact neo-grotesk/SF-style proportions, tight headings,
and stable tabular financial figures. Raster images cannot identify an exact
font file. The repository has three conflicting authorities:

| Source | Current family direction |
| --- | --- |
| Web runtime | Open Sans through `next/font` |
| Paused native token source | SF Pro/platform system sans |
| Older web documentation | Geist/Inter/system fallbacks |

Open Sans is visibly wider and more humanist than the references. Inter is the
recommended cross-platform candidate because it stays close to SF-style
proportions on Windows and non-Apple browsers. This remains an owner decision;
the application font has not changed.

The checked-in `typography-review.html` rendered Open Sans, Inter, Geist, and the
platform-system stack with identical tokens and content. The resulting
`typography-comparison.png` confirmed that all three requested web fonts loaded
rather than silently falling back. Inter most closely preserves the reference's
heading, amount, and dense-row proportions; Geist is a viable tighter geometric
alternative, while Open Sans produces the largest proportional departure.

## Existing-token comparison

| Role | Current client value | Candidate | Finding |
| --- | --- | --- | --- |
| Canvas | `#EEF3F3` | `#F8FAFA` | Current canvas is visibly darker/greener than all standalone references. |
| Surface | `#FFFFFF` | `#FFFFFF` | Already aligned. |
| Surface muted | `#F7FAFA` | `#F5F8F8` | Close; candidate adds slightly clearer separation from canvas. |
| Foreground | `#07171B` | `#09262B` | Candidate moves toward the dark teal reference hue. |
| Primary action | `#0B2429` | `#002A31` | Candidate is bluer and closer to sampled dark actions. |
| Action soft | `#E4F0EE` | `#E7F4F2` | Close; candidate is slightly brighter. |
| Border | `#D9E1E2` | `#DFE5E6` | Candidate matches the quieter reference boundaries. |
| Mint accent | `#55D6BE` | `#55D6BE` | Existing strong accent remains aligned. |
| Bright mint action | Missing | `#9CF1DA` | New role needed for the Wallet funding action; it must not replace status colors. |
| Aqua | `#45C4DD` | `#45C4DD` | Already aligned. |
| Violet | `#7C6CFF` | `#7C6CFF` | Already aligned. |
| Coral | `#F27868` | `#F27868` | Already aligned. |

## Accessibility treatment

The screenshots sometimes use bright accents as small text. The candidate token
set separates decorative/status accents from darker semantic text colors so
normal text retains WCAG AA contrast on its soft background. Recorded contrast
pairs in `tokens.candidate.json` are all at least 4.5:1 for normal text.
