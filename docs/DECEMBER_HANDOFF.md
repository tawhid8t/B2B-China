# December development handoff — start here

**Checkpoint date:** 2026-09-18 (Asia/Shanghai). **Launch target:** web operations MVP: public/client web, admin, staff, Next.js APIs, Supabase, and the private Chrome extension. The Expo client app is paused after its authentication foundation; it is not a web launch gate.

## First five minutes in December

1. Read this page, [the evidence-based launch audit](./LAUNCH_READINESS_AUDIT.md), then [the dependency-ordered backlog](./LAUNCH_BACKLOG.md).
2. Read [docs/AGENTS.md](./AGENTS.md) and the authoritative [business rules](./BUSINESS_RULES.md), [status machine](./STATUS_MACHINE.md), [database design](./DATABASE_DESIGN.md), [API contract](./API_CONTRACT.md), and [spec decisions](./SPEC_DECISIONS.md) before changing behavior. Resolve conflicts explicitly.
3. Run `git status --short` and compare with the checkpoint below. The September work was originally uncommitted, including 22 migration files; the GitHub checkpoint now includes the safe source and documents the one excluded local operational script. A checkout of the pre-handoff base commit does not contain the September work. Review the current main branch before any merge, reset, checkout, or migration operation.
4. Start with **L0 in the launch backlog**: stabilize the checkpoint and reproduce the staging workflow. Do not infer launch readiness from a green build or static tests.

## What is built, and where to start

The strongest implemented vertical is wallet/payment: private proof upload, admin review, append-only ledger/corrections, partial order reservations, exports, financial notifications, and dashboards. Client auth, product-link resolution, multi-SKU selection/direct confirmation, order cards, and product statements also have code and database support. Admin product-wide review, purchase tasks, extension cart actions, provider capture/approval, tracking capture, and Cainiao import/collection are present in the current working tree. Their real browser/provider/warehouse journey remains unverified. Receiving/QC, cartons, Guangzhou forwarding, and complete reports are not launch ready. Details and code evidence are in the audit.

**December reading order by area:**

| Area | Current references |
| --- | --- |
| Overall architecture and workflow | [Project architecture](./PROJECT_ARCHITECTURE.md), [implementation checkpoints](./IMPLEMENTATION_CHECKPOINTS.md), [admin staging workflow](./ADMIN_STAGING_WORKFLOW.md) |
| Client web | [Client web status](./client-web/CLIENT_WEB_IMPLEMENTATION_STATUS.md), [client web audit](./client-web/CLIENT_WEB_AUDIT.md), [admin delivery freeze](./client-web/CLIENT_DASHBOARD_ADMIN_FREEZE.md) |
| Wallet/payment | [Wallet/payment implementation](./WALLET_PAYMENT_IMPLEMENTATION.md) |
| Expo (paused) | [Mobile status](./mobile/MOBILE_IMPLEMENTATION_STATUS.md), [mobile architecture](./mobile/MOBILE_ARCHITECTURE.md) |

The August [current status](./CURRENT_IMPLEMENTATION_STATUS.md), [repository audit](./REPOSITORY_AUDIT.md), and [frontend rebuild status](./FRONTEND_REBUILD_STATUS.md) are historical snapshots. Some statements there are now false, including missing auth/API persistence, no `npm test` script, and purchasing being only a mock. Use current source and this audit for the September checkpoint; keep the older documents for context.

## Exact source checkpoint

