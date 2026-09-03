# Client Mobile API Gap Analysis

Status: Phase 3 contract analysis only  
Analysis date: 2026-09-01  
Implementation status: no API, database, mobile UI, dependency, or backend change authorized

This document maps the planned client mobile experience to the current repository implementation. A capability is called **implemented** only when a current route and its service, repository, or database function support it; a specification entry without a route is not implementation evidence.

The requested root files `AGENTS.md`, `WALLET_PAYMENT_IMPLEMENTATION.md`, `FEATURE_FAVORITES_REPEAT_ORDER.md`, and `CLIENT_PRODUCT_STATEMENT.md` do not exist at the repository root. Their current authoritative locations are under `docs/`.

## Scope and guardrails

- The existing Next.js API remains the only business API boundary.
- Supabase is used by the future native app for authentication only. Mobile business reads and mutations go through authenticated Next.js routes.
- Client identity and ownership must be session-derived. Request identifiers select owned resources; they do not establish ownership.
- RLS remains mandatory. Service-role access, provider credentials, raw provider data, wallet logic, and financial calculations remain server-only.
- Proposed changes are additive and must preserve the current web and extension behavior, response envelope, status machines, financial history, and historical rates.
- This phase does not select or implement a database migration. Where a gap needs persistence, the required contract decision is recorded first.

## Priority rubric

| Priority | Meaning |
| --- | --- |
| **P0** | Blocks the approved mobile MVP journey or prevents a safe authoritative implementation. Resolve before building the dependent UI. |
| **P1** | Required before production release, but a constrained MVP prototype can proceed without it or with the feature disabled. |
| **P2** | Performance, usability, or maintainability improvement that is not required for the first safe journey. |
| **P3** | Future capability requiring a product/business decision; do not imply it exists in the initial app. |

`None` means no API gap was found for the stated scope. It does not mean that native transport, contract tests, or live deployment have been verified.

## Executive finding

The current backend can already resolve a product, return normalized images/SKUs, create a single-SKU persisted estimate, atomically confirm one product with multiple SKU lines, expose product-order cards, provide the wallet and payment-proof workflow, return the Product Statement, and serve a recipient-owned notification inbox.

It cannot yet support the complete planned mobile flow as one coherent contract. The central P0 conflict is that the desired flow requires an authoritative multi-SKU estimate before confirmation, while the repository offers either:

1. one persisted estimate and acceptance per SKU, or
2. one atomic multi-SKU direct confirmation that creates the order before returning its server-calculated totals.

The second path is atomic and uses one request; mobile does **not** need one request per SKU to create a multi-SKU product submission. However, it has no server-authoritative pre-confirmation review object, does not perform a fresh provider lookup at confirmation, and does not return the resulting `productOrderId`/order number.

## Capability matrix

