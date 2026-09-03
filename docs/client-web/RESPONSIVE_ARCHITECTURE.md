# Client Web Responsive Architecture

Status: Approved Phase 2 architecture

Effective date: 2026-09-02

Target: Existing authenticated Next.js client portal

Implementation state: Architecture only; responsive implementation has not started

## Purpose and authority

This document defines how the existing client portal adapts from 320px phones through desktop without creating separate mobile and desktop business implementations. Existing routes, React state, server APIs, Supabase authorization, RLS, data models, wallet ledger, order lifecycle, Product Statement, and Favorites/Repeat Order rules remain authoritative.

The current Tailwind configuration, CSS variables, safe-area utilities, shared client shell, and dialog primitives provide a sufficient foundation. Phase 2 requires no Tailwind, CSS, component, route, API, database, dependency, native, admin, or staff change.

Premium Dark Accent Commerce remains the visual authority. The native UX and Stitch screens provide interaction and hierarchy references only; proprietary branding, artwork, logos, and trade dress must not be copied.

## Core architecture principles

- Keep one route and one business implementation for each capability.
- Use mobile-first CSS and shared responsive components, not user-agent or device detection.
- Change presentation at breakpoints without changing authorization, calculations, ownership, or lifecycle behavior.
- Keep financial, freshness, eligibility, and status truth visible at every width.
- Prefer reflow before alternate presentation, and alternate presentation before hiding information.
- Treat 320px support, keyboard clearance, text zoom, and safe-area handling as normal requirements rather than exceptions.
- Do not create `/client/mobile/*`, `/client/desktop/*`, duplicate API calls, or forked mobile/desktop state.

## 1. Breakpoint strategy

Keep Tailwind's default mobile-first breakpoints unchanged:

| Tailwind tier | Minimum width | Architectural use |
| --- | ---: | --- |
| Base | 0px | Phone-first layout, including the required 320px minimum |
| `sm` | 640px | Tablet spacing, two-column supporting grids, and roomier controls |
| `md` | 768px | Tablet presentation changes such as SKU tables or larger panels |
| `lg` | 1024px | Fixed desktop sidebar and laptop workspace |
| `xl` | 1280px | Dense desktop layouts and intentional data tables |
| `2xl` | 1536px | Additional surrounding whitespace only; not a new business layout |

The existing breakpoints are sufficient. Do not add an `xs` breakpoint. Small-, standard-, and large-phone categories are validation targets inside the fluid base tier, not separate CSS modes. Use arbitrary width conditions only for an isolated, measured defect that cannot be solved by wrapping, flexible sizing, or content prioritization.

Do not branch rendered business behavior with `window.innerWidth`, user-agent checks, or duplicated server/client components. CSS controls visibility and arrangement; shared React state and handlers remain mounted at the appropriate common owner.

## 2. Target viewport categories

| Category | Width | Required validation focus |
| --- | ---: | --- |
| Small phone | 320-359px | One column, compact app bar, stacked money, two-column image grid, keyboard and fixed-bottom clearance |
| Standard phone | 360-389px | Dense SKU rows, five-item navigation, filters, errors, and long labels |
| Large phone | 390-639px | Useful whitespace, three-column image grid only when labels remain readable, bounded cards |
| Tablet | 640-1023px | Bottom navigation, two-column supporting content, modal/panel sizing, portrait and split-screen behavior |
| Laptop | 1024-1279px | Fixed 288px sidebar, reduced content width, compact desktop density |
| Desktop | 1280px and above | Full responsive workspace up to the existing 80rem content cap and intentional table layouts |

Landscape and split-screen behavior follow the available CSS width. They must remain operable but do not receive separate route or device-specific logic.

## 3. Page-layout strategy

Retain the shared `/client` layout and `ClientShell`. Every page renders into the same content shell and chooses one of three presentation widths:

- Reading content: existing `max-w-reading` (46rem) for help, explanations, and focused text.
- Focused forms: existing `max-w-form` (36rem) for URL entry, profile/security, and short forms.
- Workspace content: existing `max-w-commerce`/`content-shell` (80rem) for dashboards, products, orders, wallet, and Statement.

Base layout is one column. Supporting cards may become two columns at `sm`; operational grids use `lg` or `xl` only when their minimum readable content widths fit. Use `grid-template-columns: minmax(0, ...)`, `min-w-0`, flexible wrapping, and intrinsic sizing. Fixed widths are allowed only for bounded controls, images, sidebar/navigation, or intentionally scrollable data regions.

