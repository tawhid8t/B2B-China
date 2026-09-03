# Client Mobile App Product Specification

Status: Phase 0 planning specification  
Audience: product, design, mobile engineering, backend engineering, QA, and operations  
Role in scope: authenticated client only

This document defines the intended client mobile product. It does not authorize implementation, dependency installation, schema changes, API changes, or refactoring of the existing web, admin, staff, or extension applications. Existing business, status, database, API, authorization, and financial specifications remain authoritative. Items that cannot be implemented without a new decision or backend contract are recorded under **OPEN DECISIONS** or **SPECIFICATION CONFLICTS** and must not be invented by the mobile application.

## 1. Product goal

Provide existing clients with an extremely fast, smooth, native-feeling way to submit and track China-to-Bangladesh sourcing orders while reusing the existing authentication, backend, database, provider boundary, business rules, and wallet architecture.

The mobile app is a presentation and interaction client. It may improve navigation, rendering, input, and cached display, but it must not reproduce or replace server calculations, authorization, workflow transitions, or financial accounting.

Success means a signed-in client can complete the supported order journey, understand financial commitments and fulfillment progress, and recover cleanly from slow networks or server errors without stale local data being mistaken for current business truth.

## 2. Mobile-only scope

The first release includes:

- Persistent authenticated client sessions, subject to server-side session validity.
- Client dashboard and primary navigation.
- A 1688-first new-order journey using the existing product-resolution boundary.
- Product and multi-SKU selection, estimate review, and explicit confirmation.
- Client order list and detail experiences organized by product submission.
- Wallet balance, funding instructions, payment-proof submission, payment history, ledger history, and transaction detail.
- Client Product Statement adapted for a small screen.
- Favorites and Repeat Order when the required protected contracts are available.
- In-app notifications and read state.
- Account, settings, and help entry points to the extent supported by protected backend contracts.
- Safe local caching for faster display of non-authoritative data.
- Loading, empty, error, retry, stale, and offline presentation states.

The mobile app prioritizes 1688 in its first ordering interface. Existing backend support for Taobao and Tmall is not removed or changed; exposing those providers in mobile is not required for this release.

## 3. Explicit non-goals

- Admin, super-admin, staff receiver, staff packer, warehouse, purchasing-extension, or public-site workflows.
- Automated provider payment or storing 1688, Taobao, or Tmall credentials.
- New business rules, status transitions, financial formulas, or authorization models.
- Database migrations, API redesign, provider integration replacement, or server-side cache redesign in Phase 0.
- Treating mobile cache, optimistic state, device time, or client-calculated totals as authoritative.
- Reopening completed or cancelled records.
- Copying proprietary 1688 or Alipay branding, logos, icons, exact layouts, or visual identity.
- Reusing desktop pages through an embedded web view as the primary mobile experience.
- XLSX export for the initial Product Statement mobile experience. Existing supported exports may be linked or downloaded only if the platform and backend contract support them safely.

## 4. User role: client

The app supports only an authenticated `client` profile representing a Bangladesh-based buyer. The client may access only their own products, estimates, product orders, SKU-level order items, wallet, payment proofs, notifications, favorites, statement data, and permitted account information.

Role and ownership are determined by the server session and Row Level Security. The UI hiding a control is never authorization. If the session resolves to another role, an inactive profile, or no client record, the app must deny access and show an appropriate sign-in, forbidden, or support state rather than attempting a client operation.

## 5. Core navigation

The primary navigation has five destinations:

1. **Home** — dashboard, current attention items, recent activity, and shortcuts.
2. **New Order** — 1688 link entry and the active product-selection journey.
3. **Orders** — product-submission-based order history and detail.
4. **Wallet** — available CNY balance, funding, payment proofs, and ledger activity.
5. **Account** — profile summary, Product Statement, Favorites, Notifications, Settings, Help, security actions, and sign out.

New Order should be the visually prominent action without displacing accessibility labels or platform conventions. Notifications may also be reachable from a header indicator. Deep links, if later approved, must resolve through authentication and ownership checks before opening an entity.

Navigation state may be restored after app restart, but sensitive or mutation screens must revalidate the session and relevant server data before use.

## 6. Full client journey