| Item | Captured state |
| --- | --- |
| Branch | `main` |
| Pre-handoff base commit | `1877bd1ce3b29e23fe4df3689b73ef581b92fe63` (`test: lock client order flow regression`); use `git log -1` for the later GitHub checkpoint commit |
| Pre-GitHub working tree before these handoff docs | **30 modified tracked files + 53 untracked files**; no pre-existing staged changes. The GitHub checkpoint includes all safe source from that list except the local operational SQL helper below. |
| Database migrations on disk | **73** `.sql` files, of which **22 are untracked** |
| Connected Supabase project | Ref `byuuqrjvedsjzrdlasjp`; `.env.local` public project URL points to that ref. Project was `ACTIVE_HEALTHY` during this audit. Never copy keys from `.env.local` into documentation. |
| Remote migration state | The read-only migration list included every local migration through `20260911122533_phase4b_fix_unmatched_link_output_conflict`. This shows deployed migration *names*, not functional acceptance or checksum identity. |
| Local toolchain used | Node `v24.19.0`, npm `11.17.0`, Next.js `15.5.23` as reported by the build. |

**Modified tracked files at checkpoint (30):**

```text
app/admin/purchasing/purchased/page.tsx
app/api/admin/product-orders/[id]/confirm/route.ts
app/api/extension/provider-order-capture/route.ts
app/api/extension/purchase-queue/route.ts
app/api/products/resolve-link/route.ts
app/staff/receiving/page.tsx
components/admin/product-order-review-cards.tsx
components/admin/purchase-task-cards.tsx
components/app-shell.tsx
extension/adapters/1688/adapter.js
extension/background.js
extension/content.js
extension/manifest.json
extension/popup.html
extension/popup.js
lib/api/database-error.ts
lib/domain/types.ts
package-lock.json
package.json
services/admin-operations-service.ts
services/product-provider-service.ts
services/product-resolution-service.ts
services/public-product-preview-service.ts
services/supabase-product-repository.ts
supabase/config.toml
tests/admin/operations-dashboard-static.test.mjs
tests/extension/cart-assistant-static.test.mjs
tests/products/phase-7a-resolution-static.test.mjs
tests/products/provider-service.test.mjs
tests/purchasing/purchase-tasks-phase2-static.test.mjs
```

**Originally untracked files at checkpoint (53; excludes the new handoff docs):**

```text
app/api/admin/cainiao-parcels/[trackingNumber]/link/route.ts
app/api/admin/cainiao-parcels/link-candidates/route.ts
app/api/admin/product-orders/[id]/decision/route.ts
app/api/admin/purchasing/[id]/provider-capture-approval/route.ts
app/api/admin/purchasing/[id]/sku-corrections/route.ts
app/api/extension/provider-tracking-capture/route.ts
app/api/staff/cainiao-imports/manual/route.ts
app/api/staff/cainiao-imports/screenshot/route.ts
app/api/staff/cainiao-parcels/[trackingNumber]/collect/route.ts
app/api/staff/cainiao-parcels/collection/route.ts
components/admin/purchased-order-cards.tsx
components/staff/cainiao-collection-dashboard.tsx
components/staff/cainiao-manual-import.tsx
components/staff/cainiao-screenshot-import.tsx
components/staff/cainiao-unmatched-review.tsx
docs/ADMIN_STAGING_WORKFLOW.md
docs/client-web/CLIENT_DASHBOARD_ADMIN_FREEZE.md
lib/logistics/cainiao-import.ts
lib/logistics/cainiao-ocr.ts
lib/logistics/cainiao-screenshot.ts
supabase/migrations/20260907064157_phase1_product_order_review_decisions.sql
supabase/migrations/20260907070014_fix_confirm_product_order_shadowing.sql
supabase/migrations/20260907071115_confirm_product_order_service_wrapper.sql
supabase/migrations/20260907071558_fix_service_confirmation_wrapper_role_check.sql
supabase/migrations/20260907114352_dual_sku_attributes_and_admin_repair.sql
supabase/migrations/20260907121855_extension_cart_added_visibility.sql
supabase/migrations/20260908231657_phase3_provider_tracking_and_approval.sql
supabase/migrations/20260909013656_provider_capture_rounding_adjustment.sql
supabase/migrations/20260909014658_extension_captured_task_visibility.sql
supabase/migrations/20260909060859_approve_provider_purchase_capture.sql
supabase/migrations/20260909061830_fix_provider_capture_approval_ambiguity.sql
supabase/migrations/20260909063946_provider_tracking_capture.sql
supabase/migrations/20260911094946_phase4a_cainiao_parcel_foundation.sql
supabase/migrations/20260911095401_restrict_cainiao_collection_rpc.sql
supabase/migrations/20260911095651_require_nonempty_cainiao_sync.sql
supabase/migrations/20260911110447_phase4b_mobile_import_foundation.sql
supabase/migrations/20260911112810_phase4b_collection_queue.sql
supabase/migrations/20260911114343_phase4b_screenshot_import_evidence.sql
supabase/migrations/20260911120721_phase4b_fix_cainiao_sync_conflict.sql
supabase/migrations/20260911122124_phase4b_unmatched_parcel_review.sql
supabase/migrations/20260911122423_phase4b_unmatched_review_invoker_security.sql
supabase/migrations/20260911122533_phase4b_fix_unmatched_link_output_conflict.sql
supabase/record-verified-cart-results.sql
supabase/seeds/admin_workflow_staging.sql
tests/admin/database-error-response.test.mjs
tests/admin/phase0-staging-freeze-static.test.mjs
tests/logistics/cainiao-collection-dashboard-static.test.mjs
tests/logistics/cainiao-manual-import-ui-static.test.mjs
tests/logistics/cainiao-manual-import.test.mjs
tests/logistics/cainiao-screenshot-import-static.test.mjs
tests/logistics/cainiao-unmatched-review-static.test.mjs
tests/logistics/phase4a-parcel-foundation-static.test.mjs
tests/logistics/phase4b-mobile-import-foundation-static.test.mjs
```