The main content must reserve space for whichever bottom surface owns the viewport. Page padding is a shell responsibility, not repeated route-local guesswork.

## 4. Navigation architecture

Use one shared navigation definition and route-state calculation for all responsive presentations.

### Phone and tablet: below `lg`

The fixed bottom navigation contains, in order:

1. Home - `/client`
2. Orders - `/client/orders`
3. New Order - `/client/order/new`, visually prominent in the center
4. Wallet - `/client/wallet`
5. Account - `/client/account`

Every item retains icon and text. Only the active destination receives selected semantics. New Order remains visually prominent when inactive but must not appear selected. The navigation is centered and width-bounded on tablets rather than stretched edge to edge.

This intentionally differs from the current bottom bar, which includes Product Statement as “Details” and places New Order second. The future change is presentation/navigation only: `/client/excel-details` remains available from Home and Account shortcuts and from the desktop sidebar. Notifications remain an app-bar destination rather than a primary tab.

### Laptop and desktop: `lg` and above

Preserve the fixed 18rem (`w-72`) left sidebar, current route availability, user identity, help, and sign-out placement. The desktop sidebar may retain Product Statement as a primary workspace link. Do not simplify desktop navigation merely to mirror the five-item phone bar.

### Tablet decision

Keep the bottom navigation through 1023px. Do not add a tablet-only rail. At 1024px, switch directly to the existing sidebar. This preserves the current shell boundary and avoids a third navigation implementation.

### Navigation and transactional surfaces

Only one bottom-fixed surface may own the viewport. When a transactional sheet or full-width sticky action is active, bottom navigation must be hidden or made inert and fully occluded. It must never stack beneath another action footer. Back/Escape closes the topmost sheet or modal before navigating away.

## 5. Header and app-bar behavior

The app bar is sticky and safe-area aware, with a 56px minimum content height plus `env(safe-area-inset-top)`.

- Phone root pages: compact BridgeCart mark, truncating contextual title, and Notifications. Account is in bottom navigation.
- Phone secondary/focused surfaces: Back, a wrapping or truncating title with a complete accessible name, and at most two relevant actions.
- Tablet: retain the same hierarchy with additional title/brand room; do not introduce desktop-only user controls.
- Laptop/desktop: preserve the current sidebar brand and show page title plus client identity/actions in the top bar.

At 320px, brand artwork/text must yield before the page title or required action. Icon-only controls keep accessible names and 44px targets. Unread counts may display `99+`, while the accessible label communicates the supported exact count.

## 6. Content width

- The workspace remains capped at 80rem inside the available area after the sidebar.
- Do not stretch forms, explanatory prose, steppers, or product cards to fill very wide screens.
- At `lg`, calculate usable width after the 18rem sidebar before enabling dense presentations. A viewport being “desktop” does not mean a wide table fits.
- At `2xl`, grow surrounding whitespace and balanced columns rather than font sizes or card line length.

## 7. Gutters and spacing

Preserve the current responsive gutter variables:

- Base/phone: 1rem (16px).
- `sm`/tablet: 1.5rem (24px).
- `lg` and above: 2rem (32px).

Use the existing four-point spacing rhythm. Default page section spacing is 24px on phones, 32px on tablets, and 40px on laptop/desktop unless the content has a tighter repeated-row relationship. Card padding is normally 16px on phones and 20-24px above `sm`.

## 8. Touch-target sizing

- All interactive targets are at least 44 by 44px, matching `min-h-touch`.
- Primary inputs and actions are at least 48px high, matching `min-h-touch-lg`.
- Adjacent destructive and confirm actions require clear separation and labels.
- Do not create density by shrinking controls, stepper buttons, checkboxes, navigation targets, or interactive table rows.
- Hover styles supplement, but never replace, focus, active, disabled, and selected states.

## 9. Bottom safe-area behavior

Use `env(safe-area-inset-bottom)` through the existing safe-area utility. Bottom navigation has a 64px minimum content area plus the safe-area inset. Sticky action footers use 12-16px content padding plus `max(1rem, env(safe-area-inset-bottom))`.

Main content padding must include the active bottom surface height and safe-area inset so the last control, pagination row, error, and focused field can scroll fully above it. Avoid route-local hard-coded offsets that assume a specific navigation and action combination.

## 10. Mobile browser keyboard behavior