1. The client signs in and the app restores a valid server-backed session on later launches.
2. Home loads current client-safe summaries and identifies items needing attention without inventing missing totals.
3. The client starts a new order and pastes a supported 1688 URL.
4. The backend resolves and persists normalized product and SKU data through the existing provider boundary.
5. The app presents the product, current variants, prices, availability, and shipping inputs returned by the server.
6. The client selects one or more SKU lines and positive quantities for the one resolved product.
7. The server calculates the estimate or confirmation snapshot using authoritative product, SKU, tariff, exchange-rate, weight, delivery, and profit inputs.
8. The app shows the estimate status, validity, breakdown, warnings, and the fact that final cost can change after actual purchase, weight, and delivery costs are known.
9. The client explicitly confirms or rejects through the applicable authoritative flow.
10. Successful confirmation creates one product submission containing the SKU-level order items and enters `pending_admin_review`; available wallet funds may be reserved and uncovered cost remains payable.
11. The client follows admin review, purchasing, supplier shipping, China receipt and QC, packing, forwarding, Bangladesh arrival, pickup readiness, and completion.
12. Status, wallet, refund, and correction events appear only after server confirmation. Relevant notifications link back to their owned entity when supported.

Provider, validation, or network failures must preserve the client's in-progress selections locally where safe, show an actionable error, and allow retry. They must not create an apparent order unless the server returns a successful, identifiable result.

## 7. Dashboard requirements

Home should prioritize business usefulness over decorative metrics. Subject to protected read contracts, it should show:

- Available CNY wallet balance with a direct Wallet action.
- Active product orders summarized by useful client-facing progress.
- Pending review, needs-attention, insufficient-wallet, unavailable-product, QC, and pickup-ready alerts.
- Recent order, wallet, payment-proof, and notification activity.
- New Order, Repeat Order/Favorites, Product Statement, and funding shortcuts.
- Explicit loading, empty, stale, partial-data, and error states.

Each metric must identify its server source and must be omitted or marked unavailable when a protected read contract does not supply it. The dashboard must never synthesize financial totals from cached order cards or local transactions.

## 8. New-order flow

The flow begins with a single URL field optimized for paste, clipboard access with platform permission handling, and clear supported-link guidance. Clipboard contents must not be read without a client action where the platform requires consent.

On submission:

- Validate only basic URL shape locally for immediate feedback; the server decides whether the provider and item are supported.
- Call the authenticated product-resolution endpoint and use the standard response/error envelope.
- Prevent accidental duplicate requests while allowing deliberate retry.
- Show progress without claiming the product is current until the server succeeds.
- Route unsupported, failed, or manual-review-required results to an actionable error and Help/Contact guidance. The client app does not create manual products.
- Retain the pasted URL and safe form state after recoverable failure.

Leaving a populated flow should warn before discarding it. No estimate, reservation, or order is created merely by resolving a link or changing SKU quantities.

## 9. Product/SKU selection flow

Use the useful interaction concepts of a 1688 buying sheet while applying the platform's own visual system. The selection experience must display:

- Primary product image with swipeable alternate images and an image-unavailable fallback.
- Product title, source/provider, current server-returned CNY price range, and domestic China delivery amount when available.
- Variant images, normalized color and size attributes, SKU label, per-SKU current price, and available stock when supplied.
- Quantity control for each available SKU, supporting multiple non-zero selections.
- Disabled unavailable SKUs with a textual reason; color alone is insufficient.
- Sticky summary showing selected SKU count, total selected quantity, and current displayed product subtotal.
- Category/international shipping selection and estimated weight input only where required by the existing authoritative contract.

Client-side arithmetic may provide an explicitly provisional display for responsiveness, using decimal-safe formatting. The app must replace it with server-returned values for estimate and confirmation and must never submit client-calculated price or financial totals as authority.

Before a financially important action, the app must obtain fresh server/provider validation as required by the backend. A changed price, stock, SKU, product availability, or tariff must stop confirmation and require the client to review the updated state.

## 10. Multi-SKU behavior