| # | Mobile feature | Required API/data | Existing endpoint | Existing implementation status | Gap and priority | Recommended minimal additive change |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | Session/profile bootstrap | Verified user, active profile, `client` role, client record, safe account fields, contract/version flags | Supabase Auth plus per-route `authorizeApiRequest`; no bootstrap route | Auth claims and database profile status are verified for each private route. Web layouts read session metadata and the client table server-side. Bearer forwarding exists in `lib/supabase/server.ts`. | **P0:** no native-safe bootstrap response; account data is coupled to web layout/session behavior. | Add `GET /api/client/bootstrap`, derive identity from the bearer session, and return a minimal typed profile/client DTO. Do not return risk flags, assigned-admin internals, or authorization from user metadata. |
| 2 | Dashboard summary | Wallet available balance, order attention counts/recent items, payment state, unread notifications | No dashboard API; data exists across `/api/wallet`, `/api/client/order-cards`, `/api/payments`, `/api/notifications` | Current web dashboard deliberately shows no protected summary. Existing APIs would require multiple full-list reads and over-fetch orders/ledger/inbox. | **P1:** production dashboard contract missing. | After list/detail contracts stabilize, add `GET /api/client/dashboard` returning only server-computed summary counts, wallet totals, recent items, and unread count. Keep full lists separate. |
| 3 | Notification summary | Unread count and optional recent notifications | `GET /api/notifications?page=1` | Implemented. `meta.unread` and the first 20 recipient-owned notifications are returned. | **None** for basic summary. **P2:** a count-only read may reduce payload if dashboard aggregate is not added. | Reuse inbox metadata initially; include unread count in the proposed dashboard endpoint rather than add another standalone request. |
| 4 | Product URL resolve | Authenticated supported-link validation, provider lookup, persisted product identity | `POST /api/products/resolve-link` | Implemented for 1688/Taobao/Tmall through the server provider boundary and integration logging. Uses an admin client only after route authorization. | **P1:** persistence upserts the provider identity and is not revision-safe; live provider availability is unverified. | Preserve this route and envelope. Make product persistence revision-safe before production and expose an immutable/current-revision identifier without changing the existing response fields. |
| 5 | Normalized product | Product ID, provider/item ID, URL, titles, category, price range, delivery | Included in resolve response | Implemented and normalized server-side. | **P0 cross-cutting:** no exported response schema; numeric wire precision is undocumented. | Publish a Zod response DTO in `packages/contracts`; keep normalization server-only. |
| 6 | Product images | Ordered public image URLs and fallback semantics | Included in resolve response and order-card read model | Supplier URLs are returned directly; no client image proxy or normalized image metadata exists. Payment proofs are separate private storage. | **P1:** host expiry/hotlink/content-type behavior and client-safe fallback policy are not contracted. | Keep public supplier URLs in the DTO, add stable ordering/nullable semantics, and add a server image proxy only if measured provider-host failures justify it. Do not expose signed proof URLs in product responses. |
| 7 | Variant groups | Attribute groups/options, display label, image, match state | No explicit endpoint; per-SKU `attributes` in resolve response | Framework-neutral helpers derive groups and option states from normalized SKU attributes. | **None** for first release. **P2:** server-provided canonical ordering/localization could improve consistency. | Derive groups in the mobile domain package; do not create an API unless provider-specific ordering/localization proves necessary. |
| 8 | SKU availability | SKU identity, price, available quantity, availability reason/currentness | Included in resolve response; checked in `confirm_multi_sku_order` | Stored `available_quantity` is returned and confirmation rejects an individual line above it. Missing quantity means unknown rather than zero. Re-resolution updates/inserts returned SKUs but does not retire a previously stored SKU that disappears. | **P0 ordering:** confirmation validates persisted rows but does not freshly call the provider; stale missing SKUs can remain selectable, duplicate SKU lines are not rejected/aggregated, and no freshness/revision token is returned. | Define freshness in the canonical quote/confirmation contract, retire/version missing SKUs safely, require unique SKU IDs (or aggregate before validation), and reject/review provider price or stock drift. |
| 9 | Multi-SKU selection | Multiple SKU IDs and positive quantities for one product | Client-side pure helpers; `POST /api/orders/confirm` accepts `lines[]` | Selection is local presentation state; the server revalidates product/SKU ownership, quantity, stored stock, tariff, and current platform rate. | **None** for selection mechanics. | Share only selection helpers/types. Never send client-calculated prices or totals. |
| 10 | Estimate creation | Authoritative persisted estimate for all selected lines, expiry, full breakdown, warnings | `POST /api/estimates` | Implemented only for one `productId` + one `skuId` + quantity. It requires caller-supplied `clientId`. | **P0:** no canonical multi-SKU estimate object or session-derived request contract. | Approve one additive multi-SKU estimate/quote contract before UI. Preserve the single-SKU route for web compatibility; do not make mobile create one estimate per line. |
| 11 | Estimate recalculation | New authoritative result after input/provider/rate change; prior history preserved | Repeating `POST /api/estimates` creates another single-SKU estimate | New single-SKU records can be created, but there is no explicit recalculation relationship, multi-SKU behavior, or current-product revision check. | **P0:** complete mobile quote refresh/recalculation contract missing. | The approved multi-SKU estimate contract should create a new immutable revision and identify what changed; never mutate an accepted/historical estimate. |
| 12 | Estimate acceptance | Accept only unexpired reviewed result, atomically create one product order and lines | `POST /api/estimates/:id/accept` | Implemented for one estimate/one order item. Requires `clientId` and returns legacy `groupId`/`groupCode`. | **P0:** cannot atomically accept a combined multi-SKU estimate into one product submission. | Add a session-derived multi-SKU acceptance/confirmation path after the contract decision. Retain the existing single-estimate endpoint unchanged for compatibility. |
| 13 | Order creation | One product submission, multiple line items, idempotency, wallet coverage, server totals | `POST /api/orders/confirm` | **Implemented atomically in one request.** The service calls the service-role-only `confirm_multi_sku_order` RPC; the RPC validates actor/profile/client ownership, locks relevant rows, creates every line/reservation and the idempotency record in one transaction. A trigger groups the lines under one `product_order`. | **P0:** no pre-confirm authoritative quote; request still permits `clientId`; response omits `productOrderId`/order number and retains null retired group fields. | Keep the route. Add a session-derived client request variant tied to the approved quote, and add `productOrderId`, `orderNumber`, replay indicator, and canonical line DTO to the response. Preserve legacy request branches/fields until web callers migrate. |
| 14 | Grouped client product order display | Product-order ID/number, product summary, aggregated totals/status, SKU lines | `GET /api/client/order-cards` | Implemented through `get_client_order_cards`; rows are grouped by `product_order_id`, with SKU lines, cost state, wallet coverage, and favorite state. | **P0 contract:** service type is `unknown[]`; no response validator. **P1:** endpoint returns every order and has no filters/pagination. | Define a product-order card schema now. Add a paginated canonical list without breaking the current web endpoint/default behavior. |
| 15 | Order list | Owned product orders, filters, pagination, stable totals | Documented `GET /api/orders`; route absent. Current `/api/client/order-cards` is unpaginated | The current web read model is usable for small data sets but not the documented list contract. | **P0:** stable mobile list DTO absent. **P1:** server pagination/filtering absent. | Implement the documented `GET /api/orders` additively as a session-derived product-order list, or add opt-in pagination to order-cards while preserving its legacy no-query behavior. |
| 16 | Order detail | One owned product order, all lines, estimate/actual values, wallet links, timeline, exceptions, action eligibility | Documented `GET /api/orders/:id`; route absent | Order cards expose substantial summary/line data but no canonical detail or status-event timeline. | **P0:** mobile order detail and deep-link target are blocked. | Add `GET /api/orders/:productOrderId` using session ownership. Return client-safe lines, timeline, financial provenance, related ledger references, and server-computed action capabilities. |
| 17 | Edit eligibility | Server decision on editable fields/status | No client endpoint | Existing rules authorize admin pre-purchase edits, not client edits. | **P3:** no approved client editing behavior; this is a product decision, not an implementation omission. | Return `canEdit: false` or omit edit actions in order detail. Do not add a client edit route unless business rules change. |
| 18 | Order modification | Authorized patch with validation/audit | Admin-only order routes | Admin approval/actual-detail/purchase actions exist; no client mutation exists. | **P3:** client modification is not authorized. | No backend change for MVP. Keep the mobile control absent. |
| 19 | Cancellation | Eligibility, whole-product versus line scope, reservation release, audit/result | No client order-cancel endpoint | Status rules permit client cancellation only from `pending_admin_review`, but no API defines atomic product-order behavior. | **P1** before production if self-service cancellation is promised; otherwise explicitly exclude it from MVP. | Decide whole-product versus line cancellation, then add a session-derived, idempotent cancellation endpoint that changes valid statuses and releases reservations atomically. |
| 20 | Refund request | Client request/consent/dispute status and resulting linked ledger activity | No client refund/dispute endpoint; admin wallet corrections exist | Ledger supports linked full/partial corrections and refunds without editing originals, but client initiation/approval states are unspecified. | **P3** for self-service initiation; **P1** for client-visible refund/correction read data in order detail. | Keep operational refunds admin-led until a workflow is approved. Expose resulting ledger/status data; do not invent a mobile approval state. |
| 21 | Wallet balance | Available, reserved, and total CNY values | `GET /api/wallet` | Implemented and session-derived for clients. Canonical RPC totals are returned with the transaction page. | **P0 contract:** documented wallet JSON is flat while runtime JSON nests values under `data.totals`; no shared schema. | Standardize documentation and export the actual envelope/DTO without breaking runtime consumers. |
| 22 | Wallet transaction list | Filters, pagination, full ledger entry and running balance | `GET /api/wallet` | Implemented with type/date filters, 1-100 page size at route level, ownership enforcement, and detailed entries. | **None** functionally. **P1:** money wire representation and contract validation are not mobile-safe/shared. | Reuse the endpoint; publish exact DTOs and decimal-string/number policy, then add contract tests. |
| 23 | Wallet transaction detail | Fresh owned transaction by ID, linked original/corrections/order/proof | No detail route; list entries contain most detail fields | A detail screen can be opened from an already loaded list item, but cannot independently refresh or deep-link to one entry. | **P1:** standalone current detail boundary missing. | Add `GET /api/wallet/transactions/:id` only if the approved UX has a distinct/deep-linked screen; otherwise define list-entry detail as the contract and refresh its containing page. |
| 24 | Recharge/payment-proof workflow | Active destinations, multipart proof, history, cancellation | `GET /api/payment-instructions`; `POST /api/payments/proof`; `GET /api/payments`; `POST /api/payments/:id/cancel` | Implemented. Session derives owner/path; 10 MB JPG/PNG/WebP/PDF checks, private upload, pending proof, history, and own-pending cancellation exist. | **P1:** no shared multipart/error DTO or native upload verification; interrupted uploads have no resumable/idempotent contract. | Reuse current routes. Document multipart field/error responses and verify bearer/native `FormData`; do not add signed direct upload unless gateway limits or measured reliability require it. |
| 25 | Product Statement list | Owned filtered aggregates, exactly 30 rows, chart totals | `GET /api/client/product-statement` | Implemented through an ownership-checking RPC with date/month/category/status filters and fixed 30-row pages. | **P0 contract:** rows/chart categories are `unknown[]`; API contract section has an unrelated malformed example response. | Export exact row/chart schemas and correct documentation while preserving endpoint behavior and 30-row pages. |
| 26 | Product Statement detail | Every financial field for one aggregate row, current refresh/deep link | No detail route; list row already contains the required aggregate fields | Loaded rows contain the statement's full aggregate financial/status record but not SKU-level drill-down. | **None** if mobile uses an expandable card/detail from the loaded row. **P2** if direct deep links/current one-row refresh are approved. | Avoid a new endpoint initially. Reuse the row DTO; use order detail for SKU lines. Add a row-by-product-link read only when a concrete navigation need exists. |
| 27 | Favorites list | Paginated active favorites with provenance, display snapshot, latest refresh | Documented `GET /api/favorites`; route implements only `POST` | No standalone list. Order cards expose only per-order active favorite state. | **P0** if Favorites remains in MVP; otherwise remove the tab/action until implemented. | Add session-derived `GET /api/favorites` with a typed, paginated, client-safe DTO. |
| 28 | Favorite creation | Eligible owned product order/line, idempotent result | `POST /api/favorites` | Implemented through a security-definer RPC for client-owned eligible order items. The route returns the raw composite row and maps most database errors to `NOT_FOUND`. | **P1:** response shape/error semantics are not the documented DTO; product-order UX currently favorites the first line. | Preserve the route; return a mapped camelCase DTO, distinguish conflict/ineligible safely, and explicitly define whether favorite identity is product-order or source-line based. |
| 29 | Favorite refresh | Owned favorite, forced provider refresh, immutable snapshot, availability/SKU match states, 15-minute expiry | `POST /api/favorites/:id/refresh` | Route exists but is not usable as written against the included migrations: `client_favorites` revokes authenticated table access and exposes no SELECT policy, while the route reads it with the user-scoped client. It always stores `resolved` + `selection_required`; unavailable/manual-review/matched states and full current product/SKU response are incomplete. Persistence also upserts the historical provider identity. | **P0** for Repeat Order. | Move ownership lookup/refresh creation into a narrowly scoped authorized server service/RPC, implement every documented state, and make the fresh product snapshot revision-safe. Do not broadly grant table access or bypass ownership. |
| 30 | Repeat-order estimate | Valid refresh ID, current SKU, new authoritative estimate and provenance | Documented `POST /api/favorites/:id/estimates`; route absent | No complete endpoint. Current refresh does not provide enough verified current selection data, and estimates lack favorite provenance fields in the active API. | **P0** if Repeat Order remains in MVP. | Add the documented endpoint after immutable refresh and canonical multi-SKU estimate decisions. Derive client identity and verify favorite/refresh/SKU/expiry server-side. |
| 31 | Notifications | Recipient-owned paginated inbox, unread count, mark read, entity links | `GET /api/notifications`; `POST /api/notifications/:id/read` | Inbox/read state are implemented with recipient-only RLS. Current producers cover payment proof, wallet shortfall, reservation release, and wallet correction; most fulfillment events and native push contracts are absent. | **P1:** event coverage and authorized entity destinations are incomplete. **P2:** device registration/push/preferences. | Keep inbox routes. Add missing durable business events as their lifecycle sources mature; add push registration later without putting sensitive data in payloads. |
| 32 | Account/profile | Safe profile/client business data, pickup summary, account status | Supabase Auth plus web-only session/layout reads; no client profile API | Web shows name/email from auth metadata and deliberately disables editing. Client table has business/pickup fields, but there is no protected DTO. | **P0:** read-only mobile account/bootstrap data missing. **P3:** editing remains undecided. | Include safe read-only fields in `/api/client/bootstrap` or add `GET /api/client/profile`. Do not authorize from `user_metadata`; do not add PATCH until editable fields/audit rules are approved. |
| 33 | Settings/help data | Approved preferences, policy/help content version, support contacts | No settings/help API; public Next pages exist for product rules, restrictions, shipping, and contact | Static web content is not a native JSON contract. Notification preferences, language, theme sync, biometrics, and device/session settings are not backend capabilities. | **P2:** versioned help/support content if server-managed freshness is required. **P3:** account/preferences contracts. | Bundle only approved stable help copy initially or add one cacheable versioned content endpoint. Keep device-only preferences local; add server settings only after product/privacy decisions. |

