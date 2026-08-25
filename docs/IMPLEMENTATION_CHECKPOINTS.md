# Implementation Checkpoints

Status meanings: `COMPLETE` is accepted and verified; `READY` can be assigned now; `PENDING` waits on an earlier checkpoint; `BLOCKED` needs owner/developer confirmation recorded in `SPEC_DECISIONS.md`.

## Foundation and security

### CP-001

- **ID:** CP-001
- **Objective:** Make the existing typecheck and production build pass without changing product behavior.
- **Dependencies:** None.
- **Relevant specification:** `AGENTS.md`; `CURRENT_IMPLEMENTATION_STATUS.md`.
- **Acceptance criteria:** `lib/supabase/server.ts` has no implicit `any`; typecheck and build both pass.
- **Status:** COMPLETE
- **Verification command:** `npm run build`

### CP-002

- **ID:** CP-002
- **Objective:** Make linting executable without interactive setup.
- **Dependencies:** None.
- **Relevant specification:** `AGENTS.md`; `CURRENT_IMPLEMENTATION_STATUS.md`.
- **Acceptance criteria:** The lint configuration is committed; `npm run lint` completes non-interactively.
- **Status:** COMPLETE
- **Verification command:** `npm run lint`

### CP-003

- **ID:** CP-003
- **Objective:** Establish the project test command and one non-business smoke test.
- **Dependencies:** Test-tool choice and, if needed, dependency approval.
- **Relevant specification:** `AGENTS.md`; `CURRENT_IMPLEMENTATION_STATUS.md`.
- **Acceptance criteria:** `package.json` has a non-interactive `test` script; one test runs in CI/local execution.
- **Status:** READY
- **Verification command:** `npm test`

### CP-004

- **ID:** CP-004
- **Objective:** Complete Supabase client configuration for server and browser use.
- **Dependencies:** CP-001; Supabase URL and anon key configured outside source control.
- **Relevant specification:** `PROJECT_ARCHITECTURE.md` §§2, 6; `AGENTS.md` security rules.
- **Acceptance criteria:** Server and browser clients are typed; missing required public configuration fails clearly; no service-role key reaches browser code.
- **Status:** COMPLETE
- **Verification command:** `npm run typecheck`

### CP-005

- **ID:** CP-005
- **Objective:** Implement Supabase sign-up, sign-in, sign-out, and session refresh.
- **Dependencies:** CP-004; Supabase Auth enabled.
- **Relevant specification:** `DEVELOPMENT_ROADMAP.md` Phase 1; `DATABASE_DESIGN.md` §§4, 16.
- **Acceptance criteria:** A client can sign up and sign in; logout clears the session; authenticated requests resolve the current user.
- **Status:** PENDING
- **Verification command:** `npm test -- auth`

### CP-006

- **ID:** CP-006
- **Objective:** Add middleware and route protection for public, client, admin, and staff route groups.
- **Dependencies:** CP-005.
- **Relevant specification:** `PROJECT_ARCHITECTURE.md` §§3, 6, 9; `AGENTS.md` security rules.
- **Acceptance criteria:** Unauthenticated private requests are rejected; clients cannot reach staff/admin routes; role redirects or API errors are deterministic.
- **Status:** PENDING
- **Verification command:** `npm test -- route-protection`

### CP-007

- **ID:** CP-007
- **Objective:** Add a reusable server-side authorization guard that derives the actor and role from the session.
- **Dependencies:** CP-005; CP-006.
- **Relevant specification:** `AGENTS.md` rules 35–43 and 51–55; `SPEC_DECISIONS.md` SD-009 and SD-010.
- **Acceptance criteria:** Private API routes can require roles; caller-supplied actor IDs are not trusted; forbidden access uses the documented error envelope.
- **Status:** PENDING
- **Verification command:** `npm test -- authorization`

### CP-008

- **ID:** CP-008
- **Objective:** Add the safe lifecycle enum/schema migration corrections.
- **Dependencies:** Supabase project access; migration review.
- **Relevant specification:** `DATABASE_DESIGN.md`; `STATUS_MACHINE.md`; `SPEC_DECISIONS.md` SD-001, SD-002, SD-006, SD-007.
- **Acceptance criteria:** Persisted order, estimate, QC/parcel, and courier status values support the approved lifecycle decisions without modifying the initial migration destructively.
- **Status:** READY
- **Verification command:** `npx supabase db reset`

### CP-009