- One submission contains one product and one or more selected SKU lines.
- Every selected SKU has its own canonical SKU ID, positive integer quantity, price snapshot, estimate/order relationship, status, wallet allocation, and audit history as defined by the server.
- The submission appears as one product order/card in client UX. A later submission of the same product is a separate product order and must not be merged with the earlier submission.
- Expanding a product order reveals each color/size/SKU line, quantity, price/cost state, and line-level status.
- Aggregate quantity and amounts must come from the server read model or response. Mixed line statuses show the least-advanced client-facing status plus a **Mixed progress** indicator where specified.
- Confirmation is all-or-nothing from the app's perspective. A timeout or ambiguous response requires idempotent status recovery before the client can retry.
- The mobile app must never flatten multi-SKU selections into sequential provider cart actions or imply that a client display aggregate replaces SKU-level records.

## 11. Estimate flow

An estimate screen must show the persisted server result, including:

- Estimate status and expiry/valid-until time.
- Product unit price and quantity.
- Product subtotal and domestic China delivery in CNY.
- Saved CNY-to-BDT exchange rate and converted product amount.
- Estimated weight, category shipping, China-to-Guangzhou estimate, service/profit amount, and final estimated BDT total when supplied.
- Any unavailable component, assumption, warning, or manual-review condition.
- A clear statement that final cost may change after actual supplier payment, weight, and courier costs are known.

Only a non-expired `sent_to_client` estimate may be accepted. Rejected or expired estimates remain historical and require a new estimate. Accept and Reject are explicit actions with confirmation feedback; an in-flight request disables duplicate submission. The app must not extend validity or recompute an expired estimate locally.

The current authoritative contract creates one persisted estimate per SKU. The desired behavior for presenting or accepting a combined multi-SKU estimate is unresolved and recorded below.

## 12. Confirm-order flow

Before confirmation, present a final review grouped by product, including every selected SKU and quantity, server-calculated totals, applied rate, wallet coverage, estimated logistics, and warnings.

Confirmation requirements:

- Require an explicit client action and use the server's idempotency mechanism where available.
- Revalidate session, ownership, product/SKU identity, price, stock/availability, tariff, and applicable estimate validity on the server.
- Never treat a local success animation as confirmation. Success requires server-returned order identifiers and status.
- Show `pending_admin_review` after successful client confirmation, not Purchased.
- Show required, reserved, and uncovered CNY amounts returned by the server.
- Explain that confirmation reserves at most available wallet funds, does not post the final supplier debit, does not make the wallet negative, and does not block solely because part of the product cost is uncovered.
- If the response is lost or ambiguous, reconcile by idempotency key or an authoritative order read before allowing a retry.

## 13. Orders list behavior

Orders are organized as product-order cards inspired by the information hierarchy of marketplace order lists, using this platform's visual identity. Each card should show:

- Product image and title, product-order number when available, submission date, and supplier link access where safe.
- Aggregate SKU count, total quantity, saved product and delivery amounts, estimated/actual/partial cost label, and wallet coverage summary when supplied.
- Client-facing status and Mixed progress when SKU lines differ.
- Needs-attention or pending-payment warnings.
- Favorite state and eligible actions.

Support server-backed pagination and available filters such as status and date/month without mixing cached pages into authoritative totals. Pull-to-refresh or retry re-fetches current server data. Cached cards may appear immediately with a visible stale state until refreshed.

The list must not expose legacy active order-group concepts, admin-only notes, provider raw payloads, profit internals beyond client-visible statement fields, audit internals, or another client's data.

## 14. Order detail behavior

The detail screen opens a single product submission and contains:

- Product summary and supplier reference.
- Expandable SKU-line details with image, attributes, quantity, saved prices, cost state, and current status.
- Product-level totals supplied by the server, including domestic delivery and wallet coverage.
- Client-facing fulfillment timeline derived from authoritative status events.
- Estimate snapshot and actual replacements where client-visible.
- Related wallet entries and refund/correction activity when returned by the protected read model.
- Client-visible admin note and exception guidance.
- Save/remove Favorite, Repeat Order, cancellation, or other actions only when an authoritative contract says they are eligible.

Statuses use the defined client mapping: Pending review, Confirmed, Purchasing, Purchased, Seller shipped, Received in China, Checked in China, Packed, Sent to Guangzhou, Received by shipping partner, On the way to Bangladesh, Arrived in Bangladesh, Ready for pickup, Completed, Cancelled, and Needs attention.