## Multi-SKU ordering determination

### What works now

`POST /api/orders/confirm` accepts one `productId` and a `lines` array of 1-500 `{ skuId, quantity }` entries. `confirmMultiSkuOrder` resolves the authenticated client's client record, rejects a mismatched optional `clientId`, then invokes the service-role-only `confirm_multi_sku_order` database function.

That function:

- validates the actor's active profile and role;
- verifies a client actor owns the selected client record;
- locks the client, product, SKUs, and idempotency record as required;
- validates each SKU belongs to the product and that stored availability covers the quantity;
- calculates current server-side totals using stored SKU prices, the current saved exchange rate, and the server-selected tariff;
- inserts all SKU-level `order_items`, wallet reservations, uncovered amounts, and one idempotency response snapshot in the same database transaction; and
- causes all lines from the submission to share one `product_order` through the current insert trigger/submission key.

Therefore, current mobile order creation would use **one HTTP request**, not one request per SKU. If the database function fails, its writes roll back together. Retrying the same client/idempotency key returns the saved line result rather than creating another order.

### What does not work now

- The server-calculated multi-SKU total is returned only after order/reservation creation. Before confirmation, the current web screen calculates a "live estimate" locally using `calculateLogisticsEstimate`, a hard-coded display exchange rate, and a copied tariff list. That is explicitly unsuitable for mobile authority.
- `POST /api/estimates` persists only one SKU estimate. Accepting several estimates would require several requests and does not define one atomic product submission.
- No approved object binds a reviewed multi-SKU estimate, its expiry, current provider revision, wallet preview, and later confirmation.
- Confirmation checks the persisted product/SKU rows but does not force a fresh provider lookup or prove the age of those rows.
- The request schema permits the same `skuId` more than once. The database function checks each line separately instead of validating the aggregate quantity for that SKU.
- An existing `(client, idempotencyKey)` returns its saved result without comparing the new request to the original snapshot. Reusing a key with changed product, lines, weight, or tariff is not reported as a conflict.
- The confirmation response returns order-item IDs and retired null group fields, but not the `product_order` identifier/number that the client UX uses as the submission boundary.