**Public GitHub exclusion:** `supabase/record-verified-cart-results.sql` is a local operational helper with hard-coded order, line, and profile UUIDs. It was intentionally kept off the public repository and added to `.gitignore`. It is not a migration, staging fixture, or launch dependency. `.mcp.json` and `.env.local` remain ignored because they hold local credentials. All other files in the manifest are included in the GitHub checkpoint.

## Safe local restart

1. Check out the latest `main` GitHub checkpoint, not the pre-handoff base commit shown above. The ignored operational SQL helper is intentionally absent; recreate a safe staging-only helper if needed, rather than copying live IDs into source.
2. Run `npm ci`, copy only the *names* of needed variables from [`.env.example`](../.env.example), and provide private values through an untracked `.env.local`. The web requires Supabase URL/publishable key, server service-role key, and RapidAPI OTAPI credentials for live supplier lookup. `CHROME_EXTENSION_ORIGINS` must contain the private extension origin for credentialed extension requests. `OTAPI_DEV_MOCK_MODE=true` is local-only and cannot prove provider readiness.
3. Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. Run `npm run mobile:typecheck` and `npm run mobile:test` only when changing the paused mobile track or shared contracts.
4. Use the [staging workflow instructions](./ADMIN_STAGING_WORKFLOW.md) only with a **local stack or a separate empty staging project**. `supabase/config.toml` currently enables `supabase/seeds/admin_workflow_staging.sql` on `db reset`; never run reset/seed against the connected business project. Review the target before any migration or reset.
5. Verify the deployed migration list, security advisors, RLS behavior, storage, and a credentialed end-to-end journey before declaring a launch gate passed. No live customer records or provider purchases were created by this audit.

## Verification captured on 2026-09-18

`npm run typecheck`, `npm run lint`, `npm test` (**256/256**), `npm run build`, `npm run mobile:typecheck`, and `npm run mobile:test` (**28/28**) passed. These checks include many static/source-contract tests and do not prove real supplier interactions, browser session renewal, physical warehouse work, payment handling, or private extension behavior. `npm audit --omit=dev` reported **18** production dependency findings (1 critical, 3 high, 14 moderate); see the audit and backlog. No visual browser suite, SQL test suite, physical-device test, or credentialed transactional end-to-end run was performed.
