# Repository Audit

## Audit Scope And Limitation

This audit compares the current repository against the planned architecture described in:

- `docs/PROJECT_ARCHITECTURE.md`
- `docs/BUSINESS_RULES.md`
- `docs/DATABASE_DESIGN.md`
- `docs/API_CONTRACT.md`
- `docs/STATUS_MACHINE.md`
- `docs/DEVELOPMENT_ROADMAP.md`

Terminal-based repository inspection could not run because the command runner failed before process execution with `helper_unknown_error: setup refresh had errors`. Because of that, lint/type/test checks were attempted but could not execute.

This report is based on the known current project files created in this workspace: a greenfield Next.js scaffold, Supabase migration draft, API route skeletons, documentation, and Chrome extension scaffold.

## Current Architecture

### 1. Current Frontend Framework

The current frontend is a Next.js application using:

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- `lucide-react` icons

Known frontend routes:

- `/`
- `/client`
- `/admin`
- `/staff`
- `/extension`

The frontend currently behaves as an operations prototype/dashboard shell, not a complete production application.

### 2. Current Backend Framework

The current backend is implemented through Next.js API route handlers under `app/api`.

Known API route groups:

- Product link resolution
- Estimate calculation
- Order confirmation
- Payment proof submission
- Admin payment approval
- Chrome extension purchase queue
- Chrome extension provider sync
- Staff parcel receiving
- Staff carton creation
- Courier tracking sync

Supabase is intended as the backend/data platform, but the current API routes mostly return mock or calculated responses rather than persisting to Supabase.

### 3. Database Configuration

The repository includes a Supabase migration draft:

- `supabase/migrations/001_initial_schema.sql`

It defines many core tables from the architecture, including:

- `profiles`
- `clients`
- `product_links`
- `order_groups`
- `estimates`
- `order_items`
- `wallet_transactions`
- `purchase_batches`
- `provider_orders`
- `parcels`
- `cartons`
- settings tables
- audit/notification/integration tables

Current gap:

- The migration is an initial draft and does not yet fully match the later database design document.
- Several normalized tables from `DATABASE_DESIGN.md` are missing or simplified, such as `product_skus`, `payment_proofs`, `purchase_batch_items`, `parcel_items`, `carton_items`, `tracking_events`, and `order_status_events`.

### 4. Authentication Implementation

Supabase server client helper exists:

- `lib/supabase/server.ts`

However, authentication is not fully implemented yet.

Current gaps:

- No login/register pages confirmed.
- No route guards confirmed.
- No middleware-based auth protection confirmed.
- API routes do not yet consistently enforce Supabase session or role authorization.
- Staff/admin/client access control is mostly architectural, not implemented.

### 5. Existing Routes

Known app routes:

- `app/page.tsx`
- `app/client/page.tsx`
- `app/admin/page.tsx`
- `app/staff/page.tsx`
- `app/extension/page.tsx`

These are useful MVP shells but currently use static/mock data and local component state.

### 6. Existing Components

Known shared components:

- `components/app-shell.tsx`
- `components/metric-grid.tsx`
- `components/status-pill.tsx`

These establish a simple dashboard UI pattern.

Current gap:

- There is no full design system yet.
- No form abstraction.
- No role-aware navigation.
- No data table abstraction.
- No file-upload components.
- No scanner/camera implementation.

### 7. Existing API Endpoints

Known endpoints:

- `POST /api/products/resolve-link`
- `POST /api/estimates`
- `POST /api/orders/confirm`
- `POST /api/payments/proof`
- `POST /api/admin/payments/:id/approve`
- `GET /api/extension/purchase-queue`
- `POST /api/extension/provider-order-sync`
- `POST /api/staff/parcels/receive`
- `POST /api/staff/cartons`
- `POST /api/courier/track-sync`

Current state:

- Endpoints validate basic request shapes with `zod`.
- Most endpoints return mock IDs/responses.
- No confirmed database persistence yet.
- No consistent `{ data, meta }` response envelope yet.
- No centralized error format yet.
- No auth/role checks yet.

### 8. Existing Environment Variables

