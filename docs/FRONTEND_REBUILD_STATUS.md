# Frontend Rebuild Status

Updated: 2026-08-27
Task: FRONTEND-F12

This audit covers the public and client-facing rebuilt frontend before continuing into Phase 7. Later Phase 6B follow-up work added the approved direct multi-SKU order confirmation path while preserving legacy estimate APIs.

## COMPLETED

- Auth session preservation and protected client routes were inspected through the Supabase SSR flow, middleware, `requireRoleForPath`, and role authorization tests. Private client pages derive access from server-verified users, not UI hiding.
- Landing, auth, client dashboard, link entry, product resolution, product display, variant selection, quantity state, estimate review, and accept/reject handoffs are wired to implemented routes instead of frontend-only mock state.
- Product link resolution handles invalid URLs, unsupported providers, provider lookup failure, and manual review responses with visible client-facing errors.
- The shared SKU selection model supports zero selections, one SKU, multiple SKUs, per-SKU quantities, out-of-stock rejection, limited-stock clamping, clearing, selected piece counts, display-only supplier subtotal, and very large selection state.
- The customer confirm path now submits one product session with one or more canonical SKU/quantity lines to `POST /api/orders/confirm`. The frontend does not calculate an authoritative financial total.
- Estimate review displays the server-returned cost breakdown, BDT-facing estimated total, validity/expiration context, and accept/reject actions.
- Duplicate direct confirmations are guarded with client in-flight state and a backend idempotency key. Legacy estimate accept/reject actions still keep their existing guards.
- Product gallery image failure fallback was already present. During this audit, the estimate review product thumbnail was hardened so a failed supplier image falls back to the existing unavailable-image state.
- Production build, typecheck, lint, and available unit/integration suites pass.

## WORKING WITH LIMITATION

- `POST /api/estimates` remains a one-`skuId`, one-`quantity` compatibility endpoint. The customer-facing Phase 6B direct confirmation flow uses `POST /api/orders/confirm` for multi-SKU product sessions.
- Product and estimate review state is local to `/client/order/new`. The internal Back/Edit action preserves selection where safe, but browser refresh or deep-linking to an already resolved product/estimate cannot be restored because there is no implemented authenticated product-detail or estimate-detail read endpoint.
- Browser back/forward uses the current page flow rather than a route per checkout step. The current behavior is acceptable for Phase 6B but should be revisited if Phase 7 adds persisted estimate/product detail pages.
- Live provider data quality still depends on OTAPI/RapidAPI credentials and provider responses. Missing image, no SKU, malformed SKU, and lookup failure cases are handled, but real marketplace coverage requires credentialed runtime verification.
- The provider normalizer currently caps normalized provider SKUs at 24 service-side. The frontend selection model and table pagination can handle larger lists, but live large-list exposure is limited by provider/service behavior outside this frontend-only task.
- The old `OrderAction` accept path in `ProductDetailBuyingInterface` is currently unreachable because the component returns `EstimateReview` when an estimate exists. It does not affect the active journey, but it should be removed in a cleanup pass if the estimate review flow remains canonical.
- Node test runs emit `MODULE_TYPELESS_PACKAGE_JSON` warnings because package module type is not declared. Tests still pass; changing package module semantics was outside this regression audit.

## BLOCKED

- Full manual end-to-end browser verification with account creation/sign-in, real 1688/Taobao/Tmall provider lookup, estimate acceptance, and order/group identifiers requires a running environment with valid Supabase auth/session data and provider credentials. This audit verified code paths and automated tests locally, not a credentialed live journey.
- `npm test` is not available because `package.json` does not define a `test` script. The available targeted scripts were run instead.

## DEFERRED TO PHASE 7+

- Add implemented authenticated read endpoints/pages for product details, estimate details, order history, and refresh-safe client journey restoration.
- Add client order-history/detail screens that display the stored product base cost separately from the full estimated cost for every confirmed order item.
- Remove unreachable legacy accept UI code after the estimate-review flow is confirmed as the only customer acceptance path.
- Expand browser automation for mobile sheets, keyboard behavior, browser back/forward, refresh recovery, console errors, and network interruption once a stable test environment is available.

## Validation

- `npm run typecheck`: passed
- `npm run lint`: passed
- `npm run build`: passed
- `npm run test:auth`: passed, 3 tests
- `npm run test:products`: passed, 20 tests
- `npm run test:estimates`: passed, 28 tests
- `npm test`: unavailable, missing script
