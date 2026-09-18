# Web operations MVP launch backlog

**Checkpoint:** 2026-09-18. Work in this order. Each task starts from [the handoff](./DECEMBER_HANDOFF.md) and its [audit evidence](./LAUNCH_READINESS_AUDIT.md). `P0` means the web operations MVP should not launch without the gate; `P1` is a specified capability that can follow only if the product owner explicitly removes it from the MVP commitment. Keep the paused Expo app outside these gates.

## Phase 0 — preserve and reproduce the checkpoint

| ID | Priority | Work | Acceptance gate |
| --- | --- | --- | --- |
| **L0 — first December task** | P0 | Check out the latest GitHub `main` checkpoint containing the September source and handoff; compare its 22 added migrations with the deployed migration list. The pre-GitHub manifest in the handoff records exactly what was preserved. Keep the ignored local operational SQL helper out of public source. Use only an empty local/dedicated staging target for the fictional seed. | A future agent can reproduce `npm ci`, typecheck, lint, web tests, build, and the staged admin scenarios from GitHub; no migration/seed is applied to business data. Record changed test counts rather than assuming 256 remains current. |
| L1 | P0 | Create a credentialed, separate staging environment and repeat the complete business journey with fixture accounts and real role boundaries. Record request IDs, status/audit rows, and screenshots where helpful. | Client, receiver, packer, admin, and super admin permissions are exercised; wrong-role and cross-client requests fail; every successful transition creates expected durable records. No real provider payment is made by an automated test. |

## Phase 1 — protect identity, money, and data

| ID | Priority | Work | Acceptance gate |
| --- | --- | --- | --- |
| S1 | P0 | Verify and repair Supabase SSR session renewal across login, expiry, refresh, logout, page navigation, and API calls. Review the pass-through `middleware.ts` and server cookie-writing assumptions. | Browser sessions remain valid when refresh is allowed, expire cleanly when not, and never grant a stale/wrong role; automated browser coverage includes the expiry boundary. |
| S2 | P0 | Review all service-role and SECURITY DEFINER entry points, especially extension credential wrappers, Cainiao RPCs, client read/favorite RPCs, and `public.rls_auto_enable()` grants. Triage the live Supabase security advisor findings and password policy. | No anonymous or wrong-role path can read/change client or financial data; privileged functions have justified grants and ownership checks; security advisors are clean or each remaining item has a documented rationale and compensating test. |
| S3 | P0 | Reproduce and assess `npm audit --omit=dev` findings, especially `next` critical and three high package findings. Upgrade compatible dependencies or document a tested mitigation if no safe upgrade exists. | Release dependency scan has no unaccepted critical/high finding; typecheck, lint, tests, build, and key browser flows pass on the resolved lockfile. |
| S4 | P0 | Run staging SQL/RLS/storage tests and financial reconciliation against deployed schema. Exercise proof upload, review, correction, partial reservation, purchase commitment, retry, and CSV export. | Client isolation and staff financial denial pass; proof files stay private; posted ledger entries are immutable; duplicate actions do not duplicate credit/debit; balances and exported records reconcile. |

## Phase 2 — finish the client order contract

| ID | Priority | Work | Acceptance gate |
| --- | --- | --- | --- |
| C1 | P0 | Product owner chooses the canonical **multi-SKU estimate-before-order** behavior and the snapshot strategy (OC-005). Reconcile direct `/api/orders/confirm` with persisted single-SKU estimate APIs without breaking existing orders. | A client can review a server-authoritative, persisted, time-limited estimate for every selected SKU before acceptance; refresh/retry and expiry are safe; historical price/product snapshots remain unchanged. Accepted multi-SKU orders remain atomic and idempotent. |
| C2 | P0 | Complete client order detail and recovery: protected `/client/orders/[id]`, order/status/cost timeline, valid notification links, and refresh-safe order completion. | Clients can open only their own detail; links from Orders and notifications work on phone and desktop; refresh/back does not lose a successfully confirmed order or create a duplicate. |
| C3 | P0 | Verify real product lookup, supplier attributes, manual fallback, and client phone ordering against live provider examples in staging. Preserve provider-original SKU values for purchasing while displaying client-friendly text. | 1688 and Taobao links resolve or fail clearly; unavailable/malformed variants are handled; selected SKU/quantity/price match the supplier and the persisted snapshot; manual review can complete a blocked product without mock data. |
| C4 | P1 | Finish Favorites/Repeat Order according to its feature specification or explicitly defer it from the first launch. The deployed `client_favorites` grants make the current refresh route fail. | If included: owned favorites list/create/archive works; refresh uses an ownership-checked server path and fresh immutable product snapshot; new estimate/order uses current pricing and cannot reuse old values. If deferred: remove broken entry points and document the launch boundary. |