### Required P0 decision

Choose and document one canonical server-authoritative path before implementing the mobile estimate/confirm UI. The smallest compatible direction is an additive multi-SKU quote/estimate operation plus an additive request variant on the existing confirmation route. The accepted quote must be immutable, time-bounded, session-owned, and either revalidated or explicitly rejected when product/SKU/provider inputs change. Existing single-SKU estimate acceptance and direct confirmation must remain available until current web callers are migrated deliberately.

This analysis does not select the persistence design or table structure for that quote. That belongs in a separately approved backend phase.

## Features already usable through HTTP

Subject to shared response schemas and real bearer-session verification, these existing capabilities do not require a new business system:

- Authenticated product URL resolution and normalized product/SKU response.
- Public supplier image URLs returned with products and order cards.
- Local multi-SKU selection using framework-neutral helpers.
- Atomic direct multi-SKU order creation with idempotency and partial wallet reservation.
- Client product-order cards grouped by `product_order_id`.
- Wallet totals and filtered/paginated ledger entries.
- Active payment instructions, payment-proof upload/history, and own-pending proof cancellation.
- Product Statement filters, fixed 30-row pages, and chart metrics.
- Favorite creation and archival from an eligible client order, although the response contract needs cleanup.
- Recipient-owned in-app notifications, unread count, and mark-read action.

