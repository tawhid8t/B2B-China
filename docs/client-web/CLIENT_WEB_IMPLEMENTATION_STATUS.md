# Client Web Implementation Status

Updated: 2026-09-02

Phase: 6 - responsive client business dashboard

ACTIVE TARGET: Existing Next.js client portal

NATIVE APP: Paused intentionally after Phase 6

## Phase checkpoints

### Phase 0

**COMPLETE - documentation and project-state transition only.**

Phase 0 froze native development at its Phase 6 checkpoint and made the existing Next.js client portal the active frontend target. It changed no application code, native code, APIs, database objects, Supabase configuration, business rules, authorization, or dependencies.

### Phase 1

**COMPLETE - fresh audit only.**

Phase 1 inspected the current authenticated client implementation and recorded its functional, backend, desktop, tablet, mobile, accessibility, performance, and verification state in [CLIENT_WEB_AUDIT.md](./CLIENT_WEB_AUDIT.md). It did not start responsive implementation.

### Phase 2

**COMPLETE - responsive architecture documentation only.**

Phase 2 defined the breakpoint, page-layout, navigation, app-bar, safe-area, keyboard, overlay, table/card, sticky-action, typography, image, chart, multilingual text, currency, skeleton, state, overflow, desktop-preservation, and accessibility rules in [RESPONSIVE_ARCHITECTURE.md](./RESPONSIVE_ARCHITECTURE.md).

The existing Tailwind breakpoints, design tokens, safe-area utilities, shared dialogs, and `lg` sidebar boundary are sufficient. Phase 2 changed no application foundation and started no responsive page implementation.

The approved future phone/tablet bottom navigation is Home, Orders, centered New Order, Wallet, and Account below 1024px. This differs from the current rendered bar, which still includes Product Statement as “Details” and places New Order second. The future change is presentation only: the existing Statement route remains available and no route, API, or business behavior is renamed or removed.

### Phase 3

**COMPLETE - shared client design-system foundation only.**

Phase 3 adapted Premium Dark Accent Commerce through a `.client-theme` scoped to the authenticated `ClientShell`. Public pages, shared authentication, admin, and staff keep the existing root theme. The implementation adds semantic action, state, and accent roles, client radii and shadows, and migrates active client presentation away from legacy brand-scale classes without changing component behavior or data flow.

The shared UI now exports a labelled, accessible `Select` and a bounded, failure-safe `ProductThumbnail`. Existing buttons, cards, fields, tabs, badges/status pills, alerts, dialogs/sheets, quantity controls, amounts, skeletons, loading, empty, and error primitives were preserved and adapted. Orders and Product Statement share product-thumbnail presentation, and current client filters share `Select` where applicable.

The implemented tokens, primitive usage, responsive composition rules, and accessibility targets are documented in [WEB_DESIGN_SYSTEM.md](./WEB_DESIGN_SYSTEM.md). Phase 3 does not add a toast dependency, React Native imports, routes, APIs, page-layout forks, or business abstractions.

### Phase 4

**COMPLETE - responsive client shell and navigation only.**

Phase 4 retained one authenticated client route tree and the existing `lg` desktop sidebar. Phone and tablet navigation now follows the approved order: Home, Orders, centered New Order, Wallet, and Account. Product Statement is available from a secondary mobile workspace menu and the desktop sidebar; Notifications remain a direct app-bar destination and Help is available from that menu.

The safe-area-aware app bar, bounded bottom navigation, and reserved content space prevent the shell from covering page content. The mobile workspace menu uses the existing native-dialog bottom sheet and creates a transient same-route history entry so browser Back closes it before leaving the current client route. It closes on route changes and before menu-driven navigation.

The shell receives a real, count-only unread notification value from the authenticated server/RLS context. It displays an accessible `99+` visual cap only when that read succeeds and is nonzero; a read failure leaves the notification entry usable without a badge. No polling, cache, mock state, public API, schema, or business behavior was added.

### Phase 5

**COMPLETE - responsive shared authentication UI only.**

Phase 5 refined the existing shared pre-role authentication experience for client, staff, and admin users without changing Supabase Auth, callbacks, profile/status checks, safe redirects, protected route handling, or role destinations. `AuthShell` now uses the Premium Dark Accent Commerce values through a dedicated `.auth-theme`, with a safe-area-aware `100dvh` mobile layout, bounded form presentation, touch-sized inputs/actions, and retained desktop benefits panel.

Login, client registration, password recovery, password update, forbidden, and continuation routes keep their existing Supabase calls and validation rules. Forms now consistently use accessible inline validation rather than browser-native popups; continuation has a loading presentation while the server resolves the verified session. Logout displays a busy state, prevents duplicate submission, and reports a recoverable failure without claiming success.

Session expiry/refresh persistence remains an unverified P0 runtime issue because middleware is still pass-through. Phase 5 makes no middleware, cookie-refresh, API, RLS, or authorization change.

**Phase 5 correction - screenshot-faithful login presentation.** Only `/auth/login` now uses the supplied Premium Dark Accent Commerce composition: the centered BridgeCart wordmark and tagline, welcome copy, icon-led labelled fields, dark full-width Sign in action, recovery link, support card, and a discreet registration link. This is a responsive, safe-area-aware `100dvh` form experience without fake device chrome; the same bounded hierarchy remains at tablet, laptop, and desktop widths. All Supabase, profile/status, safe redirect, and role-routing behavior remains unchanged. Registration, recovery, reset, forbidden, and continuation routes retain their existing layouts.

