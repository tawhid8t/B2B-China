# Client design lock report - Phase 2 candidate

Status: **Approved for client-web preview on 2026-09-03; not yet adopted by customer-facing routes**

## Outcome

The Premium Dark Accent Commerce references support a consistent system: nearly
white canvas, white elevated surfaces, dark blue-teal primary areas, compact
strong typography, quiet borders/shadows, 4px-derived spacing, 12-28px radius
hierarchy, outline icons, and restrained mint/aqua/violet/coral accents.

The current web foundation is structurally suitable, but its canvas, dark-action
hue, font, and several local component values prevent faithful matching.

## Candidate decisions

1. Use `#F8FAFA` as the reusable canvas instead of the current `#EEF3F3`.
2. Use `#002A31` as the primary/dark-surface anchor instead of `#0B2429`.
3. Retain white surfaces and the current mint, aqua, violet, and coral accents.
4. Add a separate bright-mint action role; never reuse it as semantic success
   text.
5. Retain the current 4px spacing rhythm and 12/20/24/28px radius hierarchy.
6. Retain Tailwind's existing breakpoints and the current 288px desktop sidebar.
7. Use 16px small-phone gutters, 20px standard-phone gutters, 24px tablet
   gutters, and 32px desktop gutters.
8. Keep Lucide as the implementation icon family with consistent stroke and
   container sizes.
9. Separate accessible semantic status text from brighter decorative accents.
10. Recommend Inter as the primary web font, pending approval.

## Typography recommendation

Recommended stack:

```text
Inter, -apple-system, BlinkMacSystemFont, Segoe UI,
Noto Sans Bengali, Noto Sans SC, Noto Sans, sans-serif
```

Why:

- It is closer to the compact SF-style proportions visible in the references.
- It provides consistent geometry across Apple and Windows browsers.
- It supports the dense financial and operational layouts better than Open Sans.
- It can be loaded through the existing `next/font` mechanism without adding a
  component framework.

The alternative is a platform-system stack. That is closest on Apple devices but
creates larger cross-platform differences and less stable visual regression.

The reproducible comparison is stored in `typography-review.html`, and its
rendered evidence is stored in `typography-comparison.png`. The render verified
that Open Sans, Inter, and Geist were all loaded before capture.

## Reference authority recommendation

Approve the following proposed primary/secondary relationships already recorded
in the Phase 1 manifest:

| Screen family | Proposed primary | Proposed secondary |
| --- | --- | --- |
| Dashboard | `dashboard-mobile-standalone` | `dashboard-mobile-compact` |
| Orders | `orders-mobile-standalone` | `orders-mobile-compact` |
| Wallet | `wallet-mobile-standalone` | `wallet-mobile-compact` |

The high-resolution standalone screens should control overall hierarchy and
spacing. Compact-board variants should supply secondary component anatomy and
states, not override the primary composition.

## Explicitly excluded

- Simulated iOS status bars, device shells, and home indicators
- Invented charts, progress percentages, amounts, dates, products, and counts
- Missing routes or unsupported actions inferred from references
- API, database, RLS, workflow, calculation, or status-machine changes
- Admin, staff, public-site, or paused native-app styling

## Approved decisions and adoption boundary

The owner approved these four decisions:

1. Standalone Dashboard/Orders/Wallet images are the primary compositions.
2. Inter replaces Open Sans for the scoped client/auth presentation.
3. The canvas and primary-action candidates become `#F8FAFA` and `#002A31`.
4. Bright mint remains an action/highlight role separate from semantic success.

Phase 3 maps the approved candidate only into the development-only component
gallery. Customer-facing client/auth routes retain their existing runtime tokens
until the later shared-component adoption phase. This preserves the ability to
review foundations independently of business pages.