“Usable” here means the server capability exists. It does not override P0 contract extraction, native bearer, RLS, provider, or deployment verification.

## P0 gaps

### P0-1: Client bootstrap and read-only account identity

There is no endpoint that lets a native client exchange a valid bearer session for a safe, active client profile and client business identity. Every protected route checks auth, but mobile needs one explicit gate before rendering client navigation.

Minimal change: add a session-derived `GET /api/client/bootstrap` with a narrow response schema. It should expose only safe profile/client fields and capability/contract versions needed by the app. Authorization must come from the database-backed profile status/role, not `user_metadata`.

### P0-2: Shared, validated mobile wire contracts

Important route validators are local to route files; many responses have no runtime schema. Order cards and Product Statement use `unknown[]`. The wallet documentation and runtime shape disagree. Building screens against inferred component types would duplicate and freeze these inconsistencies.

Minimal change: extract framework-neutral Zod request/response schemas for bootstrap, product resolve, canonical estimate/confirm, order list/detail, wallet, payment proof, statement, favorites, and notifications. Keep `NextResponse` creation in the web app and add contract tests around every route.

### P0-3: Canonical authoritative multi-SKU estimate and confirmation

The current API has two incompatible workflows: persisted single-SKU estimate acceptance and direct multi-SKU order creation. The latter is atomic but cannot power the required authoritative review-before-confirm screen.

Minimal change: approve and add a multi-SKU estimate/quote contract, remove authoritative client identity from the new request variant, require unique SKU lines, bind idempotency keys to a canonical request fingerprint, and extend confirmation to consume the quote while retaining the old request shapes.

### P0-4: Canonical product-order list and detail

The current card RPC proves the grouped read model exists, but its transport is untyped and unpaginated. The documented list/detail routes do not exist, and no owned detail/timeline endpoint can resolve a notification/deep link.

Minimal change: define typed `GET /api/orders` and `GET /api/orders/:productOrderId` responses based on `product_orders`. The list can coexist with `/api/client/order-cards`; detail must return server-derived action eligibility rather than asking mobile to recreate status rules.

### P0-5: Favorites/Repeat Order, if retained in MVP

There is no favorites list or repeat-estimate endpoint. The refresh route is incomplete and its initial user-scoped read conflicts with table privileges in the current migrations. Product persistence is not revision-safe.

Minimal change: either remove Favorites/Repeat Order from the approved MVP scope or implement the protected list, authorized refresh states, immutable product revision, and repeat-estimate contract before its UI begins.

### P0-6: Typed Product Statement and wallet/account response truth

The Product Statement is operational but its response is not typed, and its API documentation contains an unrelated response example. The wallet runtime/documented shapes differ. These financial surfaces cannot be implemented safely from guesses.

Minimal change: document and validate the existing runtime behavior, choose a precise money wire convention, and preserve all current financial calculation and historical-rate behavior.

## P1 gaps