Documented expected variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OTAPI_KEY`

Current risks:

- No `.env.example` confirmed.
- API routes and Supabase helper assume variables exist.
- Missing runtime validation for required environment variables.
- `OTAPI_KEY` is optional in current product adapter, falling back to mock data.

### 9. Existing Dependencies

Known dependencies from `package.json`:

- `next`
- `react`
- `react-dom`
- `typescript`
- `tailwindcss`
- `@supabase/supabase-js`
- `@supabase/ssr`
- `zod`
- `lucide-react`

Known dev dependencies:

- `eslint`
- `eslint-config-next`
- `postcss`
- `autoprefixer`
- React/Node type packages

Current risk:

- Dependency installation and build compatibility could not be verified because command execution failed.

### 10. Existing Coding Conventions

Observed conventions:

- TypeScript-first.
- Next.js App Router route handlers.
- `zod` for request validation.
- Shared domain types in `lib/types.ts`.
- Service-style helpers in `lib`.
- Tailwind utility styling.
- Dashboard routes share `AppShell`.
- Mock data is isolated in `lib/mock-data.ts`.

Recommended convention to formalize:

- API responses should always use `{ data, meta }` or `{ error }`.
- External integrations should live under `services/`.
- Database access should be isolated behind repository/service functions.
- Domain constants/statuses should come from shared enums/types.

## Good Existing Decisions

- The technology choices match the planned stack: Next.js, React, TypeScript, Tailwind CSS, Supabase, OTAPI-ready integration, and Chrome extension scaffold.
- Documentation is strong and split by purpose: architecture, business rules, database design, API contract, status machine, roadmap.
- API endpoints already mirror the planned MVP boundaries.
- `zod` request validation is a good foundation.
- Product lookup adapter includes a mock fallback when `OTAPI_KEY` is missing, which helps local development.
- Supabase migration draft includes RLS enablement and initial policies.
- Wallet is planned as a ledger rather than editable balance, which is correct for financial correctness.
- The extension is admin-only and does not store supplier passwords.
- Manual fallback is recognized as a first-class requirement.

## Problems

- The repository currently mixes documentation, prototype UI, API skeletons, and migration draft, but does not yet implement a real end-to-end business flow.
- Authentication is incomplete.
- Role-based authorization is incomplete.
- API endpoints do not persist to Supabase.
- API response format does not fully match `API_CONTRACT.md`.
- Database migration is less detailed than `DATABASE_DESIGN.md`.
- Several planned tables and event-history tables are missing from the migration draft.
- RLS policies are incomplete for production.
- The frontend currently uses static/mock data.
- Product estimate calculation uses hardcoded default rates instead of database-configured rates.
- OTAPI endpoint shape may need adjustment after testing against real OTAPI credentials.
- Chrome extension is only a scaffold and does not reliably select real provider SKUs yet.
- Staff scanning UI is conceptual and does not integrate a real barcode scanner.
- No tests are confirmed.
- No lint/type/build validation could be run.

## Risks

### Business Risks

- Incorrect wallet or exchange-rate logic could create financial disputes.
- If product snapshots are incomplete, historical order records may become unreliable.
- If QC/parcel workflows allow unchecked manual edits, staff mistakes may be hard to trace.
- If group totals are calculated incorrectly, client statements may not match admin accounting.

### Technical Risks

- RLS mistakes could expose one client’s orders or wallet data to another client.
- Missing audit logs could make financial corrections impossible to prove.
- Extension automation may break when 1688/Taobao page structure changes.
- OTAPI response formats may not match the current adapter assumptions.
- Hardcoded pricing defaults may accidentally be used in production.
- Private file storage policies are not yet implemented.
- Current migration may need breaking changes before real data is inserted.

### Operational Risks

- Staff workflows need to be very mobile-friendly; current UI is only a prototype.
- Manual fallback must be easy, or the business may return to Excel/WhatsApp outside the system.
- Courier API choice is still undecided, so tracking automation cannot be finalized.

## Recommended Changes

### Immediate

- Create `.env.example` with all required environment variables.
- Add auth pages and Supabase session handling.
- Add route guards for client/admin/staff/super admin.
- Standardize API responses to match `API_CONTRACT.md`.
- Replace mock API responses with Supabase persistence one flow at a time.
- Update migration to match `DATABASE_DESIGN.md` before production data is inserted.
- Add missing tables: `product_skus`, `payment_proofs`, `purchase_batch_items`, `parcel_items`, `carton_items`, `tracking_events`, `order_status_events`.
- Add database functions/triggers for status history, wallet ledger, group creation, and audit logs.
- Add RLS tests before real client use.

### Near Term

- Move integration code into dedicated services:
  - `OtapiService`
  - `EstimateService`
  - `WalletService`
  - `OrderGroupService`
  - `AuditLogService`
  - `CourierProviderAdapter`
- Build real client order flow: resolve link, select SKU, estimate, accept estimate.
- Build admin estimate/order review queue.
- Build payment proof upload and approval.
- Implement product image/file storage through Supabase Storage.
- Build staff receiving flow with real tracking lookup.

### Later

- Harden Chrome extension against real 1688/Taobao pages.
- Add OCR tracking extraction.
- Add courier provider integration after provider selection.
- Add reports/exports after the data model stabilizes.
- Add realtime notifications.

## Files That Should Remain

Documentation files should remain:

- `docs/PROJECT_ARCHITECTURE.md`
- `docs/BUSINESS_RULES.md`
- `docs/DATABASE_DESIGN.md`
- `docs/API_CONTRACT.md`
- `docs/STATUS_MACHINE.md`
- `docs/DEVELOPMENT_ROADMAP.md`
- `docs/REPOSITORY_AUDIT.md`

Core scaffold files should remain:

- `package.json`
- `next.config.mjs`
- `tsconfig.json`
- `tailwind.config.ts`
- `postcss.config.mjs`
- `app/layout.tsx`
- `app/globals.css`

Useful starter code should remain:

- `lib/types.ts`
- `lib/pricing.ts`
- `lib/otapi.ts`
- `lib/supabase/server.ts`
- `components/app-shell.tsx`
- `components/metric-grid.tsx`
- `components/status-pill.tsx`
- `extension/manifest.json`
- `extension/popup.html`
- `extension/popup.js`
- `extension/content.js`

## Files That Should Be Refactored

- `supabase/migrations/001_initial_schema.sql`
  - Refactor to match the final database design before production data.

- `lib/pricing.ts`
  - Replace hardcoded defaults with database-backed settings.

- `lib/otapi.ts`
  - Verify real OTAPI response shape and move provider logic into a service layer.

- `lib/mock-data.ts`
  - Keep only for development/demo mode, then remove from production dashboard data.

- `app/page.tsx`
- `app/client/page.tsx`
- `app/admin/page.tsx`
- `app/staff/page.tsx`
- `app/extension/page.tsx`
  - Refactor from static prototype screens into authenticated, data-driven pages.

- All files under `app/api`
  - Add auth/role checks, Supabase persistence, audit logging, and standardized response/error envelopes.

## Files That Can Be Removed

No file should be removed immediately without first confirming the desired project direction.

Potential later removals:

- `lib/mock-data.ts`, once all pages use real Supabase data.
- `public/placeholder-product.svg`, once real product image handling is complete.
- Prototype-only UI code inside dashboard pages, once replaced by production flows.

## Migration Risks

- The current migration draft is not yet final and should not be treated as production-safe.
- Applying the current migration to a real Supabase project and then changing table structure later may require destructive migrations or data backfills.
- Wallet ledger design must be finalized before real payments are entered.
- Order status/event design must be finalized before real fulfillment starts.
- RLS policies must be tested before onboarding real clients.
- Storage bucket policies must be implemented before uploading payment proofs or QC photos.
- Product SKU normalization should be added before depending on OTAPI data in production.

## Validation Checks

Attempted checks:

- Repository file listing with `rg --files`
- Documentation reads with `Get-Content`
- `npm run typecheck`
- `npm run build`

Result:

- All command execution attempts failed before process execution with `helper_unknown_error: setup refresh had errors`.
- Because commands could not start, lint/type/build/test results are unavailable.

Recommended checks once the command runner works:

```bash
npm install
npm run typecheck
npm run lint
npm run build
```

If tests are added:

```bash
npm test
```

## Recommended Next Steps

1. Fix or restart the local command runner so repo inspection and validation can run.
2. Create `.env.example`.
3. Align `supabase/migrations/001_initial_schema.sql` with `docs/DATABASE_DESIGN.md`.
4. Implement Supabase Auth pages and role-based route guards.
5. Standardize API response/error format.
6. Convert product lookup and estimate creation from mock/skeleton behavior to real database-backed flows.
7. Add RLS and service-level tests before using real client data.
