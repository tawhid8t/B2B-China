# Mobile Readiness Repository Audit

Status: Phase 1 audit only  
Audit date: 2026-09-01  
Target: future client native mobile application

This audit assesses the real current repository rather than relying on historical audit documents. It does not authorize mobile implementation, dependency installation, schema or API changes, or refactoring. `docs/AGENTS.md`, `docs/mobile/MOBILE_PRODUCT_SPEC.md`, and the existing business, status, database, API, and architecture documents remain authoritative.

The requested root-level `AGENTS.md` and `IMPLEMENTATION_CHECKPOINTS.md` do not exist. Their current repository locations are `docs/AGENTS.md` and `docs/IMPLEMENTATION_CHECKPOINTS.md`.

## Assessment rubric

- **Exists — Yes:** a current route, module, migration, or executable behavior was found.
- **Exists — Partial:** only part of the required capability is present.
- **Production-ready — Yes:** the current repository shows a complete relevant contract, authorization, failure handling, and meaningful tests for safe mobile consumption.
- **Production-ready — Partial:** substantial implementation exists, but a contract, lifecycle, deployment proof, or client-critical behavior remains incomplete.
- **Mobile reusable — Yes:** the capability is usable through a suitable authenticated HTTP boundary or the module is demonstrably framework-neutral.
- **Mobile reusable — Partial:** useful logic exists but must be extracted, typed, packaged, or kept behind a revised HTTP contract.
- **Mobile reusable — No:** the implementation depends directly on Next.js, React DOM/browser behavior, Node-only APIs, server secrets, or database/service-role context.

“Production-ready” in this document means ready for safe consumption by a future native client. Passing a source inspection test alone is not sufficient.

## Capability summary

| Capability | Exists | Production-ready | Mobile reusable | Work required |
| --- | --- | --- | --- | --- |
| Authentication | Yes | Partial | Partial | Supabase password auth and server verification exist. Define native secure token storage, refresh/recovery, auth redirects/deep links, and device/session behavior. |
| Authenticated bearer API access | Yes | Partial | Yes | `lib/supabase/server.ts` forwards an `Authorization` header. Verify end-to-end with a real native-issued access token and every client route. |
| Product resolve | Yes | Partial | Yes, through API | Keep provider credentials and persistence server-side; verify production OTAPI/RapidAPI configuration and immutable snapshot behavior. |
| Product/SKU normalization | Yes | Partial | Partial | Pure normalization exists, but it is colocated with environment access and provider fetch logic. Keep authoritative normalization server-side or extract pure fixtures/contracts. |
| SKU/variant selection | Yes | Yes for local selection behavior | Yes | Package `lib/product-sku-selection.ts` and `lib/product-variant-selection.ts` with portable imports and shared DTOs. Server must still revalidate stock and price. |
| Multi-SKU selection | Yes | Partial | Partial | Selection and direct confirmation exist, but the persisted estimate lifecycle remains single-SKU. Resolve the canonical mobile flow. |
| Estimate calculation | Yes | Partial | Partial | Fixed-point calculator is portable, tested logic, but authoritative calculation must remain server-side. Export shared display/result types without duplicating financial authority. |
| Persisted estimate | Yes | Partial | Yes, through API | Resolve session-derived client identity, multi-SKU behavior, expiry automation, and contract/schema sharing. |
| Order confirmation | Yes | Partial | Yes, through API | Direct multi-SKU confirmation and idempotency exist. Remove contract ambiguity around `clientId`, estimate-first UX, and legacy group response fields. |
| Order list/read model | Yes | Partial | Yes, through API | `/api/client/order-cards` exists but returns weakly typed `unknown[]`; document and export a stable DTO with pagination/filter policy. |
| Order detail/timeline | Partial | No | No stable boundary | Web cards contain detail-like data, but no canonical client order-detail endpoint exists. Define owned product-order detail and timeline response. |
| Order modification | No | No | No | Current rules authorize admin editing, not client editing. Obtain a business decision before defining mobile behavior. |
| Order cancellation | Partial | No | No | Status rules mention client cancellation at `pending_admin_review`, but no client API or atomic product-order/reservation behavior exists. |
| Refund/dispute | Partial | No | No | Wallet refund/correction primitives exist for admins; no client request, consent, dispute, or refund-status contract exists. |
| Wallet statement | Yes | Yes for implemented ledger scope | Yes, through API | Export stable wallet DTOs and verify bearer access/live deployment; retain server authority and pagination. |
| Funding/payment proof | Yes | Partial | Yes, through API | Multipart proof, history, instructions, and pending-proof cancellation exist. Design native file picking/upload progress and signed-file handling. |
| Favorites | Partial | No | Partial | Create/archive and refresh routes exist; active favorites listing is absent and current route types are not shared. |
| Repeat Order | Partial | No | No complete boundary | Refresh persistence exists, but favorite estimate creation and complete current-SKU response states are missing; immutable snapshot conflict remains. |
| Product Statement | Yes | Partial | Yes, through API | The protected 30-row read model exists, but row/category types are `unknown[]`; define a stable typed mobile response and verify deployed RPC. |
| Notifications | Yes for in-app wallet/payment events | Partial | Yes, through API | Inbox/read routes exist. Remaining business events, native push, device tokens, preferences, and deep links are absent. |
| Private image/file storage | Partial | Partial | Partial | Payment-proof storage protections exist. Native signed access, product-image caching, upload abstraction, and other private buckets are not verified as complete. |
| API response envelopes | Yes | Partial | Partial | Standard runtime envelopes exist, but helpers depend on `NextResponse`; export framework-neutral DTO/schema definitions and a mobile decoder. |