- **Dashboard summary:** the existing lists can prototype Home, but production should not download every order plus ledger/inbox pages merely to show a few counts.
- **Order list scale:** current order cards have no server pagination or filters.
- **Order cancellation decision:** the status machine allows a client cancellation at `pending_admin_review`, while no route defines product-order scope or reservation release.
- **Order/refund visibility:** client detail must show linked refunds/corrections even if refund initiation remains admin-led.
- **Wallet transaction detail:** required only if the product approves a standalone/deep-linked detail screen; list entries already contain most fields.
- **Native payment upload contract verification:** multipart proof submission must be tested with a real bearer token and React Native `FormData` without weakening private storage.
- **Immutable product revisions:** required before production historical integrity and mandatory for Repeat Order.
- **Product image reliability:** define public/private URL and fallback semantics; add a proxy only if evidence justifies it.
- **Notification coverage:** current durable events are financial. Order, provider, QC, shipping, and pickup events remain incomplete.
- **Contract/deployment verification:** execute bearer, cross-client, RLS, idempotency, malformed-envelope, provider-failure, and live migration parity checks in the implementation phase.

## P2 and P3 gaps

### P2 optimizations/enhancements

- Count-only notification calls if the dashboard aggregate does not include unread count.
- Server-specified variant display order/localization when client derivation proves insufficient.
- One-row Product Statement refresh/deep-link endpoint if navigation requires it.
- Versioned, cacheable help/support content.
- Device registration, push delivery, notification preferences, and deep-link payload contracts after the durable inbox and destination APIs are complete.

### P3 future decisions

- Client order editing or modification.
- Client-initiated refund/dispute workflow and its consent/approval statuses.
- Profile/pickup editing and server-synchronized settings.
- Language, analytics/consent, device/session management, biometric policy, and other account preferences not already approved.

## Mobile request consolidation analysis

### App launch

Supabase Auth restores the local session, but the app still needs the backend to verify active profile/client role. The proposed bootstrap endpoint is justified because no existing client route returns safe profile/business identity, and using an arbitrary business endpoint as the auth gate would couple navigation to that feature.

Recommended launch sequence:

1. Restore/refresh the Supabase session locally.
2. Make one `GET /api/client/bootstrap` request.
3. Enter the authenticated client router only after that response succeeds.
4. Load the selected tab's data independently.

Do not put orders, wallet history, statement pages, or notification pages into bootstrap. That would slow every launch and make unrelated partial failures invalidate authentication.

### Dashboard

Without a summary endpoint, a useful Home screen would need at least:

- `GET /api/wallet` for balance, while also downloading a ledger page;
- `GET /api/client/order-cards` for attention/recent orders, while downloading the full order history;
- `GET /api/payments` for recent proof state;
- `GET /api/notifications` for unread/recent events; and potentially
- a Product Statement page for aggregate metrics that should not be reconstructed by the client.

This is four or five requests, including two materially over-broad reads, not twelve independent calls. A consolidated endpoint is still justified for production because the order-card request grows without bound and the mobile client must not synthesize financial/attention totals from separate pages.

Recommended `GET /api/client/dashboard` scope:

- canonical wallet totals only;
- counts for active, pending-review, needs-attention, pending-payment, and pickup-ready product orders;
- at most a small fixed number of recent product-order summaries;
- pending/needs-review payment-proof count and latest status;
- notification unread count and at most a small fixed number of recent notifications;
- one server timestamp and partial-section/error metadata if the implementation chooses graceful degradation.

It must not duplicate full order, ledger, payment, notification, or statement payloads. It should call existing server services/RPC logic, not reimplement wallet or order calculations.

### Feature screens

Keep Orders, Wallet, Product Statement, Favorites, and Notifications independently paginated and cached. A single “mobile everything” endpoint would create excessive coupling, poor invalidation behavior, and a larger sensitive payload.

## Contract and architecture conflicts