## 15. Modification/cancellation/refund rules

- The app must not offer client order editing under the current rules. Existing specifications authorize pre-purchase SKU, quantity, weight, category, or price edits for admins, not clients.
- A client cancellation control may be shown only when a protected endpoint confirms eligibility. The status machine permits client cancellation from `pending_admin_review`, but no client cancellation API is currently defined.
- Other active-status cancellations require admin approval. Completed orders are read-only except for permitted super-admin correction.
- Product unavailability or purchase failure may lead an admin to offer replacement, cancellation, refund/credit, or a request for client approval.
- QC failures may lead an admin to return, replace, refund, discount, or ship with client approval.
- Refunds and financial corrections must be server-created, append-only wallet entries linked to the original transaction with a reason. Posted transactions are never edited or deleted.
- The app displays refund/correction progress and resulting ledger entries; it must not locally credit funds or infer that a request has been approved.

The initiation, consent, dispute, cancellation, and refund endpoints and detailed client eligibility remain open decisions.

## 16. Wallet UX requirements

Use the clarity and task hierarchy of a modern payment wallet without copying Alipay branding. The Wallet home should show:

- **Available balance (CNY):** sum of all posted ledger entries and never negative.
- **Active reservations (CNY):** remaining net amount held for confirmed orders.
- **Total funds (CNY):** posted credits, debits, refunds, and adjustments excluding reservation and reservation-release entries.
- Primary actions for Add funds/Recharge, Transaction history, Payment history, and funding instructions.

Funding flow:

1. Load active server-managed payment destinations.
2. Let the client enter claimed BDT amount, paid date, optional note, and a JPG, PNG, WebP, or PDF proof up to 10 MB.
3. Clearly state that upload creates a `pending` proof and no wallet credit.
4. Show `pending`, `needs_review`, `approved`, `rejected`, or `cancelled`, preserving claimed amount, verified amount, rate, and review reason where applicable.
5. Permit cancellation only for the client's own pending proof through the existing protected action.

Transaction history supports server filters, pagination, and transaction detail for `advance_credit`, `order_debit`, `refund`, `adjustment`, `reservation`, and `reservation_release`. Detail should show CNY and BDT values, saved rate, timestamp, running available balance, order/product references, actor/reason when client-visible, original/correcting transaction relationship, and correction totals.

All wallet screens revalidate on foreground and before financial actions. Cached balances and ledger entries are labeled stale and read-only when the server cannot be reached.

## 17. Product Statement mobile requirements

The Client Product Statement remains the active replacement for client-facing order groups. Its business logic is unchanged:

- One row-equivalent represents one client product link and aggregates all SKU/color/size order items for that client and link.
- Persisted estimates are the only source of estimated values; missing estimate-derived values remain blank until an actual value exists.
- Verified actual values replace their corresponding estimates immediately. Mixed actual and estimated components are labeled `partial`.
- Historical BDT values use each SKU line's saved rate and are never recalculated using a current rate.
- Guangzhou cost, Bangladesh shipping, service charge, total BDT, average unit cost, client-visible note, status, and Mixed progress follow the existing statement contract.
- Filters remain date range, month, category, and status.
- The server returns exactly 30 product rows per page with numbered pagination semantics.
- Summary metrics remain ordered-product count, total quantity, total weight, total BDT where returned, and category breakdowns from the same filtered dataset.

For mobile presentation, use a summary dashboard plus vertically stacked product cards or a compact list that opens a complete detail sheet/screen. Horizontal scrolling may be used where useful, but no financial or status field may be silently hidden. Actual, Estimated, Partial, and Unavailable labels must be visible in both summary and detail contexts.

## 18. Favorites requirements

- A client can save only an owned, non-cancelled order item that reached `confirmed` or a later eligible status.
- A favorite is a convenience reference to a prior choice, never a reusable current price, availability, SKU authorization, estimate, or order snapshot.
- Favorites show last-known product and variant information as historical reference, plus current refresh state when available.
- Removing a favorite archives it; it never deletes or rewrites its source order, product, estimate, wallet, provider, status, or audit history.
- Staff roles have no access. Only the client owner may initiate a self-service repeat order.

