# Frontend UX Blueprint

Task: `FRONTEND-F0`  
Audit date: 2026-08-26  
Scope: mobile-first public and client UX architecture only

## 0. Safety boundary

This blueprint does not authorize changes to the database schema, migrations, RLS, authentication architecture, business rules, estimate calculations, product-provider integration, API contracts, or financial behavior. The frontend must reuse the working Phase 6B behavior and the documented `{ data, meta }` / `{ error }` envelopes.

The first implementation slice covered by this blueprint is deliberately narrow:

1. public information and onboarding;
2. existing authentication journeys;
3. an authenticated, single-product ordering flow using the existing product and estimate endpoints;
4. an honest client dashboard with no invented order, group, wallet, or history data.

Client groups, wallet, payments, order history, reports, notifications, and later operational modules may be represented in the information architecture, but must not appear functional until their backend phase and read APIs are available.

## 1. Audit baseline

### 1.1 Current routes

| Area | Current route | Current behavior |
| --- | --- | --- |
| Public | `/` | Redirects directly to `/catalog`; there is no landing page. |
| Public | `/catalog` | Mixed landing page, public product preview, and hardcoded product directory. |
| Auth | `/auth/login` | Working Supabase password sign-in. |
| Auth | `/auth/register` | Working Supabase client registration and email confirmation request. |
| Auth | `/auth/forgot-password` | Working Supabase password-reset request. |
| Auth | `/auth/update-password` | Working Supabase password update. |
| Auth | `/auth/callback` | Exchanges the Supabase auth code and redirects. |
| Auth | `/auth/continue` | Routes an authenticated user by verified role. |
| Auth | `/auth/forbidden` | Generic access-denied page. |
| Client | `/client` | Hardcoded product, SKU, estimate, and wallet presentation; buttons do not call business APIs. |
| Admin | `/admin` | Hardcoded admin cards and order queue. |
| Admin | `/admin/overview` | Hardcoded metrics, pipeline, and recent orders. |
| Staff | `/staff` | Role-based redirect. |
| Staff | `/staff/receiving` | Presentation-only receiving form; no API use. |
| Staff | `/staff/packing` | Presentation-only carton form; no API use. |
| Extension | `/extension` | Static explanatory page. |

`/admin/system` has a protected layout but no page.

### 1.2 Current frontend API/data use

The browser currently consumes:

- Supabase Auth for sign-in, registration, password reset/update, session lookup, and sign-out;
- `POST /api/products/preview-link` from `/catalog` for unauthenticated, non-persisting product preview.

The browser does **not** currently consume these implemented ordering endpoints:

- `POST /api/products/resolve-link`;
- `POST /api/estimates`;
- `POST /api/estimates/:id/accept`;
- `POST /api/estimates/:id/reject`.

The frontend also contains production-visible mock data:

- eight hardcoded catalog products in `app/catalog/page.tsx`;
- hardcoded client SKU choices, quantity defaults, rates, weights, and an independent estimate formula in `app/client/page.tsx`;
- hardcoded metrics, orders, clients, groups, wallet totals, and parcel/carton counts in `lib/mock-data.ts`;
- presentation-only admin, receiving, packing, and extension actions.

This data must not be preserved in a production path. The client must display server-returned product and estimate values only.

### 1.3 Current responsive behavior

The code uses Tailwind's default `sm`, `md`, `lg`, and `xl` breakpoints, but there is no documented mobile system.

- Public content generally stacks at base width and becomes multi-column at `sm`, `md`, or `lg`.
- The dashboard sidebar appears only at `lg`; below `lg` it disappears without a mobile replacement.
- The shared shell has no mobile bottom navigation, menu, active-route state, or role-specific navigation.
- Product selection uses desktop-style inline controls; there is no mobile SKU sheet or sticky action.
- Estimate content is always visible beside/under the form and is calculated locally from hardcoded values.
- Tables rely on horizontal scrolling rather than switching to a mobile record pattern.
- No intentional safe-area spacing exists for sticky mobile actions.
- Loading treatment is isolated to a few button labels; there is no consistent skeleton, retry, empty-state, or offline pattern.