## 1. Current repository snapshot

### Structure

The repository is one Next.js application, not a workspace or monorepo. Major roots are:

- `app/` — Next.js pages, layouts, and API route handlers.
- `components/` — React web components, including the current client portal.
- `lib/` — domain constants/types, auth helpers, Supabase clients, selection helpers, and utility code.
- `services/` — product, estimate, order, wallet, statement, notification, and admin server services.
- `supabase/` — migrations, configuration, and SQL tests.
- `extension/` — the admin purchasing Chrome extension.
- `tests/` — Node test suites, many of which inspect source and migration content.
- `docs/` — authoritative specifications and implementation checkpoints.

There is no `apps/mobile`, `packages/contracts`, `packages/domain`, workspace manifest, mobile build configuration, or mobile-specific API client.

### Package and TypeScript configuration

`package.json` describes one private package with Next.js 15, React 19, TypeScript, Zod, `@supabase/ssr`, and `@supabase/supabase-js`. It has no `workspaces` field. Dependencies are installed locally, but no mobile runtime or native toolchain is present.

`tsconfig.json` is a Next-oriented configuration:

- `moduleResolution: "bundler"`, DOM libraries, JSX preservation, Next plugin, and `.next/types` inclusion.
- Root alias `@/*`, which assumes repository-root resolution and is not a published package boundary.
- `extension` is excluded; all other TypeScript is compiled as one application.
- No project references, separate server/client configs, generated database types, or contracts-only compile target exist.

The repository currently contains `.next`, `node_modules`, and `tsconfig.tsbuildinfo`, but those are build/install artifacts rather than reusable architecture.

## 2. Current backend maturity

The backend is materially developed for the implemented web client:

- Next.js route handlers provide product resolution, estimate creation/lifecycle, direct multi-SKU confirmation, client order cards, Product Statement, wallet/funding, favorites actions, notifications, and administrative/warehouse workflows.
- Supabase Postgres functions implement important transactional and read-model behavior, including estimate lifecycle, order confirmation, wallet reservations/commitment, statements, product-order grouping, favorites, and protected aggregates.
- Migrations show additive evolution and substantial RLS hardening.
- Server services centralize important database operations and provider boundaries.