Open Sans is now loaded once through `next/font` at the root web layout and applies across public, authentication, client, admin, and staff surfaces. System, Bangla, and Chinese fallbacks remain available where Open Sans has no glyph.

### Phase 6

**COMPLETE - responsive client business dashboard only.**

The `/client` dashboard now uses server-derived, client-owned wallet, order, payment-proof, and notification reads. Its mobile-first hierarchy prioritizes authoritative available wallet balance, reservations, current rate, active order stages, real attention signals, recent orders, recent ledger entries, and recent recipient-scoped notifications. The supplied Premium Dark Accent Commerce dashboard reference informed the hierarchy and card composition only; no simulated device chrome, paid-versus-reserved period chart, fabricated shipment data, or unsupported estimate/QC data was added.

The server-only dashboard summary composes existing RLS-protected reads concurrently and adds no route, public API, schema, migration, dependency, cache, polling, or browser-owned financial truth. Dashboard links use only current client destinations; notification cards route to the inbox rather than the known-missing order-detail route. An explicit Refresh action uses `router.refresh()` and a route-local Suspense fallback provides a dashboard-shaped loading state.

The existing client order-card RPC remains unpaginated. The dashboard presents only the latest three returned product orders, but large-account first-load performance still requires credentialed production verification before treating the surface as production-verified.

**Phase 6 visual correction - mobile reference composition.** The phone dashboard now follows the supplied Premium Dark Accent Commerce hierarchy more closely: greeting first, an oversized wallet balance card with the bookmark, exchange-arrows, shield-check, and wallet icon language from the reference; an authoritative Available-versus-Reserved allocation ring; five real shipment stages; compact order-number/status/amount rows; attention rows; and a floating centered Plus control in shared phone navigation. Labels remain tied to actual wallet/order/payment/notification data; the period-paid chart and simulated iOS status/home bars remain intentionally excluded.

## Existing client-web baseline

The active target remains the current authenticated Next.js client portal, not a new application. Current source confirms:

- Server-side client-role protection, Supabase claim/profile checks, and server/RLS ownership boundaries are present; session refresh persistence still requires credentialed runtime verification.
- The shared client shell has a desktop sidebar, phone/tablet bottom navigation, sticky header, safe-area spacing, and account/notification entry points.
- Dashboard provides a protected, server-derived business overview; New Order provides supplier-link resolution, inline product presentation, variant/multi-SKU selection, a browser-local display estimate, and direct server confirmation.
- The persisted `EstimateReview` component exists but is unreachable from the active client flow. There is no authoritative persisted multi-SKU estimate review before direct confirmation.
- Orders are grouped into product-order cards with expanded SKU rows and a partial favorite action; dedicated order detail, cancellation/modification/refund, Favorites list, and compliant Repeat Order flows are absent.
- Wallet balance, funding instructions, payment-proof submission/history, ledger filters/paging/export, and eligible pending-proof cancellation form the most complete and responsive client surface.
- Notifications have recipient-scoped paging/read state, but order links target the absent `/client/orders/:id` route.
- Product Statement provides server-owned filters, totals, chart metadata, fixed paging, and complete row data, but presents it in a fixed 1550px-wide table after a client-side fetch.
- Account is read-only. Profile editing, client Settings, an in-app help workflow, web query/offline caching, virtualization, and browser E2E/accessibility/viewport suites are absent.

## Audit outcome

The strongest areas are wallet/payment/ledger behavior, server role/ownership enforcement, shared UI foundations, and the core product resolver/multi-SKU mechanics. The largest responsive gaps are the 34rem SKU matrix, 820px order SKU table, 1550px Product Statement table, and unverified 320px shell/dialog behavior.

Phase 1 identifies these P0 blockers for later, separately approved work:

1. No authoritative persisted multi-SKU estimate/review before confirmation; the visible estimate is browser-local.
2. Notifications link to an order-detail route that does not exist.
3. Session refresh persistence is unverified because middleware is pass-through despite server-client comments relying on middleware refresh.
4. Favorite refresh appears incompatible with current revoked table reads/RLS and blocks the specified Favorites/Repeat foundation if retained in scope.

The audit also records, without resolving, conflicts between the estimate-before-confirm specification and direct-confirm implementation, documented order routes and the current order-card RPC, the malformed Product Statement example, and the Favorites/Repeat contracts versus partial implementation.

## Active boundaries

- Phase 6 is the first client business-page-responsive implementation phase. Earlier Phases 3 through 5 provide shared visual, shell, and authentication foundations.
- No subsequent phase is authorized automatically.
- No separate desktop/mobile business implementation is authorized.
- Native, admin, staff, public-site, backend, database, API, security-policy, and business-rule work is outside the client-web roadmap unless a later approved phase demonstrates a required shared compatibility change.
- Supabase/Postgres and server APIs remain authoritative; browser state and caching are presentation/performance concerns only.
- Existing financial history, wallet ledger behavior, order lifecycle, Product Statement, Favorites/Repeat Order rules, and authorization boundaries must be preserved.

## Next-step rule

Stop after Phase 6. New Order, Orders, Product Statement, Wallet, notifications, and account page-responsive implementation each require a new, repository-based plan and explicit approval.

See [CLIENT_WEB_TRANSITION.md](./CLIENT_WEB_TRANSITION.md) for the native checkpoint, reusable design direction, carried contract gaps, scope boundaries, and native-resume strategy.