- Use `100dvh`, not `100vh`, for viewport-bound sheets and drawers.
- Structure overlays as a fixed header, `min-height: 0` scrollable body, and in-flow sticky footer.
- Keep phone inputs at 16px to avoid automatic iOS zoom.
- Apply scroll padding/margins so focus, validation text, and action context remain above the keyboard and sticky footer.
- Preserve entered SKU quantities and form state through resize/orientation events.
- Do not infer mutation cancellation when an overlay closes or the viewport resizes.
- Use `VisualViewport` JavaScript only if iOS Safari/Android Chrome testing proves the CSS layout insufficient. Any such code must be shared presentation infrastructure, not page-specific business logic.

## 11. Modal versus bottom-sheet rules

Use a modal for short confirmation, discard, or irreversible-warning decisions with limited content and no long form. Keep it centered and width-bounded at every viewport.

Use a bottom sheet below `md` for long selection, filters, loaded-row details, estimate review, or other focused tasks that need a scrollable body and persistent action/summary. It may expand to nearly full height on small phones or at 200% text zoom.

At `md` and above, the same sheet content may become a right panel, bounded modal, or inline region according to surrounding page space. The content, state, validation, and handlers remain shared. At `xl`, product and SKU review may become the existing inline multi-column workspace.

Every dialog/sheet requires an accessible title, optional description, explicit Close, focus placement, focus return, Escape behavior, backdrop behavior, and a footer that does not cover the focused content.

## 12. Table versus card rules

Choose presentation based on readable information width, not simply whether a device is called desktop.

- SKU matrix: compact phone rows in a sheet below `md`; the current matrix/table may appear from `md`; the wider product workspace becomes inline at `xl`.
- Orders: keep one product-order card at every width. Render its SKU lines as compact rows/cards below `xl`; use the existing SKU table only at `xl` and contain any remaining horizontal scroll locally.
- Product Statement: render complete cards or expandable rows below `xl`; render the full table at `xl` inside an explicitly labelled, keyboard-focusable horizontal scroll region.
- Wallet, payments, ledger, notifications, account, and dashboard: reflow the current card/row presentation; do not introduce tables.

Cards must retain the decision-critical identity, status, pieces/quantity, cost state, total, rate or reservation context where applicable, and last-update/freshness information. Secondary notes and logistics details may expand behind a Details control, but the complete loaded record must remain available.

## 13. Sticky footer and action rules

- One primary action per focused surface.
- A page-level sticky action replaces bottom navigation while it owns a transactional step; it never floats above the navigation.
- A sheet action belongs inside the sheet's flex layout, not as an unrelated page-fixed element.
- At `lg`/`xl`, replace phone sticky footers with an inline or sticky side summary when space permits.
- Reserve content space equal to the footer and safe-area height.
- An in-flight order or financial action remains visibly pending; closing a surface does not claim cancellation or success.
- Ambiguous outcomes require server reconciliation before Retry, governed by existing idempotency behavior.

## 14. Typography scaling

Preserve the existing font stack: Geist, Inter, system UI, Segoe UI, Noto Sans Bengali, Noto Sans SC, Noto Sans, sans-serif.

| Role | Phone | Larger widths | Rule |
| --- | ---: | ---: | --- |
| Financial display | 28-32px | 32-36px | Use tabular numerals; wrap supporting label/code |
| Page title | 24px | 30px | Do not use decorative oversized headings in the client shell |
| Section title | 20px | 20-24px | Preserve hierarchy without consuming phone space |
| Card title | 17px | 18px | Allow two lines where needed |
| Body/input | 16px | 14-16px where density permits | Phone inputs remain 16px |
| Caption/metadata | 12px minimum | 12-14px | Never use for critical status or money truth |

Do not shrink important financial or status text to fit one line. Move the value below its label or let the group wrap.

## 15. Image behavior

- Reserve a bounded square aspect ratio before load to prevent layout shift.
- Use `object-contain` for supplier product/variant images unless an approved crop is explicitly safe.
- Provide a neutral placeholder, product/variant text, and meaningful alternative text when the image fails or is absent.
- Use two image-selector columns on small phones. Use three only when each cell and its complete label remain readable; add columns progressively on wider layouts.
- Images must not determine an unbounded card height or force horizontal overflow.
- A later implementation phase may adopt Next image optimization using the existing remote-pattern policy, but Phase 2 changes no image code or host contract.

## 16. Responsive chart behavior