The dedicated favorites list depends on the documented protected list endpoint, which is not currently implemented.

## 19. Repeat-order requirements

1. The client selects Repeat Order from an eligible favorite or prior order.
2. The app calls the favorite refresh action, which must bypass display cache and resolve the original supplier URL through the provider boundary.
3. The server returns current product/SKU data and one of the specified actionable states: resolved, unavailable, selection required, manual review, or provider failure.
4. The app may pre-highlight an exact current provider SKU or normalized-attribute match, but labels alone never authorize substitution.
5. If no exact available match exists, the client selects a current SKU. If none is available, no estimate or order is created.
6. A successful refresh is usable for estimate creation for 15 minutes. Expiry requires another refresh.
7. The repeat creates a new estimate using current provider data and current business settings. Only acceptance creates new order data.
8. The original order and every historical financial, provider, product, status, and audit record remain unchanged.

Unavailable favorites remain visible for reference and may be archived. The app must not fall back to an old estimate, cached provider response, or historical price.

## 20. Notifications

The initial authoritative capability is an in-app inbox with pagination, unread count, recipient-only access, and mark-read action. Notification content is server-controlled. The app must support useful empty/error states and route owned entity references to the relevant screen after reauthorization.

Client events should include those defined by business rules as their operational checkpoints become available: estimate ready/expired, order confirmation, insufficient wallet, product unavailable, seller shipment, China receipt, QC problem/approval, packing, Bangladesh arrival, pickup readiness, payment review outcome, reservation release, and wallet correction.

The app may refresh notifications on launch, foreground, and client action. Push notifications, device tokens, background delivery, deep-link payloads, and preferences are not yet authorized contracts and remain open decisions.

## 21. Account/settings/help

Account should show server-returned client identity and business/pickup details, security actions, session/device information where supported, and sign out. Profile editing must remain unavailable until a protected update contract defines editable fields and validation.

Settings should provide only approved client preferences. Notification preferences, language, theme, biometric unlock, cache controls, and device/session management must not imply server support before contracts exist.

Help should expose product rules, restricted products, shipping guidance, ordering explanations, wallet/funding guidance, and approved contact channels. Help content may be cached for reading but should show its last refresh when offline. The app must not embed admin-only manual fallback controls.

## 22. Mobile caching goals

Caching should improve perceived launch, navigation, image, and repeat-view speed while preserving server authority.

Eligible cached display data may include:

- Product images and normalized product/SKU display data.
- Previously loaded order cards and details.
- Product Statement pages and filter results.
- In-app notification pages and read presentation pending server confirmation.
- Help and policy content.
- Safe, incomplete new-order form selections.

Rules:

- Cache entries include owner identity, source, fetched time, schema/version marker, and expiry or invalidation metadata.
- Client-owned cache is cleared on sign-out, account change, session revocation, or incompatible app data migration.
- Sensitive local data uses platform-protected storage appropriate to its sensitivity; auth secrets never use general-purpose unencrypted storage.
- Images use bounded storage and eviction. Raw provider payloads, payment proof files, signed private URLs, service credentials, and unrestricted financial exports are not retained in general cache.
- Fresh responses replace cached presentation. Failed refresh preserves a visibly stale read-only view rather than clearing useful history.
- Cache TTLs and storage budgets remain open decisions; they do not relax mandatory fresh validation.

## 23. Online/offline expectations

Offline mode is read-only. The client may view previously cached, clearly labeled content and safely edit an unsubmitted local order draft. The app must show the last successful refresh time and an offline indicator.

Connectivity is required for:

- Sign-in, session revalidation, authorization, and ownership checks.
- Product resolution and provider refresh.
- Current stock or provider price checks.
- Estimate creation, acceptance, rejection, or recalculation.
- Order confirmation, modification, cancellation, refund, or repeat-order creation.
- Wallet balance refresh, payment-proof submission/cancellation, and transaction truth.
- Server notification read state and every business mutation.

The app must not queue financial or order mutations for silent replay after reconnection. A client-initiated retry must use idempotency where supported and reconcile ambiguous prior attempts first. Payment-proof uploads interrupted before server acknowledgement remain unsubmitted.