Maturity is uneven for native-mobile requirements:

- Several capabilities are implemented but not exposed as stable, exported, typed contracts.
- Some documented APIs are absent while current web-specific replacement endpoints exist.
- Some implementation checkpoints remain partial or blocked, especially provider finalization, warehouse/shipping lifecycle, expiry automation, and non-wallet notifications.
- Local migration files and static tests do not prove that every migration is deployed to the production Supabase project.
- No live provider, database reconciliation, build, or production environment check was performed in this audit.

Overall backend readiness is **partial but substantial**: the financial foundation and current client reads are stronger than client order lifecycle actions and portable contract maturity.

## 3. Current authentication maturity

### Present behavior

- Web sign-in uses `supabase.auth.signInWithPassword`; registration, password reset/update, and sign-out use the browser Supabase client.
- `lib/auth/session.ts` verifies Supabase claims using `auth.getClaims()`, then loads the profile role/status from Postgres. Inactive or invalid profiles fail closed.
- API authorization uses centralized role checks and standard `UNAUTHORIZED`/`FORBIDDEN` responses.
- Route layouts enforce page roles. `middleware.ts` intentionally does not perform authentication and simply allows the request through to layout/API enforcement.
- Client provisioning behavior is covered by migrations and tests.
- `lib/supabase/server.ts` passes an incoming `Authorization` header to the Supabase SSR client, which is the key existing path for native bearer requests.

### Mobile implications

- The web browser client and cookie flow are not directly reusable in native code.
- There is no native secure-storage adapter, app lifecycle refresh strategy, password-recovery deep link, email-confirmation deep link, account switching, revoked-session handling, or device/session management.
- `@supabase/ssr` is a web/server package; a native app would use a native-compatible Supabase client and secure persistence while calling the same protected backend.
- Bearer compatibility is promising but is not proven end-to-end against every client API with a real access token.
- Client identity is correctly derived in many services/RPCs, but estimate and confirmation contracts still accept or require `clientId`, creating a security-contract inconsistency even where server checks may reject mismatches.

Authentication is **implemented for web and partially ready for mobile integration**, not a reusable native session implementation.

## 4. Existing client APIs

The following current routes are relevant to a native client:

| Method and route | Current purpose | Mobile assessment |
| --- | --- | --- |
| `POST /api/products/resolve-link` | Authenticated provider resolution and persisted product/SKU snapshot | Reusable through HTTP; server/provider availability must be verified. |
| `POST /api/products/preview-link` | Unauthenticated cached preview without persistence | Not sufficient for authenticated orders or fresh financial validation. |
| `POST /api/estimates` | Create one persisted SKU estimate | Reusable with contract fixes; currently requires `clientId`. |
| `POST /api/estimates/:id/accept` | Accept estimate and create order data | Reusable with identity/group response cleanup; currently accepts `clientId`. |
| `POST /api/estimates/:id/reject` | Reject a persisted estimate | Reusable; ensure reason and idempotency contract is exported. |
| `POST /api/orders/confirm` | Direct one-product, multi-SKU confirmation with idempotency and wallet reservation | Valuable mobile boundary, but conflicts with estimate-first vision and exposes legacy fields. |
| `GET /api/client/order-cards` | Current client-owned product-order read model | Reusable after formal DTO, pagination/filter, and detail policy. |
| `GET /api/client/product-statement` | Filtered 30-row Product Statement and chart | Reusable after strongly typing rows/categories. |
| `GET /api/wallet` | Canonical wallet totals and ledger | Reusable; supports filters and pagination. |
| `GET /api/payment-instructions` | Active funding destinations | Reusable. |
| `GET /api/payments` | Client payment-proof history | Reusable. |
| `POST /api/payments/proof` | Multipart private proof submission | Reusable with native upload UX and transport verification. |
| `POST /api/payments/:id/cancel` | Cancel an owned pending proof | Reusable. This is not order cancellation. |
| `GET /api/payments/export` | Client payment-history CSV | Technically callable; mobile download/share policy is undecided. |
| `POST /api/favorites` | Create favorite from an eligible order item | Reusable but incomplete without a list endpoint. |
| `DELETE /api/favorites/:id` | Archive a favorite | Reusable. |
| `POST /api/favorites/:id/refresh` | Fresh provider resolution and refresh record | Partial response/behavior relative to the feature specification. |
| `GET /api/notifications` | Paginated recipient-owned inbox | Reusable. |
| `POST /api/notifications/:id/read` | Mark owned notification read | Reusable. |