- **ID:** CP-009
- **Objective:** Add the safe supporting persistence migration.
- **Dependencies:** CP-008; Supabase project access.
- **Relevant specification:** `DATABASE_DESIGN.md`; `SPEC_DECISIONS.md` SD-011, SD-012, SD-014.
- **Acceptance criteria:** Estimate/payment notes, manual products without external IDs, and exception records have defined additive persistence and indexes.
- **Status:** PENDING
- **Verification command:** `npx supabase db reset`

### CP-010

- **ID:** CP-010
- **Objective:** Implement complete RLS policies for existing and newly added tables.
- **Dependencies:** CP-005; CP-007; CP-008; CP-009.
- **Relevant specification:** `DATABASE_DESIGN.md` §16; `AGENTS.md` rules 35–43.
- **Acceptance criteria:** Every client-visible or operational table has RLS enabled and role-scoped read/write policies; staff cannot access wallet, payment, or profit data.
- **Status:** PENDING
- **Verification command:** `npm test -- rls`

### CP-011

- **ID:** CP-011
- **Objective:** Add authorization and RLS regression coverage for all five roles.
- **Dependencies:** CP-003; CP-010.
- **Relevant specification:** `DATABASE_DESIGN.md` §16; `DEVELOPMENT_ROADMAP.md` Phase 15.
- **Acceptance criteria:** Tests prove client isolation and staff financial-data denial, plus permitted admin/super-admin access.
- **Status:** PENDING
- **Verification command:** `npm test -- rls`

### CP-012

- **ID:** CP-012
- **Objective:** Implement private file storage buckets, policies, and signed file access.
- **Dependencies:** CP-004; CP-010; Supabase Storage configured.
- **Relevant specification:** `DATABASE_DESIGN.md` §15; `API_CONTRACT.md` §14; `AGENTS.md` rules 33–34.
- **Acceptance criteria:** Payment proofs, QC photos, carton labels, courier photos, and exports use private storage and signed access; unauthorized file access fails.
- **Status:** PENDING
- **Verification command:** `npm test -- storage-security`

## Product, estimates, and orders

### CP-013

- **ID:** CP-013
- **Objective:** Implement the authenticated product-link resolution API with the documented response/error envelopes.
- **Dependencies:** CP-004; CP-007.
- **Relevant specification:** `API_CONTRACT.md` §§2–3; `SPEC_DECISIONS.md` SD-004.
- **Acceptance criteria:** Valid 1688/Taobao/Tmall links resolve; invalid/unsupported links return documented errors; successful responses use `{ data, meta }`.
- **Status:** PENDING
- **Verification command:** `npm test -- product-resolve`

### CP-014

- **ID:** CP-014
- **Objective:** Persist resolved product snapshots and implement the admin manual-product fallback.
- **Dependencies:** CP-009; CP-013; CP-007.
- **Relevant specification:** `BUSINESS_RULES.md` §4; `DATABASE_DESIGN.md` §§5, 16; `SPEC_DECISIONS.md` SD-012.
- **Acceptance criteria:** Resolved and manual products are persisted with SKU data; manual records work without a provider item ID; access is role-scoped.
- **Status:** PENDING
- **Verification command:** `npm test -- products`

### CP-015

- **ID:** CP-015
- **Objective:** Implement super-admin management of exchange, shipping, profit, and category settings.
- **Dependencies:** CP-007; CP-009; CP-010.
- **Relevant specification:** `BUSINESS_RULES.md` §§2, 5; `DATABASE_DESIGN.md` §12; `SPEC_DECISIONS.md` SD-008.
- **Acceptance criteria:** Only super admin changes global settings; changes are audited; historical estimates retain their stored values.
- **Status:** PENDING
- **Verification command:** `npm test -- settings-authorization`

### CP-016

- **ID:** CP-016
- **Objective:** Implement persisted estimate calculation and creation.
- **Dependencies:** CP-014; CP-015; CP-010.
- **Relevant specification:** `BUSINESS_RULES.md` §5; `DATABASE_DESIGN.md` §6; `API_CONTRACT.md` §4.1.
- **Acceptance criteria:** An estimate stores a full immutable breakdown and validity time; all calculation inputs come from snapshots/settings rather than constants.
- **Status:** PENDING
- **Verification command:** `npm test -- estimates-create`

### CP-017

