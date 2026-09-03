# Current Implementation Status

Audit date: 2026-08-30. Classification reflects the current source tree and the linked Supabase migration state verified during wallet/payment implementation.

| Module | Current state | Major missing pieces | Blocking dependencies |
| --- | --- | --- | --- |
| project foundation | COMPLETE | Typecheck, ESLint, full Node test runner, and production build are operational. | None for wallet/payment release. |
| authentication | SCAFFOLD | Sign-up/sign-in/sign-out/session flows; browser Supabase client; authenticated UI. | Supabase project credentials; completed server client; middleware/session handling. |
| role authorization | SCAFFOLD | Server-side route guards and per-role route access; authenticated actor derivation. | Authentication implementation; middleware; RLS completion. |
| RLS | PARTIAL | Policies for all operational/settings/audit tables; client product access; scoped staff access; write policies; policy tests. | Applied Supabase migration; authentication; approved role decisions. |
| database | PARTIAL | Additional migrations for approved schema decisions; typed state coverage; status/audit functions and triggers; missing operational tables/columns. | Supabase project; `SPEC_DECISIONS.md` owner decisions; migration execution. |
| client ordering | MOCK | Wired link submission, SKU selection, estimate request/accept/reject, client-scoped data, and persistence. | Authentication; product lookup; estimates; database/RLS. |
| product lookup | PARTIAL | Authenticated contract-compliant route; Supabase snapshot persistence; failure/manual-product flow; OTAPI verification. | OTAPI credentials; Supabase persistence; authentication. |
| estimates | MOCK | Database-backed calculation using managed historical rates/shipping/profit rules; validity and accept/reject lifecycle; audit history. | Settings data; database/RLS; estimate/order confirmation decision. |
| orders/groups | MOCK | Contractual estimate-accept endpoint; persistent order/group creation; status transition enforcement; group capacity/totals. | Database functions/triggers; authentication; wallet timing decision. |
| admin operations | MOCK | Protected admin screens and APIs for review, approval, adjustments, settings, audit logs, and exports. | Authentication/role authorization; database/RLS; settings permission decision. |
| wallet/payment | COMPLETE | No remaining mock financial behavior. | Six phases deployed: funding/review, statements/corrections/exports, order lifecycle, notifications, live dashboard, and reconciliation. |
| purchasing | MOCK | Persisted purchase batches/queue, admin approval gate, provider-order writes, and exception handling. | Order transitions; database/RLS; extension authentication. |
| Chrome extension | SCAFFOLD | Admin authentication/token handling; API error handling; SKU/variant selection; reliable cart interaction; provider sync UI. | Protected purchase-queue API; extension security design; provider page adapters. |
| provider tracking | MOCK | Persisted provider orders/parcels/tracking events; provider/courier adapters; retry/error logging; split-shipment handling. | Database/RLS; provider credentials; provider-order cardinality decision. |
| warehouse receiving | MOCK | Parcel search/scan, assigned-work authorization, persistent receipt, duplicate handling, photos, and audit events. | Authentication/RLS; parcel schema/functions; storage. |
| QC | MOCK | Persisted QC evidence/results, fail/partial/missing workflow, admin approval, notifications, and packing gate. | Warehouse receiving; database/RLS; status-transition enforcement. |
| cartons | MOCK | Eligible-item validation, transactional carton/item creation, label generation/storage, print-state recording, and audit history. | QC workflow; storage; carton lifecycle decision. |
| Guangzhou forwarding | SCAFFOLD | Required carton tracking endpoint, dispatch eligibility checks, persisted tracking events, receipt/forwarding status updates. | Carton lifecycle decision; database/RLS; courier adapter. |
| reporting | NOT_STARTED | Statement, profit, carton, and export APIs/views; CSV/XLSX generation; authorization. | Complete persisted operational/financial data; reporting views; role authorization. |
| notifications | PARTIAL | Wallet/payment events, recipient-only list/read APIs, and client/admin inboxes are complete. Estimate, QC, and pickup events remain with those workflows. | Unfinished non-financial operational workflows. |
| storage/security | SCAFFOLD | Storage buckets/policies, signed upload/download routes, private-file enforcement, secret validation, integration logging, and security tests. | Supabase project configuration; authentication/RLS; storage policy design. |

## Check Results

| Check | Result | Recorded issue |
| --- | --- | --- |
| `npm install` | Passed | Dependencies were already current. npm reported 3 high-severity vulnerabilities and two pending install-script approvals (`sharp`, `unrs-resolver`). |
| `npm run typecheck` | Passed | No TypeScript errors. |
| `npm run lint` | Passed with warning | No errors; one pre-existing `next/image` optimization warning in the client product statement. |
| `npm run build` | Passed | Production build generated all client/admin wallet, payment, notification, and API routes. |
| `npm test` | Passed | 156 tests passed, including all wallet/payment Phase 1–6 static regressions. |