Documented `GET /api/orders`, `GET /api/orders/:id`, and `POST /api/favorites/:id/estimates` are not present. No client order modify, order cancel, refund request, dispute, account update, settings, device-token, or push-preference endpoints were found.

Most request Zod schemas are declared privately inside route files. A mobile client cannot import or generate stable input/output types from them. Runtime responses use the standard envelope, but response DTOs are usually inferred locally or represented weakly.

## 5. Existing product/order/wallet capabilities

### Product/provider and SKU data

`services/product-provider-service.ts`:

- Recognizes 1688, Taobao, and Tmall URLs, mapping Tmall through the Taobao provider family.
- Normalizes 1688 item identifiers and provider payloads.
- Produces images, category, delivery amount, price range, and normalized SKU attributes, price, availability, and image.
- Rejects malformed configurable data rather than fabricating a selectable SKU, while supporting a default SKU for genuinely non-configurable products.
- Uses a 15-second provider timeout and reads provider credentials/environment settings server-side.

`services/product-resolution-service.ts` separates provider resolution from a persistence repository and records integration attempts. This is sound server architecture, but snapshot revision safety remains unresolved for Repeat Order.

### Estimate engine

`services/estimate-calculation-service.ts` is the strongest framework-neutral business module. It uses fixed-point/BigInt-style decimal handling, validates persisted configuration, snapshots references, supports profit/shipping variants, and exposes expiry checks. Its tests cover rounding, historical stability, multiple SKU logistics inputs, and invalid data.

`services/estimate-service.ts` and `services/supabase-estimate-repository.ts` add server/database coupling. The persisted estimate API remains one SKU per estimate. The web product page also performs a local live calculation before direct confirmation; that display behavior must not become a second mobile financial authority.

### Order creation and lifecycle

- Direct confirmation accepts one persisted product with one or more SKU lines, an estimated unit weight, shipping tariff choice, and idempotency key.
- The server loads authoritative SKU prices/settings, creates a `product_order`, creates SKU-level `order_items`, snapshots cost inputs, reserves up to available wallet product-cost funds, and returns uncovered cost warnings.
- Admin product-order confirmation advances every line through `confirmed` to `queued_for_purchase` atomically.
- Status constants and client mappings exist, but client-facing display labels are largely embedded in components rather than exported as a framework-neutral mapping.
- Client order cards are grouped by product order and include SKU detail, cost state, favorite state, and wallet coverage through a database read model.
- No canonical client product-order detail/timeline endpoint or client lifecycle mutation boundary exists.

### Wallet

The wallet is the most mature client capability:

- Append-only transactions and linked corrections.
- Total funds, active reservations, available balance, running balances, and filtered/paginated statement.
- Partial reservation without negative balance.
- Reservation release and wallet-covered debit at purchase commitment.
- Private payment-proof upload, client history/cancellation, admin review, current payment instructions, CSV export, and wallet/payment notifications.
- Role and ownership checks exist in API services and migrations.

Mobile should consume wallet state only through protected APIs. None of the server wallet services should be moved into the app.

## 6. Mobile reusable modules

### Directly reusable after packaging/import cleanup