- **ID:** CP-017
- **Objective:** Implement estimate rejection and expiry transitions.
- **Dependencies:** CP-016; CP-008.
- **Relevant specification:** `STATUS_MACHINE.md` §3; `API_CONTRACT.md` §4.3.
- **Acceptance criteria:** Only valid transitions occur; expired estimates cannot be accepted; rejection/expiry creates audit history.
- **Status:** PENDING
- **Verification command:** `npm test -- estimate-transitions`

### CP-018

- **ID:** CP-018
- **Objective:** Implement accepted-estimate conversion to an order item and active order group.
- **Dependencies:** CP-016; CP-017; CP-008; CP-010.
- **Relevant specification:** `STATUS_MACHINE.md` §§3–5; `API_CONTRACT.md` §4.2; `SPEC_DECISIONS.md` SD-003.
- **Acceptance criteria:** `POST /api/estimates/:id/accept` atomically creates `pending_admin_review` order data, joins/creates the active group, and writes status/audit events.
- **Status:** PENDING
- **Verification command:** `npm test -- estimate-accept`

### CP-019

- **ID:** CP-019
- **Objective:** Implement client product ordering UI against the persisted product and estimate APIs.
- **Dependencies:** CP-013; CP-016; CP-018; CP-006.
- **Relevant specification:** `PROJECT_ARCHITECTURE.md` §§4.2, 5.1; `DEVELOPMENT_ROADMAP.md` Phases 3–4.
- **Acceptance criteria:** A signed-in client can resolve a link, choose a SKU/quantity, request an estimate, and accept/reject it with useful errors.
- **Status:** PENDING
- **Verification command:** `npm test -- client-ordering`

### CP-020

- **ID:** CP-020
- **Objective:** Implement client order and group read APIs.
- **Dependencies:** CP-018; CP-010.
- **Relevant specification:** `API_CONTRACT.md` §§5–6; `BUSINESS_RULES.md` §7.
- **Acceptance criteria:** Client-scoped list/detail/group endpoints return documented envelopes, day/month filters, group totals, and status history without exposing other clients.
- **Status:** PENDING
- **Verification command:** `npm test -- client-orders`

### CP-021

- **ID:** CP-021
- **Objective:** Implement admin order review, approved transitions, and audited manual adjustments.
- **Dependencies:** CP-018; CP-007; CP-010.
- **Relevant specification:** `STATUS_MACHINE.md` §4; `API_CONTRACT.md` §5.3; `SPEC_DECISIONS.md` SD-015.
- **Acceptance criteria:** Admin can make only valid transitions, enter `confirmed` before purchase queue, and submit a reason for every override/financial correction.
- **Status:** PENDING
- **Verification command:** `npm test -- admin-orders`

## Payments, wallet, and purchasing

### CP-022

- **ID:** CP-022
- **Objective:** Record owner decisions for wallet timing and correction semantics.
- **Dependencies:** Owner/developer response.
- **Relevant specification:** `SPEC_DECISIONS.md` OC-001 and OC-002.
- **Acceptance criteria:** Wallet commitment event, partial-balance behavior, reservation release, and linked reversal representation are approved in the specification.
- **Status:** BLOCKED
- **Verification command:** `rg -n 'OC-001|OC-002' docs/SPEC_DECISIONS.md`

### CP-023

- **ID:** CP-023
- **Objective:** Implement private payment-proof submission and pending-proof persistence.
- **Dependencies:** CP-012; CP-007; CP-010.
- **Relevant specification:** `BUSINESS_RULES.md` §3.2; `DATABASE_DESIGN.md` §8.1; `API_CONTRACT.md` §7.1.
- **Acceptance criteria:** A client uploads a private proof and creates only a `pending` proof; upload alone never changes wallet balance.
- **Status:** PENDING
- **Verification command:** `npm test -- payment-proof-upload`

### CP-024

- **ID:** CP-024
- **Objective:** Record owner decisions for `needs_review` and cancelled payment-proof API actions.
- **Dependencies:** Owner/developer response.
- **Relevant specification:** `SPEC_DECISIONS.md` OC-004.
- **Acceptance criteria:** Documented endpoint/action names and authorization for both transitions are approved.
- **Status:** BLOCKED
- **Verification command:** `rg -n 'OC-004' docs/SPEC_DECISIONS.md`

### CP-025