## 24. Server-authoritative data rules

The server and database are authoritative for:

- Authentication, role, session validity, authorization, client identity, and ownership.
- Product/SKU identity, current availability, stock, provider price, and domestic delivery.
- Shipping tariffs, category rules, weights used for calculation, exchange rates, profit/service rules, and estimate results.
- Estimate status, validity, acceptance/rejection, and historical snapshots.
- Product order and SKU-line creation, status, status history, and fulfillment progress.
- Wallet totals, reservations, uncovered amounts, debits, refunds, adjustments, corrections, rates, and running balances.
- Payment-proof status and verified amount.
- Product Statement calculations and pagination totals.
- Favorite eligibility, provider refresh, SKU match, and repeat-order provenance.
- Notification content, recipient, entity reference, and read persistence.

The app must not authorize actions based on cached flags, submit authoritative prices/totals/client IDs, write directly to protected business tables, bypass RLS, or expose service-role/provider credentials. Optimistic UI is limited to reversible presentation and must roll back or reconcile against the response.

## 25. Performance UX goals

- Restore the app shell and safe cached presentation promptly while authoritative refresh runs separately.
- Keep navigation and quantity changes responsive without waiting for unrelated network work.
- Virtualize or incrementally render long order, statement, wallet, and notification lists.
- Load appropriately sized images progressively, reserve their layout space, and provide reliable placeholders.
- Deduplicate identical in-flight reads and cancel obsolete product/filter requests where safe.
- Preserve form input through recoverable errors and app backgrounding.
- Show a purposeful loading state quickly; never leave a blank screen during provider or financial operations.
- Use skeletons only when layout is known, progress messaging for potentially long provider calls/uploads, and explicit retry for failures.
- Revalidate critical screens on foreground without blocking navigation to clearly stale cached content.

Numerical launch, interaction, network, bundle, memory, and crash-free targets require platform and observability decisions and are listed under OPEN DECISIONS.

## 26. Security assumptions

- Supabase Auth remains the identity provider and the backend remains the only trusted integration boundary.
- Session tokens are stored using platform-secure credential storage and are never logged, included in analytics, or placed in general cache.
- Private endpoints require authenticated requests; RLS and server authorization restrict every client to owned records.
- Service-role keys, OTAPI credentials, provider credentials, and other production secrets never ship in the app.
- Payment proofs and other private files use protected upload/access flows and short-lived signed access where applicable.
- Logs, crash reports, screenshots, clipboard handling, and analytics must redact tokens, private URLs, proof data, raw provider payloads, and unnecessary personal/financial content.
- TLS and production endpoint validation are required. Debug endpoints, insecure transport, and development credentials are excluded from production builds.
- Sign-out clears local client data and credentials. Expired/revoked sessions fail closed while preserving only non-actionable presentation as appropriate.
- Device compromise cannot be fully prevented by the app; sensitive actions always rely on server validation rather than local device trust.

Biometric unlock, root/jailbreak policy, certificate pinning, screenshot blocking, session/device revocation UX, and retention periods remain open decisions.

## 27. Accessibility/basic usability requirements

- Support platform screen readers with meaningful control names, roles, states, reading order, headings, and status announcements.
- Support dynamic text without truncating essential prices, quantities, warnings, or actions; allow scrolling when content grows.
- Meet WCAG AA contrast intent and never encode status, stock, cost state, or error solely through color.
- Use platform-appropriate minimum touch targets with spacing that prevents accidental quantity or confirmation actions.
- Provide accessible quantity input in addition to increment/decrement controls.
- Respect reduced-motion and system appearance preferences when supported; motion is never required to understand state.
- Handle safe areas, keyboard avoidance, orientation changes, and common small-screen widths.
- Format CNY, BDT, decimal quantities, dates, and time zones consistently while preserving saved values exactly.
- Give destructive or financial actions clear labels, consequences, confirmation where appropriate, and recovery guidance.
- Provide image alternatives/fallbacks, accessible upload controls, and validation messages associated with their fields.
- Use plain, client-facing status language while retaining enough detail to distinguish warnings, estimates, and actual values.

## 28. What should NOT be duplicated from the web implementation