| Module | Reusable content | Conditions |
| --- | --- | --- |
| `lib/domain/constants.ts` | Roles, order/QC statuses, wallet transaction and reservation values, provider/source constants | Publish from a framework-neutral contracts package; resolve provider/source inconsistencies deliberately. |
| `lib/domain/types.ts` | Basic product/SKU and status-derived types | Remove root alias assumptions, separate obsolete/unsafe request types such as client-supplied `clientId`, and align numbers with wire-format precision policy. |
| `lib/product-sku-selection.ts` | Immutable multi-SKU selection state, stock clamping, selected lines, provisional supplier summary | Suitable for mobile UI state; server revalidation remains mandatory. |
| `lib/product-variant-selection.ts` | Variant grouping, matching, availability state, and display translation helpers | Suitable for mobile UI; translations are display-only and incomplete localization. |
| `services/estimate-calculation-service.ts` | Fixed-point calculation types/functions and expiry utilities | Technically framework-neutral and well tested, but mobile use must be limited to provisional display or shared tests; the server result remains authoritative. |

### Reusable as design/reference, not currently as a package

- `lib/auth/roles.ts` contains useful role sets and guards, but path-routing helpers are web-specific.
- `lib/shipping-tariffs.ts` is pure data/function code, but authoritative tariff validation currently happens on the server; shipping configuration should not be duplicated into a mobile release artifact without a versioned contract.
- `services/product-provider-service.ts` contains pure URL and normalization functions mixed with `process.env`, network fetch, secrets, timeouts, and development mock behavior. The entire module must remain server-side unless pure functions are separated.
- `lib/api/response.ts` contains useful envelope types, but runtime helpers return Next.js `NextResponse` objects.
- `services/notification-service.ts`, wallet statement types, and client wallet types describe useful DTOs but import server authorization/database context and are not a contracts package.

### API reuse

The preferred reuse model for product lookup, estimate persistence, order creation, wallet, statement, favorites, and notifications is the existing server API—not importing their service implementations into mobile.

## 7. Web-only modules

The following cannot be reused directly in a native application:

- Everything under `app/client/`: Next.js routes, server components, layouts, loading files, and navigation assumptions.
- `components/client/*` and `components/notifications/*`: React DOM components, HTML elements, Tailwind classes, Next navigation/link usage, browser file inputs, and desktop/mobile-web layout behavior.
- `lib/supabase/client.ts`: marked `use client` and built around `@supabase/ssr` browser behavior.
- `components/sign-out-button.tsx` and auth pages: browser Supabase client, `window.location`, browser redirects, and web forms.
- `middleware.ts`: Next.js request/response middleware and pathname matching.
- `lib/auth/safe-redirect.ts` path/browser redirect semantics, where applicable.
- `lib/ui/*`, `lib/mock-data.ts`, and public/web shell components.

Useful UX and information hierarchy may be referenced, but components, DOM structures, styling, and browser session assumptions should not be copied into a native project.

## 8. Server-only modules

The following must stay behind trusted server boundaries:

- `lib/supabase/server.ts` — Next cookies/headers and SSR client creation.
- `lib/supabase/admin.ts` — service-role key and unrestricted trusted database access.
- `lib/auth/session.ts` and `lib/auth/api.ts` — Next redirects, React cache, server authorization context, and database profile verification.
- `lib/api/*` — Next response objects and server/database error translation.
- `lib/payments/proof-upload.ts` — Node crypto and protected upload workflow.
- `lib/auth/extension-credentials.ts` — Node crypto and admin extension credentials.
- `lib/csv.ts` — Next response download behavior.
- Supabase repositories and almost all services that accept `AuthorizationContext`, Supabase clients, or create an admin client.
- Product provider network lookup and credentials, integration logging, and snapshot persistence.
- Estimate/order/wallet mutations, status transitions, audit logging, notification creation, and ownership resolution.

The mobile app may share types or call routes associated with these modules; it must never bundle their implementations, environment variables, or service-role behavior.

## 9. Missing mobile prerequisites