- Metric summaries reflow from one column to two at `sm` and up to four only where values fit.
- Simple category charts remain text-labelled bars with flexible label, bar, and value columns.
- Do not use fixed chart widths, tiny legends, hover-only values, or a canvas without an accessible textual equivalent.
- Long category labels wrap or expose their complete value; quantity remains tabular and visible.
- Preserve the server-returned totals and categories. Responsive presentation must not recalculate or omit data.
- Horizontal scrolling is acceptable only for a genuinely two-dimensional/time-series chart, not the current summary bars.

## 17. Long English, Bangla, and Chinese text

- Retain `overflow-wrap: anywhere` for client headings, paragraphs, and data descriptions.
- Apply `min-w-0`, `whitespace-normal`, and vertical growth to every flexible text owner.
- Do not truncate critical provider attributes, SKU identity, status guidance, error messages, or financial notes. A list summary may use two lines only when the complete value is available in the same card's expanded detail and accessible name.
- Use line heights of at least 1.5 for body copy and allow Bangla glyphs additional vertical room.
- Avoid fixed-height text boxes. Chinese and unspaced identifiers may break safely without causing page overflow.

## 18. Currency overflow

- Keep currency attached to its value and use tabular numerals.
- Prefer the shared `PriceDisplay` and show explicit `CNY`/`BDT` codes where a symbol could be ambiguous.
- At narrow widths, stack label and amount or allow the amount/code group to wrap; never reduce essential money below the body-size floor.
- Preserve signs, decimal precision supplied by the current presentation contract, saved exchange-rate context, and Estimated/Actual/Partial labels.
- Color may reinforce direction or state but cannot be the only indication.

## 19. Skeleton layout rules

- Skeletons mirror the final geometry for the active breakpoint: cards on phones, rows/tables only where those presentations will render.
- Reserve image, title, metadata, status, amount, and action space to avoid layout shift.
- Financial skeletons use neutral blocks and never expose fake readable numbers.
- Repeated rows have bounded initial counts; skeletons must not simulate an unlimited list.
- Pulse is subtle and disabled by `prefers-reduced-motion` through the existing Skeleton behavior.
- Route-level and module-level loading states should preserve shell/navigation stability.

## 20. Error and empty states

- Keep the client shell, route title, and unaffected modules usable when one module fails.
- Errors use a clear heading, actionable explanation, and an appropriately sized retry/back action. Security or authorization failures do not reveal protected data.
- Empty states explain whether the client should start a New Order, clear filters, fund the wallet, or wait for activity.
- Filters and the last successfully loaded presentation remain visible when safe; stale financial/mutation surfaces are read-only and explicitly labelled.
- Error and empty content reflows within the same card/page rules and never requires horizontal scrolling.
- Dynamic errors receive focus or an appropriate live announcement without moving focus unnecessarily.

## 21. Horizontal-overflow policy

Page-level horizontal scrolling is prohibited from 320px upward. The global `overflow-x: clip` rule may remain during later work but must not be treated as proof that a component fits; viewport tests must inspect bounding boxes and scroll width.

Intentional horizontal scrolling is limited to dense data regions retained at approved widths. Such a region must:

- Contain overflow locally without expanding the page.
- Have an accessible label and keyboard-reachable scroll container.
- Show a visible edge/fade or concise “Scroll for more” cue when overflow exists.
- Keep row headers/identity understandable while scrolling where practical.
- Avoid nesting another horizontal scroller.
- Offer the complete card/row alternative below its approved table breakpoint.

## 22. Responsive component decision rules

Use the smallest applicable strategy:

1. **Simply reflow** when every field remains readable by stacking, wrapping, or changing grid columns. Applies to dashboard, wallet, notifications, account, filters, metric cards, and standard states.
2. **Use an alternate presentation inside the same component** when data order or density differs materially. Applies to app bar/navigation, product review, SKU selection, order SKU lines, and Statement rows.
3. **Switch table to cards/rows** when the table's minimum readable width exceeds the available content area. Preserve the same DTO and action handlers.
4. **Switch modal to bottom sheet** for long phone tasks; use the same content and state at every width.
5. **Progressively disclose secondary detail** only after identity, status, freshness, amount/currency, reservation/coverage, cost state, and required action remain visible.

Do not duplicate fetching, validation, mutation handlers, domain mapping, or authorization in responsive variants. If both presentations must exist in the DOM for CSS switching, ensure only the visible interactive tree is focusable and exposed to assistive technology; prefer one mapped data model feeding presentation-specific subcomponents.

## 23. Desktop preservation rules

