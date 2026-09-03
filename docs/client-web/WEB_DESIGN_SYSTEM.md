# Client Web Design System

Status: Implemented Phase 3 foundation

Effective date: 2026-09-02

Scope: Existing authenticated Next.js client portal only

## Purpose and authority

This document adapts the paused native application's Premium Dark Accent Commerce direction to the web client without importing React Native code or changing business behavior. The executable native token file informed the palette; the implementation in `tailwind.config.ts`, `app/globals.css`, and the shared web primitives is authoritative for the client portal.

The design system is scoped by `.client-theme` on `ClientShell`. The shared pre-role `AuthShell` uses the same values through `.auth-theme`, because a user's role is not known until after sign-in; this is shared visual presentation only and does not alter authorization or role routing. Public pages, admin, and staff application shells remain on the root theme documented in [FRONTEND_DESIGN_SYSTEM.md](../FRONTEND_DESIGN_SYSTEM.md). The root values and legacy named scales remain available for those surfaces. New authenticated client and auth presentation uses semantic roles rather than legacy commerce, vermilion, or gold classes.

This foundation changes presentation only. APIs, Supabase authorization and RLS, calculations, status values, wallet history, order lifecycle, Product Statement data, and Favorites/Repeat Order rules remain authoritative and unchanged.

## Color roles

Use semantic roles so components work under the root and client scopes.

| Role | Client value | Use |
| --- | --- | --- |
| `canvas` | `#EEF3F3` | Client page background |
| `surface` | `#FFFFFF` | Cards, fields, navigation, and overlays |
| `surface-muted` | `#F7FAFA` | Quiet panels, placeholders, and secondary areas |
| `foreground` | `#07171B` | Primary text and icons |
| `muted` | `#52636A` | Secondary text and metadata |
| `border` | `#D9E1E2` | Dividers and control boundaries |
| `action-primary` | `#0B2429` | Primary actions and strong inverse surfaces |
| `action-hover` | `#10333A` | Primary hover state |
| `action-active` | `#07171B` | Primary pressed state |
| `on-action` | `#FFFFFF` | Text and icons on strong action surfaces |
| `success` | `#168F73` | Confirmed and successful state |
| `warning` | `#E9A23B` | Attention without failure |
| `danger` | `#C84D56` | Error communication and status accents |
| `danger-action` | `#9A303B` | Accessible destructive buttons |
| `accent-mint` | `#55D6BE` | Restrained positive/highlight accent |
| `accent-aqua` | `#45C4DD` | Informational/data accent |
| `accent-violet` | `#7C6CFF` | Limited category/data differentiation |
| `accent-coral` | `#F27868` | Limited warm emphasis |

Accents support hierarchy; they do not replace status truth. Destructive actions use `danger-action` with inverse text. Errors and destructive status messaging use `danger`. Never communicate a state by color alone.

## Typography and numeric content

Use Open Sans, self-hosted through `next/font`, as the web-wide primary sans-serif. The stack retains system, Bangla, and Chinese fallbacks when Open Sans does not provide a glyph. Native platform font names are not copied into web CSS.

- Display: 32px where space supports it; page title: 24px; body: 16px; label: 14px; caption: 12px.
- Phone form controls and body text remain at least 16px to avoid mobile-browser input zoom.
- Use semibold or bold for hierarchy instead of decorative typefaces.
- Use `tabular-nums` for currency, quantity, rates, balances, and operational totals.
- Permit English, Bangla, Chinese attributes, and financial values to wrap. Do not truncate authoritative status, totals, rates, reservations, or cost state.

`PriceDisplay` is the shared financial presentation primitive. It formats display values only and must not calculate, approve, reserve, or mutate money.

## Spacing, shape, and elevation

Continue the 4px spacing rhythm: 4, 8, 12, 16, 20, 24, 32, 40, and 48px. Responsive page gutters are 16px at base, 24px at `sm`, and 32px at `lg`, as defined by [RESPONSIVE_ARCHITECTURE.md](./RESPONSIVE_ARCHITECTURE.md).

| Token | Client value | Use |
| --- | ---: | --- |
| `rounded-control` | 12px | Inputs, buttons, tabs, small controls |
| `rounded-card` | 20px | Cards and product thumbnails |
| `rounded-panel` | 24px | Desktop dialogs and prominent panels |
| `rounded-sheet` | 28px | Mobile sheet top corners |

Borders provide the normal surface boundary. Shadows are low-opacity derivatives of `#07171B`: soft for controls/cards, panel for dialogs, and overlay for elevated sheets. Do not stack heavy borders and shadows merely for decoration.

## Shared primitives

### Actions and fields

- `Button` retains primary, secondary, outline, ghost, and danger variants. Use one clear primary action per decision area; destructive actions require unambiguous labels and confirmation where the consequence warrants it.
- `Input`, `Textarea`, and `Select` share label, required marker, hint, error, generated/provided ID, `aria-describedby`, and invalid-state behavior.
- `Select` is for native single-choice controls. Rich SKU choice, search, or multi-selection remains an application-level selector and should use the responsive overlay rules below.
- Controls have a 44px minimum target; primary and form controls normally use 48px.
- `Tabs` are for peer views, not a replacement for route navigation. Selected state must remain discernible without color alone.

### Status and feedback