1. A selected native framework, supported platforms/OS versions, repository location, and build/release process.
2. A workspace/package strategy or another controlled way to distribute framework-neutral contracts.
3. Exported request/response Zod schemas or generated types for client APIs.
4. A typed mobile HTTP client with bearer auth, envelope decoding, request cancellation, retry/idempotency policy, and error mapping.
5. Native Supabase auth configuration with secure token storage, refresh, foreground/background behavior, email confirmation, password recovery, and sign-out cleanup.
6. Stable client order list and product-order detail DTOs with pagination/filter semantics.
7. Resolved multi-SKU estimate-versus-direct-confirmation product contract.
8. Order cancellation/refund/dispute decisions and endpoints.
9. Complete Favorites list and Repeat Order estimate creation.
10. Push notification/device-token/deep-link contracts.
11. Native private file upload/download contract and proof picker/progress behavior.
12. Account update/settings/help contracts.
13. Cache classification, encryption, TTL, eviction, owner isolation, migration, and offline policy.
14. Localization strategy for English, Bangla, and Chinese SKU content.
15. Mobile analytics, privacy, crash reporting, performance budgets, and release monitoring.
16. Device-level accessibility and supported-device test plan.

## 10. API gaps

### Contract and implementation mismatches

- `API_CONTRACT.md` documents `GET /api/orders` and `GET /api/orders/:id`; neither route exists. The web client instead uses `GET /api/client/order-cards`.
- `FEATURE_FAVORITES_REPEAT_ORDER.md` documents `GET /api/favorites`; the existing route implements only `POST`.
- The documented `POST /api/favorites/:id/estimates` route is absent.
- The current favorite refresh route creates a refresh record but does not implement every documented response state and complete current product/SKU response.
- Active order groups are retired, while estimate/confirmation responses and parts of the API documentation still expose `groupId`/`groupCode`.
- Estimate and acceptance requests require `clientId`; direct confirmation accepts it optionally. This conflicts with the session-derived-identity rule.
- Persisted estimate creation is single-SKU while direct confirmation is multi-SKU.

### Missing mobile-facing contracts

- Product-order detail with line timeline, cost provenance, wallet links, exceptions, and eligible actions.
- Order edit eligibility and mutation, if client editing is ever approved.
- Atomic product-order/SKU cancellation and wallet reservation release result.
- Refund/dispute request, consent, status, and client-visible history.
- Favorites pagination/list response and repeat estimate creation.
- Account/pickup details read/update and client settings.
- Push device registration, preference management, delivery payload, and deep-link routing.
- Generic safe private-file access suitable for native clients.

### Type/schema gaps

- Route Zod schemas are mostly private constants and cannot be imported by a mobile package.
- API response payload schemas are not validated or generated for consumers.
- `ClientOrderCardsResult.orders`, Product Statement rows/categories, and some database/RPC results use `unknown[]` or `any`.
- Wallet and notification types are duplicated in server services rather than exported from a contracts boundary.
- Status display mappings live partly in React components, increasing drift risk.
- Monetary wire values are often converted to JavaScript `number`; a documented native precision/formatting policy is needed even though authoritative persisted calculation is fixed-point.

## 11. Security concerns

### Positive controls found

- Central API role authorization and active-profile verification.
- RLS enabled and repeatedly hardened across core client and operational tables.
- Client-scoped RPC/read-model behavior for orders, Product Statement, and wallet.
- Recipient-only notification policy and read-only mutable field.
- Private payment-proof storage policies and restricted file types/size.
- Service-role and provider credentials confined to server environment access.
- Append-only financial corrections and audited/idempotent wallet/order operations.
- Incoming bearer authorization can be forwarded to Supabase.

### Concerns and required verification