- Desktop sidebar, wide spreadsheet/table layouts, hover-dependent controls, browser-only routing, or desktop modal dimensions.
- React/Next.js components, server components, page code, browser cookie assumptions, or CSS copied as the mobile architecture.
- Backend services, provider adapters, estimate formulas, wallet arithmetic, authorization checks, or status-transition logic.
- Direct Supabase table writes for protected workflows or any service-role behavior.
- Web-only temporary limitations such as disabled placeholder navigation when a real protected mobile contract exists.
- Legacy active order-group UI or group-capacity behavior.
- Mock financial totals, mock orders, provider payloads, or fallback business behavior in production paths.
- Proprietary 1688/Alipay logos, icons, colors, trade dress, wording, or pixel-identical screens.

The mobile app should reuse API contracts and domain meaning, not implementation structure. Shared generated types may be considered later only if they do not couple the mobile UI to server internals or create a second source of truth.

## 29. Known specification conflicts or open questions

### SPECIFICATION CONFLICTS

These conflicts must be resolved in the authoritative specifications before dependent mobile behavior is implemented:

1. **Retired order groups versus API responses.** Business and database rules retire active order groups in favor of `product_orders` and Product Statement aggregation, while parts of `API_CONTRACT.md` and current estimate/confirmation responses still return `groupId` and `groupCode` and document active group APIs.
2. **Multi-SKU estimate versus confirmation.** `POST /api/orders/confirm` supports one product with multiple SKU lines, but the persisted estimate API and acceptance lifecycle are defined for one SKU per estimate. There is no authoritative combined multi-SKU estimate, acceptance, expiry, and product-order result contract for the envisioned Estimate then Confirm journey.
3. **Session-derived identity versus request `clientId`.** Security and favorites rules prohibit trusting a client-provided client ID, but documented and implemented estimate/confirmation requests still accept or require `clientId`. The mobile app cannot decide which contract is canonical.
4. **Immutable repeat snapshots versus provider uniqueness/upsert.** Repeat Order requires a fresh immutable product/SKU snapshot, while the documented unique provider identity and current upsert approach are not revision-safe and may overwrite historical product data.
5. **Client cancellation transition versus absent contract.** The status machine permits a client to cancel `pending_admin_review`, but no client order-cancellation API, audit request, product-order atomicity rule, or wallet reservation response is defined.

### OPEN DECISIONS

The following are missing requirements or implementation contracts, not permission for the mobile team to invent behavior:

- Choose the mobile framework, repository/package location, supported iOS/Android versions, tablet posture, and release/distribution process.
- Define the canonical multi-SKU estimate and confirmation API flow, including idempotent recovery.
- Resolve session-derived client identity across all client mutation APIs.
- Define canonical client order list/detail contracts. Documented `GET /api/orders` and `GET /api/orders/:id` routes are absent; the current web client uses `/api/client/order-cards` and has no equivalent documented detail endpoint.
- Define whether any client order editing is permitted. Current rules authorize only admin editing before purchase.
- Define client cancellation eligibility beyond the existing status-table statement, including whether one line or the entire product order is cancelled and how reservations are released.
- Define refund/dispute initiation, client consent, admin decisions, statuses, partial refunds, expected timelines, notifications, and protected APIs.
- Complete Favorites/Repeat Order contracts and implementation: the protected favorites list and `POST /api/favorites/:id/estimates` are absent, and the current refresh implementation does not yet return the full specified current product/SKU states.
- Define native push notifications, device-token lifecycle, permission prompting, event eligibility, deep links, badge behavior, preferences, and background refresh. In-app notifications are the only current authority.
- Define account/pickup-detail editing fields, validation, audit requirements, and API; define supported client settings and help/contact channels.
- Decide localization and language support, including English, Bangla, and Chinese SKU labels, plus currency/date formatting policy.
- Define biometric unlock, sensitive-screen privacy, rooted/jailbroken-device posture, certificate pinning, device/session management, and local retention periods.
- Define cache TTLs, size limits, eviction, encryption classification, schema migration, image policy, and whether users can clear cached data.
- Define quantitative performance, reliability, accessibility certification, crash-free, analytics, logging, and monitoring targets and the approved privacy-safe tools.
- Define whether existing CSV exports are downloaded, shared, or omitted in the first native release.
- Resolve existing platform checkpoints that affect visible mobile truth, including incomplete estimate expiry automation, provider tracking, QC, shipping, and non-wallet notification events.