## Phase 3 — prove purchasing and supplier tracking

| ID | Priority | Work | Acceptance gate |
| --- | --- | --- | --- |
| P1 | P0 | Complete product-wide admin review and purchase-task state tests against staging, including rejected/needs-review orders and exact supplier SKU correction. | One approved product with multiple lines creates one eligible task; no line enters purchasing early; decisions and corrections record actor/reason/status history; retries are idempotent. |
| P2 | P0 | Install the private extension in Chrome against the actual 1688 cart and staging API; verify origin, credential generation/revocation, item selection, cart result, paid capture, admin approval, and errors. Keep payment manual. | Every selected supplier SKU and quantity matches the reviewed order; cart-added is never marked purchased; paid amount/order reference are approved once; expired/revoked credentials fail immediately; no supplier password is stored. |
| P3 | P0 | Resolve OC-006 and complete seller tracking/parcel matching for split shipments. Test duplicate and ambiguous numbers, lifecycle, and client/admin visibility. | Multiple tracking numbers map to the right order lines without duplicating paid provider orders; invalid or unmatched tracking enters an actionable review queue; status and audit events remain consistent. |

## Phase 4 — make warehouse and delivery durable

| ID | Priority | Work | Acceptance gate |
| --- | --- | --- | --- |
| W1 | P0 | Validate Cainiao manual and screenshot imports, private evidence, OCR review, duplicate/concurrent collection, and unmatched linking on phones. Join collected parcels to real receiving. | Staff can correct OCR before import; one tracking number is collected once; unmatched parcels remain reviewable; role restrictions, evidence retention, and order link are verified in staging. |
| W2 | P0 | Replace synthetic `/api/staff/parcels/receive` with durable, audited receiving and QC, including piece count, actual weight, photos, partial/missing/fail, and exception handling. | Receipt and QC produce persistent rows/status events; duplicate scans are safe; failed QC cannot enter normal packing without audited admin approval. |
| W3 | P0 | Obtain OC-003 carton label/print decision, then replace synthetic carton and courier routes with transactional packing, labels, tracking, and Guangzhou/delivery transitions. | Only QC-eligible items enter a carton; generated/printed/attached states reflect physical work; tracking and dispatch persist; client/admin see the same carton/order state; invalid transitions fail explicitly. |

## Phase 5 — reporting and release gate

| ID | Priority | Work | Acceptance gate |
| --- | --- | --- | --- |
| R1 | P0 | Provide the operational reports needed to replace spreadsheets: supplier purchase, parcel/QC, carton/shipping, estimate-versus-actual cost, profit, and monthly client summary; retain existing wallet/payment exports. | Role-scoped totals reconcile to source transactions and order items; exports use safe spreadsheet formatting; staff cannot access finance/profit data. Confirm exact report/Excel scope with the owner before implementation. |
| R2 | P0 | Add missing estimate, QC, exception, dispatch, and pickup notification producers and repair destinations. | Intended recipient sees each event once; no other user can list/read it; every CTA lands on an existing protected detail page. |
| R3 | P0 | Run a full staged release rehearsal: public registration → live provider lookup → accepted estimate → admin review → extension cart/manual payment/capture → seller tracking → Cainiao pickup → QC → carton → Guangzhou → final client statement, including failures and retries. | All steps complete with correct money, ownership, snapshots, and status history; mobile-width/keyboard checks pass; performance of large order-card/statement lists is acceptable; critical/high security and dependency findings are closed or explicitly accepted with evidence. |
| R4 | P0 | Establish a production release runbook and gated delivery path: hosting/domain/HTTPS, per-environment secrets, CI checks, migration plan, database backup/restore drill, rollback/recovery, and operational alerts. | A fresh environment can be deployed from a source checkpoint; a failed deploy/migration has a rehearsed recovery path; on-call owner can see API, auth, provider, and financial failures without exposing secrets or private customer data. |

## Owner decisions to capture before dependent implementation

The existing [spec decision register](./SPEC_DECISIONS.md) already marks **OC-003** carton label/print transition, **OC-005** immutable supplier snapshot strategy, **OC-006** provider split tracking/API compatibility, and **OC-007** reopening terminal records as unconfirmed. Record decisions there and update the API/database/status specs together. Also confirm whether Favorites/Repeat and every listed report are first-launch commitments; until then, this backlog treats complete reports as a launch gate and Favorites as a conditional P1. Do not reopen already owner-confirmed wallet reservation/reversal decisions OC-001/OC-002 without a new business requirement.

## Work deliberately deferred

Resume the Expo business app only after the web operation flows and shared contracts are stable. Courier API automation, push notifications, advanced caching, and broader analytics can follow reliable manual operations. Reassess any deferral if the product owner changes the launch promise.