- **ID:** CP-025
- **Objective:** Implement payment review actions and approved wallet credit posting.
- **Dependencies:** CP-022; CP-023; CP-024; CP-007; CP-010.
- **Relevant specification:** `STATUS_MACHINE.md` §§6–7; `API_CONTRACT.md` §§7.2–7.3; `SPEC_DECISIONS.md` SD-010.
- **Acceptance criteria:** Only authorized actors review proofs; approval posts one immutable wallet credit with session-derived actor and audit data; rejection/review/cancellation follow the approved transitions.
- **Status:** PENDING
- **Verification command:** `npm test -- payment-review`

### CP-026

- **ID:** CP-026
- **Objective:** Implement wallet reservation/debit/release/reversal behavior and wallet statements.
- **Dependencies:** CP-022; CP-025; CP-018; CP-010.
- **Relevant specification:** `BUSINESS_RULES.md` §3; `DATABASE_DESIGN.md` §8.2; `API_CONTRACT.md` §7.4; `SPEC_DECISIONS.md` SD-013.
- **Acceptance criteria:** Ledger balances are derived from immutable posted entries; order references appear in statements; partial-balance behavior matches the approved decision.
- **Status:** PENDING
- **Verification command:** `npm test -- wallet-ledger`

### CP-027

- **ID:** CP-027
- **Objective:** Implement persisted purchase batches and the protected purchase queue.
- **Dependencies:** CP-021; CP-007; CP-010.
- **Relevant specification:** `STATUS_MACHINE.md` §8; `DATABASE_DESIGN.md` §9; `API_CONTRACT.md` §9.1.
- **Acceptance criteria:** Only admin-approved orders enter a batch/queue; extension queue access is protected; state/audit events are persisted.
- **Status:** PENDING
- **Verification command:** `npm test -- purchase-queue`

### CP-028

- **ID:** CP-028
- **Objective:** Secure the Chrome extension queue fetch and task handoff.
- **Dependencies:** CP-027; approved extension authentication mechanism.
- **Relevant specification:** `PROJECT_ARCHITECTURE.md` §4.5; `API_CONTRACT.md` §§2.2, 9.1; `AGENTS.md` rules 13–14.
- **Acceptance criteria:** Only an authorized admin extension can fetch its queue; no provider credentials are stored; failed API calls show an actionable error.
- **Status:** PENDING
- **Verification command:** `npm test -- extension-auth`

### CP-029

- **ID:** CP-029
- **Objective:** Record the owner decision for split provider orders and seller tracking numbers.
- **Dependencies:** Owner/developer response.
- **Relevant specification:** `SPEC_DECISIONS.md` OC-006.
- **Acceptance criteria:** The provider-order/tracking collection shape and compatibility approach are approved.
- **Status:** BLOCKED
- **Verification command:** `rg -n 'OC-006' docs/SPEC_DECISIONS.md`

### CP-030

- **ID:** CP-030
- **Objective:** Implement provider-order sync, seller tracking persistence, and manual courier tracking.
- **Dependencies:** CP-027; CP-029; CP-007; CP-010.
- **Relevant specification:** `STATUS_MACHINE.md` §§4, 9, 13; `API_CONTRACT.md` §§9.2, 11.1; `SPEC_DECISIONS.md` SD-007.
- **Acceptance criteria:** Sync creates/updates provider data and valid order events; manual tracking persists `manual_recorded`; failures create integration/exception records.
- **Status:** PENDING
- **Verification command:** `npm test -- provider-tracking`

## Warehouse, delivery, and client completion

### CP-031

- **ID:** CP-031
- **Objective:** Implement staff parcel search and authorized receiving persistence.
- **Dependencies:** CP-030; CP-007; CP-010; CP-012.
- **Relevant specification:** `STATUS_MACHINE.md` §§4, 10; `API_CONTRACT.md` §§10.1–10.2.
- **Acceptance criteria:** Authorized receiver staff can search/receive a parcel, record pieces/weight/photos, and create audit/status events; unknown scans create exceptions.
- **Status:** PENDING
- **Verification command:** `npm test -- parcel-receiving`

### CP-032

- **ID:** CP-032
- **Objective:** Implement the QC workflow and admin approval gate for failed/partial/missing items.
- **Dependencies:** CP-031; CP-021; CP-010; CP-012.
- **Relevant specification:** `BUSINESS_RULES.md` §§10–11; `STATUS_MACHINE.md` §§4, 11; `SPEC_DECISIONS.md` SD-005 and SD-006.
- **Acceptance criteria:** QC results/photos are persisted; completed QC yields the correct order transition; failed items cannot enter packing without an audited admin approval.
- **Status:** PENDING
- **Verification command:** `npm test -- qc-workflow`