- `Badge` supplies semantic visual variants; `StatusBadge` remains the domain-status adapter and preserves existing labels.
- `Alert` is the current inline feedback model. Errors use an alert/live-region contract where appropriate. Phase 3 adds no toast dependency or global provider.
- `LoadingState`, `Skeleton`, `EmptyState`, and `ErrorState` use semantic tokens. Skeleton geometry should match the content it replaces and respect reduced motion.

### Product and quantity presentation

- `ProductThumbnail` reserves a bounded square at 64, 80, or 96px, requires alternative text, lazy-loads dynamic supplier images, and falls back internally for missing or failed images. Supplier hosts remain dynamic, so this localized primitive intentionally uses native `<img>` rather than expanding global image-host trust.
- `QuantityStepper` is the shared compact quantity control. It preserves minimum, maximum, step, and disabled behavior supplied by its caller; it does not own inventory or pricing truth.
- The New Order interactive gallery remains local because it has unique selection and preview behavior. Repeated passive product images in Orders and Product Statement use `ProductThumbnail`.
- SKU selectors may compose existing fields, quantity controls, product thumbnails, badges, and responsive overlays. Do not move SKU calculation or confirmation logic into visual primitives.

### Cards, dialogs, and sheets

- `Card` is the normal content grouping. Avoid nested cards when a divider or quiet surface is sufficient.
- `Modal` remains appropriate for short confirmations and bounded tasks.
- `Drawer`/`BottomSheet` handles long phone selection, filter, or detail tasks below `md`; the same feature may render as a modal, panel, or inline content at larger widths.
- Only one bottom-fixed surface may own the phone viewport at a time. A transactional action or open sheet must account for bottom navigation and `env(safe-area-inset-bottom)` according to the responsive architecture.

## Client compositions

Order cards remain domain components composed from `Card`, `ProductThumbnail`, `StatusBadge`, `PriceDisplay`, and compact SKU content. The card must keep product identity, order/status truth, quantities, and totals available at every width. Phase 3 only restyles the existing composition; table-to-row responsive adaptation belongs to a later approved phase.

Wallet summary and transaction rows use strong action surfaces sparingly, tabular currency, explicit transaction direction/status, and semantic state accents. Balance, reserved/available distinctions, ledger order, payment-proof behavior, and export behavior remain server/API controlled.

Product Statement rows use the same product image and state primitives, but their DTO, totals, chart data, and pagination remain unchanged. The card/table responsive presentation defined by Phase 2 has not been implemented in Phase 3.

## Responsive composition rules

- Share routes, handlers, state, and business components. Reflow first; use an alternate presentation only when density requires it.
- Use cards/compact rows below the architecture's table breakpoint and contain any intentional data-region scrolling. Never hide page overflow with a global clipping rule.
- Preserve the current desktop information and interaction behavior while adapting presentation in later phases.
- Images stay square, bounded, and `object-contain` unless the source is known to be a crop-safe editorial asset.
- Charts must retain textual labels and values; graphics are supporting presentation, not the only data representation.
- Important status, freshness, currency, rates, reservations, cost state, and totals never move behind optional disclosure.

## Accessibility requirements

- Meet WCAG 2.2 AA as the implementation target, including contrast, visible focus, keyboard operation, semantic labels, error association, and 200% zoom/reflow.
- Maintain 44px minimum pointer targets and avoid hover-only disclosure.
- Dialogs and sheets retain native dialog focus/escape behavior supplied by the existing primitives.
- Meaningful images require meaningful alternative text; unavailable imagery still exposes a labelled fallback.
- Live loading, error, and completion feedback must be announced without stealing focus unnecessarily.
- Motion must respect `prefers-reduced-motion`.

Authenticated browser checks at 320px through desktop, 200% zoom, virtual keyboards, iOS Safari, Android Chrome, and assistive technologies remain required in a later approved browser-validation phase.

## Adoption and boundaries

Phase 3 applies `.client-theme` only to the authenticated `ClientShell`, migrates active client presentation to semantic roles, adds `Select` and `ProductThumbnail`, and adopts those primitives at duplicated filter/image sites. Existing component props and business flows are preserved.

Phase 3 does not implement the Phase 2 navigation target, mobile table/card conversions, responsive page redesigns, estimate persistence, order details, notification destination repair, session refresh, or Favorites/Repeat Order completion. Google Stitch and supplied product references remain composition and interaction guidance only; no generated platform structure, proprietary branding, or native component code is copied.

Shared authentication uses the same mobile-first principles: a safe-area-aware `100dvh` shell, bounded form width, 16px phone inputs, 44px password controls, 48px primary actions, inline validation/feedback, and a session-restoration loading surface. It remains shared before role determination; post-login role routing and every protected workspace keep their existing authorization boundary.

`/auth/login` is the intentional exception to the generic `AuthShell` composition. It uses the supplied Premium Dark Accent Commerce reference hierarchy: a centered BridgeCart wordmark/tagline, welcome copy, labelled email and password fields with leading mail/lock adornments, a full-width dark primary action, a centered recovery link, and a bordered support card. It is mobile-first without simulated device chrome and keeps the same restrained, centered form column at tablet, laptop, and desktop widths. Registration remains a discreet link below the support card because it is an existing supported product flow. Other authentication routes retain `AuthShell`.