### 1.4 Problems to solve

1. The public site does not explain the service, policies, fees, product rules, restrictions, or contact path required by the specification.
2. `/catalog` implies a browsable product catalog backed by real inventory, but the products are mock records.
3. The authenticated client screen duplicates protected estimate logic in the browser and presents the result as real.
4. Product resolution, SKU selection, estimate creation, review, acceptance, and rejection are not connected into one journey.
5. The shell mixes client, admin, staff, and extension destinations. Several visible links lead the signed-in role to a forbidden page.
6. Mobile users lose all dashboard navigation because the desktop sidebar is simply hidden.
7. There is no distinction between available-now modules and future modules.
8. Raw status identifiers are exposed as underscored English strings and the status component covers only part of the canonical lifecycle.
9. Authentication pages work but lack a shared auth shell, consistent pending behavior, password visibility/help, and a clear path back to public information.
10. Mojibake is visible in currency symbols, Chinese titles, Bengali text, and ellipses in the current source/output.
11. The visual system is a thin set of colors and cards, not a reusable mobile interaction system.
12. Accessibility behavior is inconsistent: many controls lack shared focus, error association, pending announcements, disabled explanations, and minimum touch-target rules.

## 2. Client information architecture

The client portal is task-led, not an operations dashboard copied from staff/admin screens.

### Primary level

1. **Dashboard** — welcome, start-order action, and truthful module availability.
2. **New order** — paste link through estimate acceptance/rejection.
3. **Orders** — future list/detail module; do not activate before the documented read APIs exist.
4. **Groups** — future grouping module; navigation placeholder only when useful.
5. **Wallet and payments** — future financial module; navigation placeholder only, with no balance.
6. **Account and help** — authenticated identity, sign out, public policy/help links; profile editing waits for its data contract.

### Dashboard content priority

At the current backend stage, `/client` should contain only:

- a prominent “Paste supplier link” action;
- the three supported source labels: 1688, Taobao, and Tmall;
- a short ordering-step explanation;
- links to shipping fees, product rules, restricted products, and help;
- honest module-availability cards for orders/groups/wallet if placeholders are shown.

It must not show invented balances, order counts, recent orders, group totals, or progress data.

## 3. Public information architecture

### Home

The public home page answers, in this order:

1. what the service does: source products from supported China marketplaces for Bangladesh buyers;
2. the primary action: create an account or sign in to paste a supplier link;
3. the basic process from link to estimate and later fulfillment;
4. what an estimate contains and why final cost can change;
5. supported marketplaces;
6. shipping/product restrictions and trust information;
7. contact/WhatsApp action using a real configured destination only.

### Supporting public pages

- **Services:** sourcing, estimation, assisted purchasing, and fulfillment descriptions, clearly distinguishing current availability from later operations.
- **How it works:** client journey and responsibilities at each handoff.
- **Shipping policy:** process, estimates versus actual costs, and operational caveats from approved business content.
- **Shipping fees:** explanation of calculation inputs, never a frontend calculator that recreates protected estimate logic.
- **Product rules:** link sources, images, availability, variants, and manual-review conditions.
- **Restricted products:** approved restricted/banned-product content.
- **Contact:** real contact methods only; no fake form submission.

The public site should not include a mock product marketplace. Public link preview may remain as a secondary tool only if it is clearly labeled “Preview supplier link,” uses the existing read-only preview API, and never implies that a preview is an estimate or saved order.

## 4. Navigation

### 4.1 Mobile public navigation

- Compact top bar: brand/home, sign in, and menu button.
- Menu opens a full-height or large bottom sheet with Services, How it works, Shipping fees, Product rules, Restricted products, and Contact.
- “Create account” is the primary sheet action.
- Keep the header height stable while scrolling; do not crowd every public link into the top bar.

### 4.2 Mobile client navigation

Use a fixed bottom bar with safe-area padding once at least three destinations are live:

1. Dashboard;
2. New order, visually primary;
3. Orders;
4. Groups;
5. More, containing Wallet/Payments, Account, Help, and Sign out.

Before Orders and Groups are backed by working read APIs, ship a reduced bar with Dashboard, New order, and More. Future items may be listed inside More as unavailable with a short “Coming in a later phase” label; they must not lead to mock pages.

The new-order flow hides the standard bottom bar while a sticky selection or estimate action is present, preventing stacked fixed controls.

### 4.3 Desktop public navigation

- Persistent header with Home/brand, Services, How it works, Shipping, Product rules, Contact, Sign in, and Create account.
- Group Shipping policy and Shipping fees under one small menu if space is limited.
- Footer repeats policy/help links and real contact details.

### 4.4 Desktop client navigation

- Role-specific left sidebar at `lg` and above.
- Dashboard and New order are active now.
- Orders, Groups, Wallet/Payments, and History become active only when their APIs are implemented.
- Account/help and sign out sit separately at the bottom.
- The shell never renders admin, staff, or extension links for a client.
- Active route, focus state, collapsed state, and unavailable-module state are explicit.

## 5. Client dashboard page map

| Module | Route | Activation | Page purpose |
| --- | --- | --- | --- |
| Dashboard | `/client` | Now | Entry point, new-order CTA, process/help, honest availability. |
| New order | `/client/order/new` | Now | Complete single-product product-to-estimate flow. |
| Orders | `/client/orders` | Future | Client-owned order list when `GET /api/orders` is implemented. |
| Order detail | `/client/orders/[orderItemId]` | Future | Order snapshot, status, estimate/actual cost when `GET /api/orders/:id` is implemented. |
| Groups | `/client/groups` | Future | Group list/filter when `GET /api/order-groups` is implemented. |
| Group detail | `/client/groups/[groupId]` | Future | Group products and totals when its read API is implemented. |
| Wallet | `/client/wallet` | Phase 7+ | Balance and ledger only when the wallet read contract is implemented and verified. |
| Payments | `/client/payments` | Phase 7+ | Proof/history only when payment upload and read flows are available. |
| History/statement | `/client/history` | Future | Historical statement/report, no fabricated records. |
| Account/help | `/client/account` | Partial/future | Session identity, sign out, and help now; editable profile later. |

Future routes are route reservations, not instructions to build placeholder pages during F0.

## 6. Product-order flow

The entire currently supported journey lives at `/client/order/new` so the frontend can use the response from each write endpoint without pretending that missing read endpoints exist.

### Step 1: Supplier link

1. Show a single URL field with supported-marketplace examples and paste affordance.
2. Submit to `POST /api/products/resolve-link` after authentication.
3. Disable repeat submission while pending.
4. Use the returned persisted `productId`, `skuId` values, images, prices, category, availability, and domestic delivery cost as the only source of displayed product data.
5. Handle `VALIDATION_ERROR`, `PROVIDER_LOOKUP_FAILED`, and `MANUAL_REVIEW_REQUIRED` distinctly.
6. A manual-review response is an honest stop state with help/contact guidance; do not create a fake manual product workflow for clients.

### Step 2: Product and selection

1. Display the resolved snapshot.
2. Select exactly one returned SKU because the protected estimate contract accepts one `skuId` per estimate.
3. Choose one positive integer quantity, limited by returned availability when availability is present.
4. Display the selected SKU's server-returned CNY price and seller domestic delivery value.
5. Do not calculate or imply a BDT total before the estimate API responds.

### Step 3: Request estimate

Submit `POST /api/estimates` using the returned `productId`, selected `skuId`, quantity, authenticated client identifier, and optional note. Do not submit client-derived price, exchange rate, shipping rate, or profit values.

If the API returns `MANUAL_REVIEW_REQUIRED`, explain that an estimate cannot be calculated automatically. If it returns `NOT_FOUND`, keep the supplier URL visible and offer to restart resolution.

### Step 4: Review estimate

Render only the returned breakdown, status, and `validUntil`. Keep product selection beside the estimate for verification. State that the total is an estimate and actual weight/cost may change under the approved business rules.