1. **Retired groups versus live response fields.** `product_orders` is now the client submission boundary and new order items have null `group_id`, yet estimate acceptance and direct confirmation still return `groupId`/`groupCode`. The new mobile DTO should add product-order identity and treat group fields as deprecated compatibility fields.
2. **Estimate-first product requirement versus direct confirmation.** The persisted API is one estimate per SKU; the atomic path creates orders before returning the combined calculation. Neither alone implements the approved mobile journey.
3. **Session-derived identity versus `clientId`.** Estimate creation and acceptance require it; direct confirmation accepts it optionally. Some services validate the mismatch, but the mobile contract should not ask the client to assert its own identity.
4. **Fresh provider truth versus persisted-row confirmation.** Product resolution can be fresh at one point, but confirmation later locks and validates only the persisted product/SKU rows. No freshness token or provider revision binds the two operations.
5. **Historical snapshots versus provider upsert.** `supabase-product-repository.ts` upserts `product_links` by `(provider, provider_item_id)` and updates matching SKU rows. This conflicts with immutable historical product and Favorite refresh requirements.
6. **Documented order APIs versus repository routes.** `GET /api/orders` and `GET /api/orders/:id` are documented but absent. `/api/client/order-cards` is the actual unpaginated web read model.
7. **Favorite specification versus permissions/implementation.** `GET /api/favorites` and `POST /api/favorites/:id/estimates` are absent. The refresh route reads a table for which authenticated access is revoked, and it does not implement all refresh states.
8. **Client cancellation transition versus API absence.** The status machine permits a client to cancel `pending_admin_review`; no endpoint defines line/product-order atomicity, reservation release, or idempotency.
9. **Wallet documentation versus runtime envelope.** Documentation shows totals directly in `data`; the route returns `data.totals`. Field names in documented transaction examples also differ from runtime DTO names.
10. **Product Statement documentation defect.** The implemented endpoint returns `data: rows[]` and chart/pagination metadata, while the current API contract section contains an unrelated order-update response example.
11. **Role declarations versus RPC behavior.** Several routes use `CLIENT_OPERATION_ROLES` (`client`, `admin`, `super_admin`) even where underlying security-definer functions enforce client-only access. This does not block the client app, but the advertised role contract is broader than implementation.
12. **Current web display calculation versus mobile architecture.** The web direct-confirm screen imports the authoritative calculation module and uses a hard-coded display rate of `19.2`. Mobile architecture explicitly prohibits bundling that financial engine or rate/tariff copies; a server quote is required.
13. **Idempotency key versus request identity.** Direct confirmation keys are unique per client, but replay does not verify that the product, lines, weight, and tariff match the original request. A changed payload with an old key silently receives the old result.
14. **Duplicate and stale SKU validation.** Neither the route schema nor RPC rejects duplicate SKU IDs, so stock is checked per duplicate line rather than in aggregate. Product refresh also leaves formerly stored, no-longer-returned SKUs in place.

## API security and compatibility requirements

Every future backend work item in this document is subject to all of these requirements:

- Add routes, optional request variants, and response fields; do not rename or remove existing routes/fields while web or extension consumers still use them.
- Use the existing `{ data, meta }` and `{ error: { code, message, details } }` envelopes.
- Authenticate first, verify the active database profile/role, derive client ownership from the session, and return `404` where needed to avoid cross-client disclosure.
- Keep RLS as defense in depth. Do not grant broad table access merely to make a route work.
- If a route uses the service-role client, perform explicit server authorization/ownership first and retain equivalent validation inside the privileged database operation.
- Never expose `SUPABASE_SERVICE_ROLE_KEY`, provider credentials, raw provider payloads, private storage paths, audit internals, risk flags, or admin-only data.
- Preserve append-only ledger behavior, linked corrections, historical rates, wallet reservations, purchase-time commitment, and non-negative available balance.
- Preserve immutable estimate/order/product snapshots and SKU-level operational truth.
- Require idempotency or authoritative reconciliation for order, cancellation, proof, and other consequential mutations.
- Validate request and response payloads with shared Zod schemas; do not treat TypeScript annotations as runtime validation.
- Keep current web behavior covered by compatibility and contract tests before mobile consumes an additive path.

## Recommended Backend Work Before UI

The order below is dependency-driven. Business UI should not start against provisional shapes.

### 1. Approve canonical identities and wire rules

- Confirm `productOrderId`/order number as the client order identity and SKU `orderItemId` as the operational line identity.
- Deprecate, but do not remove, group fields from new-client responses.
- Approve money/decimal wire representation, timestamp format, page metadata, error codes, and action-capability representation.
- Decide the canonical multi-SKU estimate/expiry/acceptance behavior and whether every confirmation must perform or validate a fresh provider revision.

### 2. Establish shared route contracts

- Create framework-neutral Zod schemas/DTOs for the approved mobile routes.
- Correct wallet and Product Statement documentation to match runtime or deliberately add a backwards-compatible response version.
- Add negative contract tests for malformed response data and cross-client identifiers.

### 3. Add the session-derived bootstrap boundary

- Implement `GET /api/client/bootstrap` using the existing authorization resolver and database-backed profile/client records.
- Test bearer token success, expired token, inactive profile, wrong role, missing client record, and absence of private/admin fields.

### 4. Resolve the multi-SKU estimate/confirmation P0

- Add the approved authoritative multi-SKU estimate/quote operation.
- Add a session-derived confirmation variant consuming that reviewed result and current idempotency behavior.
- Reject duplicate SKU IDs or aggregate them before stock validation, and compare every idempotent retry to a canonical request fingerprint.
- Bind confirmation to an approved product/provider revision and make unavailable/removed SKUs fail safely.
- Return `productOrderId`, order number, line IDs, wallet coverage, warnings, expiry/freshness outcome, and replay status.
- Keep existing `/api/estimates`, estimate acceptance, and direct/legacy `/api/orders/confirm` payloads compatible.

### 5. Add typed product-order reads

- Implement paginated/filterable product-order list behavior.
- Implement owned product-order detail with line summaries, client-safe status events/timeline, financial provenance, wallet/refund references, and action eligibility.
- Ensure notification entity links resolve only through this owned detail boundary.

### 6. Make product refresh revision-safe and complete Repeat Order