- Preserve the current sidebar, workspace width, hover affordances, compact multi-column grids, and useful data density.
- Do not turn all desktop content into oversized phone cards.
- Keep tables where they improve comparison and fit their approved `xl` context; retain local horizontal scroll for exceptionally wide Statement data.
- Keep desktop page actions near their owning heading or summary rather than forcing bottom-fixed actions.
- Phone adaptations must not remove desktop-visible financial/status fields or change server requests.
- Test the 1024px laptop case separately because the fixed sidebar leaves substantially less content width than a full-width tablet.

## 24. Accessibility targets

Target WCAG 2.2 AA for the client web application:

- Full keyboard operation, logical focus order, visible focus, Escape behavior, and focus restoration.
- Meaningful landmarks, page titles, headings, form labels, validation associations, dialog names/descriptions, table headers, and current-page navigation semantics.
- 200% text zoom without loss of data, actions, or two-dimensional page scrolling.
- 44px targets and spacing that avoids accidental activation.
- Status, unread state, selection, errors, positive/negative amounts, and freshness communicated by text rather than color alone.
- Currency names/codes and quantity controls announced with sufficient product/SKU context.
- Reduced-motion compliance and no motion-dependent explanation.
- Images with useful alternatives or correctly hidden decorative treatment.
- Screen-reader order of title, status/freshness, content, summary, and action.

Required later browser verification includes keyboard-only use, VoiceOver or another Safari-compatible screen reader, TalkBack/Android Chrome, NVDA or equivalent desktop coverage, 200% zoom, reduced motion, and forced/high-contrast behavior where supported.

## Design-token approach

Reuse the current semantic color variables, commerce palette, font stack, radii, shadows, maximum widths, touch heights, safe-area spacing, motion durations, and z-index layers. Do not add duplicate mobile token sets or copy native style objects into Tailwind.

When responsive implementation begins, add a semantic CSS variable only after a repeated shell need is proven. Likely shared concepts are app-bar height, bottom-navigation height, active bottom-surface reserve, and compact/comfortable card spacing. Their values must derive from the architecture above and replace repeated route-local offsets rather than coexist with them.

Dark mode is outside the current roadmap. Light-first colors and actual contrast must be verified before any theme expansion.

## Recommended implementation sequence

Each step requires its own repository inspection, plan, approval, checks, status update, and stop boundary.

1. **Shared responsive foundation:** adapt the client shell/app bar, approved five-item phone/tablet navigation, bottom-surface ownership, dialog behavior, and viewport/accessibility test harness.
2. **New Order presentation:** adapt product context, image variants, SKU rows/sheet, quantity controls, summaries, and keyboard behavior without changing estimate or confirmation contracts.
3. **Orders presentation:** retain product-order cards, add compact responsive SKU rows, and address notification-safe navigation only through a separately approved functional/detail contract.
4. **Product Statement presentation:** add complete card/expandable layouts below `xl`, preserve the table at `xl`, and retain the authoritative DTO and exact 30-row server pagination.
5. **Mature and supporting surfaces:** refine Wallet, Dashboard, Notifications, Account, filters, query-state presentation, and reusable loading/error/empty behavior without changing backend truth.
6. **Cross-page hardening:** verify overflow, keyboard, safe areas, zoom, screen readers, remote images, chart semantics, performance, and all target viewport categories.

## Carried conflicts and blockers

Phase 2 records but does not resolve:

- The estimate-before-confirm specification versus the active browser-local display estimate and direct multi-SKU confirmation.
- The missing `/client/orders/[id]` detail route and notification links that currently target it.
- Session-refresh persistence requiring credentialed verification because middleware is pass-through.
- Favorites/Repeat Order contracts versus the absent list/repeat flow and the refresh route's likely RLS/grant incompatibility.
- Documented order list/detail APIs versus the current untyped, unpaginated order-card RPC.
- The malformed Product Statement example in `API_CONTRACT.md` versus the implemented Statement response.

Responsive work must not invent server data, enable unsupported actions, hide these gaps, or weaken authorization to work around them.

## Phase 2 boundary and verification

Phase 2 is complete when this architecture and the client-web implementation status are updated and pass documentation completeness, link, diff, and whitespace checks.

No responsive page or component implementation is authorized by this document alone. Browser behavior at 320px, 360px, 390px, 430px, tablet, laptop, desktop, 200% zoom, virtual keyboards, iOS Safari, Android Chrome, and assistive technologies remains unverified until a separately approved implementation phase.