### Step 5: Accept or reject

- Accept with `POST /api/estimates/:id/accept` and the authenticated client identifier.
- Surface any `meta.warnings`, including an insufficient-wallet warning, without inventing a wallet balance page.
- Treat the returned order/group identifiers and status as confirmation, not as permission to fabricate order/group details.
- Reject with `POST /api/estimates/:id/reject`; collect the required non-empty reason before submission.
- On `EXPIRED_ESTIMATE`, retain the current product selection in memory and offer “Request a new estimate,” which calls `POST /api/estimates` again.
- Prevent double accept/reject submission and clearly handle `CONFLICT`.

### Flow state model

`idle -> resolving -> product_ready -> estimating -> estimate_ready -> accepting | rejecting -> accepted | rejected`

Every pending state has one in-flight action. Errors return to the last safe state without erasing the pasted URL or chosen SKU/quantity.

## 7. Product-detail information hierarchy

### Mobile

1. Compact flow header with back/close and step label.
2. Swipeable product gallery with image count and SKU-image update when supplied.
3. Product title, optional Chinese title, provider/source badge, and external supplier-link affordance.
4. Supplier CNY price/range and China domestic-delivery amount.
5. Category and availability information.
6. Estimate disclaimer: supplier price is not the final BDT estimate.
7. Sticky bottom action, initially “Choose variant.”
8. SKU-selection bottom sheet containing attribute groups/options, selected combination, returned SKU price/availability, quantity stepper, optional client note, and “Request estimate.”

The sheet must support long labels, missing SKU images, out-of-stock/unavailable options, keyboard focus containment, escape/back dismissal, and a scrollable body with a fixed action area.

### Desktop

- Left: gallery and thumbnails.
- Center: title, source, pricing context, delivery/category information, and disclaimer.
- Right: sticky purchase-summary panel with SKU options, quantity, selected price, note, and request-estimate action.
- Estimate review may replace the right summary panel while product context remains visible.

This structure borrows only marketplace interaction principles. It must use this product's own design tokens, language, components, and content.

## 8. Estimate review flow

### Information order

1. Estimated total in BDT.
2. “Estimate, not final cost” notice and validity/expiry time.
3. Product thumbnail, title, selected SKU, and quantity.
4. Supplier-side CNY values: unit price, subtotal, and domestic delivery.
5. Conversion and logistics values: rate used, product subtotal BDT, estimated total weight, category shipping, and China-to-Guangzhou cost.
6. Profit and final estimated total.
7. Accept and reject actions.

Use semantic `dl` rows and server-returned precision. Currency formatting must be centralized and must not convert or recompute totals in the view.

### Mobile actions

- Sticky bottom action area with primary “Accept estimate” and secondary “Reject.”
- Reject opens a confirmation sheet with required reason.
- Acceptance requires a concise acknowledgement of expiry/estimate caveat, but no extra business consent not present in the rules.
- Success shows the returned order status and references. It does not display invented order history, balance, or fulfillment events.

## 9. Loading, error, and empty states

### Global rules

- Preserve layout dimensions during load.
- Announce pending/success/error changes through appropriate live regions.
- Error messages say what failed, what was preserved, and what the user can do next.
- Never silently substitute mock data after an API failure.
- Never turn authorization errors into empty states.

### Required states

| Context | Loading | Error/recovery | Empty |
| --- | --- | --- | --- |
| Public content | Stable text/image skeleton only where content is remote. | Inline retry for remote preview; static content remains usable. | Not applicable. |
| Product link | Button progress plus resolved-card skeleton. | Invalid URL: correct field; provider failure: retry; manual review: contact/help stop state; unauthorized: sign in. | Initial URL guidance and supported sources. |
| Product gallery | Reserved aspect-ratio skeleton. | Neutral fallback image with accessible text. | “Supplier returned no images”; product data remains usable. |
| SKU selection | Option skeleton after product shell. | Incomplete SKU data: stop estimate action and explain manual review. | “No purchasable variants returned.” |
| Estimate | Breakdown skeleton with action area disabled. | Field-level validation, manual-review guidance, retry, expired, conflict, and generic server error states. | No estimate card before submission; show a short explanation instead. |
| Future orders/groups/wallet | No loading state until activated. | No fake failure states. | Availability message only, without zero balances/counts. |