## 30. Acceptance criteria for the future production mobile app

The future production app is acceptable only when all applicable criteria pass:

### Role, security, and authority

- Only authenticated active clients can enter the app, and no client can access another client's records through UI, API manipulation, cache, notification links, or local account switching.
- Server/RLS enforcement protects every private operation; secrets and privileged credentials are absent from the app and its logs.
- Sign-out and account change clear credentials and client-owned local cache.
- Cached or optimistic values never authorize or finalize a financial, order, status, ownership, stock, or provider-price decision.

### Ordering

- A valid 1688 URL resolves through the backend and shows normalized images, title, variants, current returned prices, stock, and delivery data; invalid, unavailable, failed, and manual-review cases are actionable.
- The client can select multiple available SKUs and quantities for one product, see correct selection totals, and submit one product session without duplicate creation.
- Estimate and confirmation use authoritative current data, expose every required breakdown/warning, enforce validity, and reconcile ambiguous retries idempotently.
- One submission appears together in client UX while its SKU lines remain independently traceable in backend status, wallet, purchasing, and audit records.

### Orders and lifecycle

- Lists, details, filters, pagination, timelines, Mixed progress, estimated/actual/partial labels, and attention states match protected server data and client-facing status mappings.
- No unsupported edit, cancel, refund, reopen, replacement, or status action is exposed.
- Completed and cancelled data remains historical and read-only as specified.

### Wallet and funding

- Available balance, active reservations, total funds, payment history, ledger entries, order references, saved rates, and running balances reconcile with the canonical server statement.
- Proof upload enforces type/size rules, never credits before approval, and communicates review/cancellation outcomes.
- Partial wallet coverage never produces a negative balance; uncovered amounts and purchase-time debit behavior are clear.
- Refunds and corrections appear as linked append-only entries without mutating originals.

### Statement, favorites, and notifications

- Product Statement uses the authoritative product-link aggregation, exact 30-row pages, filters, metrics, historical-rate rules, cost-state labels, and complete mobile-accessible financial detail.
- Favorite eligibility and archival preserve history; every repeat order performs a fresh provider refresh, honors the 15-minute refresh expiry, and creates new records only.
- In-app notifications are recipient-scoped, paginated, readable, and link only to authorized entities. Native push is accepted only after its open contract is approved.

### Resilience, performance, and usability

- Cached screens are fast, bounded, owner-scoped, visibly timestamped when stale, and usable read-only offline.
- Mutations require connectivity, never replay silently, survive recoverable failures without duplicate business records, and show clear loading/success/error outcomes.
- Approved quantitative performance and reliability budgets pass on supported low- and mid-range devices and representative China/Bangladesh networks.
- Critical journeys pass screen-reader, dynamic-text, contrast, touch-target, keyboard, reduced-motion, safe-area, and small-screen tests.
- Product/provider images and unavailable data have stable fallbacks; no essential financial or status information is hidden.

### Release readiness

- All SPECIFICATION CONFLICTS affecting the release are resolved in authoritative documentation, and required OPEN DECISIONS are approved.
- Contract, integration, authorization/RLS, financial reconciliation, idempotency, offline, accessibility, performance, security, and supported-device tests pass.
- Production monitoring, privacy-safe diagnostics, support escalation, rollback, and release ownership are documented.
- The native presentation uses original platform branding and interaction design rather than copying 1688 or Alipay identity.

## Authoritative references

- `docs/AGENTS.md`
- `docs/BUSINESS_RULES.md`
- `docs/STATUS_MACHINE.md`
- `docs/DATABASE_DESIGN.md`
- `docs/API_CONTRACT.md`
- `docs/PROJECT_ARCHITECTURE.md`
- `docs/WALLET_PAYMENT_IMPLEMENTATION.md`
- `docs/FEATURE_FAVORITES_REPEAT_ORDER.md`
- `docs/CLIENT_PRODUCT_STATEMENT.md`
- `docs/IMPLEMENTATION_CHECKPOINTS.md`