- Native bearer behavior is inferred from implementation and has not been live-tested end-to-end.
- Client-supplied `clientId` remains in sensitive contracts; server checks reduce risk but the contract should be removed or made unambiguously non-authoritative.
- Several routes use service-role clients after server authorization. Each must continue to derive and validate ownership before privileged operations; mobile must never call Supabase tables as a substitute.
- RLS confidence is based on migration content and local tests, not a fresh deployed-project policy audit.
- The repository has an `.env.local`; it was not read. Secret presence, rotation, and accidental build inclusion were not audited in this phase.
- Signed URL lifetime, native download storage, screenshot/log redaction, clipboard privacy, proof caching, and local database encryption are undefined.
- No mobile certificate/network policy, root/jailbreak posture, biometric policy, device revocation, or privacy-safe telemetry design exists.
- Raw provider payloads and integration logs must remain inaccessible to mobile clients.

## 12. Mobile architecture constraints

- The native client must treat the Next.js/Supabase backend as the authoritative mutation and financial boundary.
- It must use a Supabase access token as a bearer credential for protected APIs, subject to explicit end-to-end verification.
- It cannot depend on Next cookies, React server components, Next route navigation, DOM APIs, Tailwind styles, or `@supabase/ssr` browser behavior.
- Shared modules must not import `next/*`, `react`, `node:*`, environment variables, Supabase server/admin clients, or root-only aliases that the mobile toolchain cannot resolve.
- Provider data, stock, price, estimate, wallet, status, ownership, and authorization require fresh server validation as defined by the mobile specification.
- Local calculations and cached values are presentation-only.
- Mobile offline support is limited to clearly stale reads and unsubmitted safe drafts; business mutations must not replay silently.
- Existing API response envelopes should remain the transport convention, but their DTOs and validators need a framework-neutral source.
- The server must preserve compatibility for the web and extension while mobile contracts are introduced or clarified.

## 13. Potential duplication risks

- Re-declaring inline route schemas in the mobile app would cause request drift.
- Copying component-local order, statement, wallet, or notification types would preserve weak and inconsistent wire contracts.
- Copying status labels from `client-order-cards.tsx`, `client-product-statement.tsx`, or other components would create mapping divergence.
- Importing `lib/pricing.ts` would reproduce older default/number-based calculation assumptions instead of the stronger persisted fixed-point engine.
- Shipping tariff data copied into mobile could become stale and might be mistaken for server authority.
- Reimplementing provider normalization in mobile would expose integration assumptions and produce different SKU identities.
- Recreating wallet totals from transaction pages could disagree with the canonical RPC.
- Copying web Supabase cookie/session behavior would be insecure or nonfunctional on native platforms.
- Reusing web UI through a WebView would couple mobile UX, storage, and navigation to browser behavior and would not satisfy the native product goal.
- Maintaining separate hand-written API clients for web and mobile without shared contracts would multiply envelope, error, pagination, and money-format bugs.

## 14. Recommended next architecture decisions

Decide these before Phase 2 implementation:

1. **Mobile platform:** choose the native framework, supported operating systems, package manager, and whether mobile lives in this repository.
2. **Repository boundary:** adopt a workspace with a framework-neutral contracts/domain package, or define an equivalent generated-contract distribution workflow.
3. **Contract ownership:** export Zod request/response schemas, DTOs, status mappings, error codes, pagination metadata, and money wire conventions from one source.
4. **API client:** define base URL/environment selection, bearer injection, refresh behavior, timeouts, cancellation, idempotency, retry exclusions, envelope decoding, and typed errors.
5. **Authentication:** define secure token storage, lifecycle refresh, sign-up/sign-in scope, recovery/confirmation deep links, account switching, and sign-out cache clearing.
6. **Ordering:** choose the canonical multi-SKU estimate and confirmation lifecycle; eliminate authoritative client IDs and legacy group fields from the mobile contract without breaking web compatibility.
7. **Order reads/actions:** define product-order list/detail DTOs, filters/pagination, timeline, action eligibility, cancellation, refund, and dispute behavior.
8. **Favorites:** complete list, refresh states, immutable snapshot strategy, SKU matching, and repeat-estimate endpoint.
9. **Files and notifications:** define native proof upload, signed access, push provider, device tokens, preferences, deep links, and notification event coverage.
10. **Local data:** define cache technology, sensitive-data classes, encryption, TTL/eviction, offline drafts, schema migrations, and owner isolation.
11. **Quality:** set accessibility, performance, network, crash-free, security, privacy, analytics, monitoring, and supported-device acceptance targets.