Offline/network loss should preserve the supplier URL and in-memory selection, then offer retry. It must not claim a request succeeded until a successful server response is received.

## 10. Component hierarchy

```text
RootLayout
|-- PublicShell
|   |-- PublicHeader
|   |-- PublicMobileMenu
|   |-- PublicFooter
|   `-- PublicPage
|-- AuthShell
|   `-- AuthFormCard
`-- ClientLayout (existing role guard retained)
    `-- ClientShell
        |-- ClientDesktopSidebar
        |-- ClientMobileHeader
        |-- ClientMobileBottomNav
        |-- ClientPageHeader
        `-- route content
            |-- ClientDashboard
            |   |-- NewOrderCard
            |   |-- ProcessGuide
            |   `-- ModuleAvailability
            `-- OrderBuilder
                |-- OrderProgress
                |-- ProductLinkForm
                |-- ProductResolutionState
                |-- ProductDetail
                |   |-- ProductGallery
                |   |-- ProductSummary
                |   |-- MobileSkuSheet
                |   `-- DesktopSelectionPanel
                |       |-- VariantSelector
                |       |-- QuantityStepper
                |       `-- SelectionSummary
                |-- EstimateReview
                |   |-- EstimateTotal
                |   |-- EstimateValidity
                |   |-- CostBreakdown
                |   |-- EstimateDisclaimer
                |   `-- EstimateActions
                `-- OrderOutcome