### CP-033

- **ID:** CP-033
- **Objective:** Record the owner decision for carton label printing and dispatch transition.
- **Dependencies:** Owner/developer response.
- **Relevant specification:** `SPEC_DECISIONS.md` OC-003.
- **Acceptance criteria:** The persisted label-print action and carton dispatch API/action shape are approved.
- **Status:** BLOCKED
- **Verification command:** `rg -n 'OC-003' docs/SPEC_DECISIONS.md`

### CP-034

- **ID:** CP-034
- **Objective:** Implement packing-queue eligibility, carton creation, item assignment, and private label generation.
- **Dependencies:** CP-032; CP-033; CP-012; CP-010.
- **Relevant specification:** `BUSINESS_RULES.md` §12; `STATUS_MACHINE.md` §12; `API_CONTRACT.md` §10.3.
- **Acceptance criteria:** Only eligible items are packed; cartons persist code, weights, mark, item records, and a private label; lifecycle starts and transitions as approved.
- **Status:** PENDING
- **Verification command:** `npm test -- cartons`

### CP-035

- **ID:** CP-035
- **Objective:** Implement Guangzhou tracking, receipt, and onward shipment status updates.
- **Dependencies:** CP-034; CP-030; CP-010.
- **Relevant specification:** `BUSINESS_RULES.md` §§13–14; `STATUS_MACHINE.md` §§4–5, 12; `API_CONTRACT.md` §10.4.
- **Acceptance criteria:** Dispatch requires carton code, gross weight, tracking number, and approved label state; subsequent Guangzhou/Bangladesh/pickup transitions are authorized and audited.
- **Status:** PENDING
- **Verification command:** `npm test -- guangzhou-forwarding`

### CP-036

- **ID:** CP-036
- **Objective:** Record the owner decision for reopening cancelled/completed records.
- **Dependencies:** Owner/developer response.
- **Relevant specification:** `SPEC_DECISIONS.md` OC-007.
- **Acceptance criteria:** The specification states whether cancelled records may be restored, who may do it, and the permitted target state.
- **Status:** BLOCKED
- **Verification command:** `rg -n 'OC-007' docs/SPEC_DECISIONS.md`

## Reporting, notifications, and release readiness

### CP-037

- **ID:** CP-037
- **Objective:** Implement the client statement and wallet/order group reporting view.
- **Dependencies:** CP-020; CP-026; CP-035; CP-010.
- **Relevant specification:** `BUSINESS_RULES.md` §17; `DATABASE_DESIGN.md` §19; `API_CONTRACT.md` §13.1.
- **Acceptance criteria:** An authorized client can retrieve a date-filtered statement with order, group, and wallet references; totals reconcile to persisted data.
- **Status:** PENDING
- **Verification command:** `npm test -- client-statement`

### CP-038

- **ID:** CP-038
- **Objective:** Implement admin profit/carton reports and CSV/XLSX export.
- **Dependencies:** CP-037; CP-012; CP-010.
- **Relevant specification:** `BUSINESS_RULES.md` §17; `API_CONTRACT.md` §§13.2–13.3; `DEVELOPMENT_ROADMAP.md` Phase 13.
- **Acceptance criteria:** Admin reports are role-protected, date-filtered, exportable, and use private signed-file access where files are generated.
- **Status:** PENDING
- **Verification command:** `npm test -- admin-reports`

### CP-039

- **ID:** CP-039
- **Objective:** Implement business-event notifications and notification read APIs.
- **Dependencies:** CP-016; CP-025; CP-032; CP-035; CP-010.
- **Relevant specification:** `BUSINESS_RULES.md` §16; `API_CONTRACT.md` §§12, 15.
- **Acceptance criteria:** Required estimate/payment/QC/pickup events create client/admin/staff notifications; recipients can list and mark only their own notifications read.
- **Status:** PENDING
- **Verification command:** `npm test -- notifications`

### CP-040

- **ID:** CP-040
- **Objective:** Run the release security and audit readiness review.
- **Dependencies:** CP-011; CP-012; CP-039; all MVP workflow checkpoints.
- **Relevant specification:** `DEVELOPMENT_ROADMAP.md` Phase 15; `AGENTS.md` database/security rules.
- **Acceptance criteria:** Role/RLS tests pass; private files are inaccessible without signed authorization; financial/status/manual-override audits are present; all project checks pass.
- **Status:** PENDING
- **Verification command:** `npm run build`