Pure selection helpers may be shared. Provider normalization and financial calculations should remain authoritative on the server even if pure types or provisional display helpers are distributed.

## 15. Known blockers

### Blocking a complete production mobile ordering journey

- No approved native framework/repository architecture.
- No exported mobile-safe contract package or typed API client.
- Unresolved single-SKU persisted estimate versus multi-SKU direct confirmation flow.
- Session-derived identity conflict in estimate/confirmation contracts.
- No canonical client product-order detail endpoint.
- No defined client order cancellation, refund, or dispute API/lifecycle.
- Incomplete Favorites/Repeat Order endpoints and unresolved immutable product snapshot strategy.

### Blocking specific later features, not initial read-only prototyping

- No native push/device-token/deep-link contract.
- No account editing/settings contract.
- No approved cache/security/observability architecture.
- Incomplete non-wallet notification events and downstream provider/warehouse/shipping checkpoints.
- No live verification that local migrations, RLS policies, provider configuration, and RPCs match production.

The existing wallet, product resolve, order-card, Product Statement, and in-app notification APIs are sufficient for architecture prototyping only after bearer behavior and response shapes are verified. They do not remove the blockers above for a production release.

## 16. Confidence/verification notes

### Checks executed

| Check | Result | Notes |
| --- | --- | --- |
| `npm run typecheck` | Passed | `tsc --noEmit` exited successfully. |
| `npm run lint` | Passed with warning | One `@next/next/no-img-element` warning in `components/client/client-product-statement.tsx`; no lint errors. |
| `npm test` | Passed | 164 tests passed, 0 failed. Node emitted module-type warnings because `package.json` has no `type: module` while tests import ESM-style TypeScript modules. |

Many tests are static source/migration assertions. They provide useful regression evidence but do not prove live database deployment, provider availability, RLS behavior in the linked project, or native-device compatibility.

### Confidence by area

- **High confidence:** repository/package layout, Next/TypeScript coupling, current route presence, domain constants/types, selection helpers, fixed-point calculator, web client structure, and local script outcomes.
- **Medium confidence:** intended database/RLS behavior, wallet/order transactional behavior, provider normalization, and client read models, because migrations and tests are substantial but no fresh live project verification was performed.
- **Low confidence:** production OTAPI availability, production migration parity, real bearer-token interoperability across all routes, signed-file behavior on native devices, push delivery, and end-to-end mobile performance/security.

### Not verified

- `npm run build` was not requested or run.
- No database reset, migration application, Supabase linked-project inspection, advisor/security scan, or live reconciliation was run.
- No `.env.local` values or secrets were inspected.
- No live 1688/OTAPI/RapidAPI request was made.
- No API was called with a real mobile/native bearer session.
- No iOS/Android project, device, emulator, secure storage, file picker, deep link, background lifecycle, or push service exists to test.
- Uncommitted user work elsewhere in the repository was not modified or evaluated as a release diff.

## Audit conclusion

The repository has a credible server and financial foundation for a future client mobile application, especially product resolution, SKU selection logic, direct multi-SKU confirmation, wallet accounting, Product Statement aggregation, and protected client read models. It is not yet a mobile-ready shared-code architecture and does not yet expose a complete production client contract.

The safest next step is an architecture/contract phase: select the mobile platform, establish a framework-neutral contract boundary and typed bearer API client, then close the ordering, detail, cancellation/refund, favorites, push, and native session gaps before building feature screens.

