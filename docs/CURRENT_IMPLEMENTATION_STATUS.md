# Current Implementation Status

Audit date: 2026-08-25. Classification reflects the current source tree only; no runtime credentials or Supabase project were available for verification.

| Module | Current state | Major missing pieces | Blocking dependencies |
| --- | --- | --- | --- |
| project foundation | PARTIAL | Clean typecheck/build; non-interactive lint configuration; test runner and test script. | Type errors in `lib/supabase/server.ts`; ESLint setup. |
| authentication | SCAFFOLD | Sign-up/sign-in/sign-out/session flows; browser Supabase client; authenticated UI. | Supabase project credentials; completed server client; middleware/session handling. |
| role authorization | SCAFFOLD | Server-side route guards and per-role route access; authenticated actor derivation. | Authentication implementation; middleware; RLS completion. |
| RLS | PARTIAL | Policies for all operational/settings/audit tables; client product access; scoped staff access; write policies; policy tests. | Applied Supabase migration; authentication; approved role decisions. |
| database | PARTIAL | Additional migrations for approved schema decisions; typed state coverage; status/audit functions and triggers; missing operational tables/columns. | Supabase project; `SPEC_DECISIONS.md` owner decisions; migration execution. |
| client ordering | MOCK | Wired link submission, SKU selection, estimate request/accept/reject, client-scoped data, and persistence. | Authentication; product lookup; estimates; database/RLS. |
| product lookup | PARTIAL | Authenticated contract-compliant route; Supabase snapshot persistence; failure/manual-product flow; OTAPI verification. | OTAPI credentials; Supabase persistence; authentication. |
| estimates | MOCK | Database-backed calculation using managed historical rates/shipping/profit rules; validity and accept/reject lifecycle; audit history. | Settings data; database/RLS; estimate/order confirmation decision. |
| orders/groups | MOCK | Contractual estimate-accept endpoint; persistent order/group creation; status transition enforcement; group capacity/totals. | Database functions/triggers; authentication; wallet timing decision. |
| admin operations | MOCK | Protected admin screens and APIs for review, approval, adjustments, settings, audit logs, and exports. | Authentication/role authorization; database/RLS; settings permission decision. |
| wallet/payment | MOCK | Payment-proof storage/review lifecycle; append-only ledger posting/reservals; wallet statement; insufficient-balance handling. | Authentication/RLS; storage; wallet timing and reversal decisions. |
| purchasing | MOCK | Persisted purchase batches/queue, admin approval gate, provider-order writes, and exception handling. | Order transitions; database/RLS; extension authentication. |
| Chrome extension | SCAFFOLD | Admin authentication/token handling; API error handling; SKU/variant selection; reliable cart interaction; provider sync UI. | Protected purchase-queue API; extension security design; provider page adapters. |
| provider tracking | MOCK | Persisted provider orders/parcels/tracking events; provider/courier adapters; retry/error logging; split-shipment handling. | Database/RLS; provider credentials; provider-order cardinality decision. |
| warehouse receiving | MOCK | Parcel search/scan, assigned-work authorization, persistent receipt, duplicate handling, photos, and audit events. | Authentication/RLS; parcel schema/functions; storage. |
| QC | MOCK | Persisted QC evidence/results, fail/partial/missing workflow, admin approval, notifications, and packing gate. | Warehouse receiving; database/RLS; status-transition enforcement. |
| cartons | MOCK | Eligible-item validation, transactional carton/item creation, label generation/storage, print-state recording, and audit history. | QC workflow; storage; carton lifecycle decision. |
| Guangzhou forwarding | SCAFFOLD | Required carton tracking endpoint, dispatch eligibility checks, persisted tracking events, receipt/forwarding status updates. | Carton lifecycle decision; database/RLS; courier adapter. |
| reporting | NOT_STARTED | Statement, profit, carton, and export APIs/views; CSV/XLSX generation; authorization. | Complete persisted operational/financial data; reporting views; role authorization. |
| notifications | SCAFFOLD | Notification creation triggers/services, delivery/realtime APIs, read-state UI, and role/client scoping. | Authentication/RLS; completed business workflows; Supabase Realtime. |
| storage/security | SCAFFOLD | Storage buckets/policies, signed upload/download routes, private-file enforcement, secret validation, integration logging, and security tests. | Supabase project configuration; authentication/RLS; storage policy design. |

## Check Results

| Check | Result | Recorded issue |
| --- | --- | --- |
| `npm install` | Passed | Dependencies were already current. npm reported 3 high-severity vulnerabilities and two pending install-script approvals (`sharp`, `unrs-resolver`). |
| `npm run typecheck` | Failed | `lib/supabase/server.ts`: `cookiesToSet`, `name`, `value`, and `options` have implicit `any` types. |
| `npm run lint` | Failed | `next lint` starts interactive first-time ESLint configuration because no ESLint config exists; it cannot run non-interactively. The script is also deprecated by Next.js. |
| `npm run build` | Failed | Next.js compiled application code, then failed type validation on the same four implicit-`any` errors in `lib/supabase/server.ts`. |
| `npm test` | Failed | `package.json` has no `test` script and no test directory/framework. |