- Resolve immutable product/SKU revision persistence before any favorite refresh can authorize an estimate.
- Add Favorites list, repair authorized refresh lookup, implement all refresh/SKU match states, and return current normalized product data.
- Add repeat-estimate creation only after the canonical estimate model is approved.

### 7. Decide consequential client actions

- Decide whether MVP/production includes client cancellation from `pending_admin_review` and whether it applies to a product order or selected lines.
- If approved, implement an atomic idempotent cancellation plus reservation release/audit response.
- Keep refund/dispute initiation admin/support-led until its product/status contract is approved; expose posted results in detail reads.

### 8. Stabilize financial/report DTOs

- Export exact wallet, transaction, payment-proof, and Product Statement schemas.
- Add a wallet transaction detail endpoint only if a separately refreshable/deep-linked screen is approved.
- Verify every historical rate and actual/estimated/partial field survives serialization without client recomputation.

### 9. Add the dashboard aggregate after source contracts stabilize

- Implement one bounded summary read using the canonical order/wallet/payment/notification sources.
- Do not use the dashboard response as a substitute for full feature endpoints.

### 10. Complete production verification

- Run route contract, authorization, cross-client/RLS, idempotency, wallet reconciliation, provider failure/freshness, and private-file tests.
- Verify a real native-issued Supabase bearer token against every client route.
- Verify linked migration parity and current provider behavior without exposing secrets.
- Run existing web typecheck, lint, tests, and production build after each implementation step.

## Proposed interface inventory

This is an analysis inventory, not authorization to implement exact paths before contracts are approved.

| Proposed interface | Priority | Additive purpose | Compatibility rule |
| --- | --- | --- | --- |
| `GET /api/client/bootstrap` | P0 | Active client/profile bootstrap and safe account summary | New route; no web route changes. |
| Canonical multi-SKU estimate/quote operation | P0 | Server-authoritative review before order mutation | New operation or optional schema branch; retain single-SKU estimates. |
| Extended `POST /api/orders/confirm` request/response | P0 | Consume approved quote; session identity; return product-order identity | Preserve direct and legacy request branches and existing response fields. |
| `GET /api/orders` | P0/P1 | Typed product-order list, then pagination/filters | Add documented route; keep `/api/client/order-cards` for current web. |
| `GET /api/orders/:productOrderId` | P0 | Owned product-order detail/timeline/actions | New route using product-order identity. |
| `GET /api/favorites` | P0 if in MVP | Active favorites list | Add GET to existing route file; keep POST behavior. |
| Completed favorite refresh response | P0 if in MVP | Immutable current product/SKU state and refresh outcome | Preserve route; make behavior/DTO complete. |
| `POST /api/favorites/:id/estimates` | P0 if in MVP | Fresh repeat estimate with provenance | New documented route after estimate decision. |
| Product-order cancellation operation | P1/conditional P0 | Valid pending-review cancellation and reservation release | New route only after product decision; no status shortcuts. |
| `GET /api/wallet/transactions/:id` | P1 if deep-linked | Fresh owned ledger detail | New optional route; list remains unchanged. |
| `GET /api/client/dashboard` | P1 | Bounded home summary | New route; does not replace feature endpoints. |
| Help/content and push/device interfaces | P2/P3 | Versioned content and later native delivery | Feature-gated; no sensitive push payloads. |

## Evidence inspected

### Routes and services

- `lib/auth/api.ts`, `lib/auth/session.ts`, `lib/supabase/server.ts`, and `lib/api/response.ts`.
- Product resolve route plus product resolution/provider/repository services.
- Estimate create/accept/reject routes and estimate services/repository.
- Direct confirmation route, order confirmation service, and current confirmation/product-order migrations.
- Client order-card and Product Statement routes/services/RPCs.
- Wallet, payment-instruction, payment history/proof/cancellation routes and wallet services/RPCs.
- Favorites create/archive/refresh routes and migrations.
- Notification inbox/read routes, service, RLS, and current financial event producers.
- Current client dashboard, account, order, wallet, notification, statement, and new-order web surfaces only where they revealed the actual data boundary.

### Verification limits

- No API route, service, schema, migration, or application file was changed.
- No dependency was installed and no mobile project/screen was created.
- No database reset/push, linked-project inspection, provider request, payment upload, or real bearer-token request was run.
- This analysis relies on the current repository and migrations. Static source/tests do not prove production deployment parity or live provider behavior.
- Existing Phase 1 typecheck/lint/test results were not rerun because Phase 3 changes documentation only.

## Conclusion

The backend has a strong reusable core, especially atomic direct multi-SKU confirmation, product-order grouping, wallet accounting, Product Statement aggregation, payment proofs, and in-app notifications. The mobile UI should not begin against the current inferred shapes, because the authoritative multi-SKU review flow, bootstrap, typed product-order list/detail, and—if retained—Favorites/Repeat Order remain P0 gaps.

Complete the ordered backend contract work above in separately approved phases, preserve the existing API consumers, and then begin mobile screens only after those responses have shared schemas and passing authorization/contract tests.