```

Shared primitives:

- `Button`, `IconButton`, `LinkButton`;
- `TextField`, `NumberStepper`, `FormError`;
- `Card`, `Sheet`, `Dialog`, `Disclosure`;
- `Alert`, `Skeleton`, `EmptyState`, `ErrorState`;
- `Money`, `DateTime`, `StatusBadge`, `SourceBadge`;
- `StickyActionBar`, `PageContainer`, `SectionHeading`.

Prefer React, Tailwind, and the existing Lucide dependency. A new component library is not required for this architecture.

## 11. Responsive breakpoint strategy

Use Tailwind defaults with mobile-first base rules:

| Range | Intent |
| --- | --- |
| Base `<640px` | Primary design target: one-column pages, bottom navigation, full-width controls, bottom sheets, sticky actions, 16px minimum page gutters. |
| `sm` `>=640px` | Larger phones/small tablets: wider sheets, paired low-risk fields, 20–24px gutters. Do not force desktop navigation. |
| `md` `>=768px` | Tablets: optional two-column content, inline secondary actions, larger gallery; touch behavior remains valid. |
| `lg` `>=1024px` | Desktop shell begins: sidebar, product detail columns, sticky selection summary, no bottom navigation. |
| `xl` `>=1280px` | Content-width refinement only; do not add essential information unavailable at smaller widths. |

Additional rules:

- Use `min-height: 44px` for interactive targets and adequate separation between destructive/confirming actions.
- Respect `env(safe-area-inset-bottom)` for fixed mobile actions.
- Constrain reading content to approximately 65–75 characters and application content to a consistent max width.
- Avoid horizontal page scrolling. Convert data records to cards/rows on mobile; use tables only where comparison materially benefits desktop users.
- Support zoom and text wrapping; never lock viewport scale.
- Respect reduced-motion preferences.

## 12. Reusable UI patterns

1. **Marketplace link field:** paste affordance, supported-source hint, validation, clear/retry.
2. **Provider/source badge:** neutral source identification without imitating supplier branding.
3. **Product media rail:** consistent aspect ratio, thumbnails, fallback, SKU image synchronization.
4. **Variant selector:** attribute-based option grouping mapped to an exact returned SKU ID.
5. **Quantity stepper:** accessible decrement/input/increment with availability validation.
6. **Mobile selection sheet / desktop summary panel:** the same selection model rendered for different viewports.
7. **Money display:** explicit currency, locale-safe symbol/text, no view-layer arithmetic.
8. **Estimate breakdown:** compact summary plus disclosure for detailed rows on mobile; always expanded enough to expose the final total and caveat.
9. **Sticky action bar:** one clear primary action, safe-area support, no overlap with navigation.
10. **Status badge:** canonical status-to-client-label mapping, not raw enum text.
11. **Availability card:** explains a future module without synthetic counts or balances.
12. **State panel:** reusable loading, recoverable error, blocked/manual-review, and empty variants.

## 13. Current components/code that can remain

### Keep as protected behavior or infrastructure

- `app/client/layout.tsx`: retain the role check; later add `ClientShell` around its children.
- `middleware.ts`, `lib/auth/*`, and `lib/supabase/client.ts`: retain authentication/authorization behavior unchanged.
- `app/auth/callback/route.ts` and `/auth/continue`: retain session exchange and role routing.
- `components/sign-out-button.tsx`: retain the sign-out behavior; its visual wrapper may be restyled.
- `app/catalog/page.tsx` public-preview request/error handling: extract the useful behavior if public preview remains, but do not keep the page or mock directory as-is.
- `components/status-pill.tsx`: retain the idea of a centralized status component, but replace its labels/style mapping before client use.
- Tailwind/PostCSS setup and the existing focus-visible principle in `app/globals.css`.
- Existing Lucide icons, used consistently and never as the only accessible label.

### Keep only after refactoring away from mock-specific use

- `components/metric-grid.tsx` can become a generic summary-card grid later, but must not be rendered with `lib/mock-data.ts` in production.

## 14. Current components/pages that should be replaced

- `app/page.tsx`: replace the catalog redirect with the real public landing page.
- `app/catalog/page.tsx`: replace the mock product directory; optionally preserve only an extracted real public-preview feature.
- `app/client/page.tsx`: replace the hardcoded product/estimate/wallet screen with the honest client dashboard.
- `components/app-shell.tsx`: replace the role-mixed desktop-only navigation with separate role-aware shells and mobile navigation.
- `components/status-pill.tsx`: replace incomplete/raw enum presentation with a complete client-label mapping.
- `components/metric-grid.tsx`: replace or refactor before reuse; current content path is mock-only.
- `lib/mock-data.ts`: remove from production frontend use and delete after all imports are gone.
- `app/admin/page.tsx` and `app/admin/overview/page.tsx`: eventually replace the mock operational views in their own frontend phase.
- `app/staff/receiving/page.tsx` and `app/staff/packing/page.tsx`: eventually replace presentation-only forms in the warehouse frontend phase.
- `app/extension/page.tsx`: eventually replace static scaffolding in the purchasing/extension frontend phase.
- `app/globals.css` and `tailwind.config.ts`: retain their tooling role but expand/replace the minimal tokens with an accessible semantic design-token system during implementation.
- Auth page presentation should be consolidated into `AuthShell`/shared form patterns while leaving Supabase operations unchanged.

## 15. Exact planned frontend routes

### Public routes

```text
/
/services
/how-it-works
/shipping-policy
/shipping-fees
/product-rules
/restricted-products
/contact
```

`/catalog` should be retired as a fake catalog. If backward compatibility matters, redirect it to `/` or to a clearly labeled public preview section; do not retain hardcoded products.

### Authentication routes retained

```text
/auth/login
/auth/register
/auth/forgot-password
/auth/update-password
/auth/callback
/auth/continue
/auth/forbidden
```

### Client routes

```text
/client
/client/order/new
/client/account
```

Reserved, not active until matching backend reads exist:

```text
/client/orders
/client/orders/[orderItemId]
/client/groups
/client/groups/[groupId]
/client/wallet
/client/payments
/client/history
```

Do not add `/client/products/[productId]` or `/client/estimates/[estimateId]` yet. The current API set has no authenticated product-detail or estimate-detail read endpoint to hydrate those pages after reload.

## 16. API integration map for the first frontend slice

| UX action | Existing API | Frontend rule |
| --- | --- | --- |
| Optional public preview | `POST /api/products/preview-link` | Read-only preview; no saved/order claim. |
| Authenticated product resolution | `POST /api/products/resolve-link` | Use returned persisted IDs and snapshot. |
| Direct order confirmation | `POST /api/orders/confirm` | Submit one product session with one or more SKU/quantity lines; display the returned order/group identifiers and pending-payment warning. |
| Legacy estimate request | `POST /api/estimates` | Compatibility path for one product, one SKU, one quantity; display returned calculation only. |
| Accept estimate | `POST /api/estimates/:id/accept` | Surface returned status, references, and `meta.warnings`. |
| Reject estimate | `POST /api/estimates/:id/reject` | Require a non-empty reason. |

All client-side integrations must handle the centralized documented error envelope. Direct database queries must not be introduced merely to fill missing read APIs.

## 17. Blockers and protected-layer risks

### B1 — No read endpoints for resolved product or estimate detail

There is no implemented/documented authenticated `GET` product-detail or estimate-detail endpoint. A standalone `/client/products/[id]` or `/client/estimates/[id]` page therefore cannot be reliably refreshed or deep-linked using existing APIs.

**F0 response:** keep the working product-to-estimate sequence in `/client/order/new` and do not invent browser persistence as a source of truth. A later requirement for deep links is an API-contract decision and must be reported before implementation.

### B2 — Client dashboard read modules are not implemented in the current route tree

The API contract documents future `GET /api/orders`, order-detail, group, wallet, and report endpoints, but the current `app/api` tree does not implement those reads.

**F0 response:** orders, groups, wallet, payments, and history remain inactive navigation reservations. Do not show zero values or sample records.

### B3 — Legacy estimate endpoint supports one SKU

`POST /api/estimates` accepts one `skuId` and one quantity for compatibility. The customer-facing direct confirmation flow uses `POST /api/orders/confirm` for one product session containing one or more SKU/quantity lines.

**Phase 6B follow-up response:** preserve the multi-SKU selection model and confirm through the direct order endpoint. Do not submit client-calculated prices, exchange rates, or totals as authoritative values.

### B4 — Product snapshot persistence conflict is already documented

`SPEC_DECISIONS.md` OC-005 records an unresolved conflict between immutable historical product snapshots and provider-level uniqueness. The current authenticated resolution repository uses an upsert by provider/provider-item ID, so refreshing a supplier link can update the shared product row.

**F0 response:** do not attempt to hide or solve this in frontend state. Product persistence/versioning must be confirmed at the protected backend layer before any frontend behavior depends on immutable refreshed versions.

### B5 — Required public business content and contact destination are absent

The source tree does not provide approved copy for shipping policy, shipping fee explanation, product rules, restricted products, or a real contact/WhatsApp destination.

**F0 response:** the routes and content hierarchy are defined, but implementation must use owner-approved content/configuration. Do not invent fees, restrictions, guarantees, response times, addresses, or contact details.

### B6 — Character encoding is visibly broken

Several existing frontend strings display corrupted CNY, BDT, Chinese, and punctuation characters.

**F0 response:** verify UTF-8 source/content handling before visual rebuilding and centralize currency formatting. This is a frontend/content blocker, not a reason to change financial calculations.

## 18. F1 implementation order recommendation

This is sequencing guidance only; F0 does not implement it.

1. Semantic tokens, shared primitives, typography, currency/status formatters, and state patterns.
2. Public shell and real public information routes using approved content.
3. Shared auth shell while preserving existing Supabase behavior.
4. Role-specific mobile-first client shell and honest dashboard.
5. `/client/order/new`: resolve link, product detail, multi-SKU sheet/panel, quantities, live estimate review, confirm order.
6. Remove production imports of mock data and retire the fake catalog.
7. Validate at narrow mobile widths first, then tablet and desktop; include keyboard, screen-reader announcements, reduced motion, and error-path testing.

Stop after the agreed frontend slice. Do not continue into future client modules or admin/staff redesign automatically.
