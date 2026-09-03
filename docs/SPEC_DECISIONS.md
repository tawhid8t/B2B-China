# Specification Consistency Decisions

Audit date: 2026-08-25

Scope: `BUSINESS_RULES.md`, `STATUS_MACHINE.md`, `DATABASE_DESIGN.md`, `API_CONTRACT.md`, `PROJECT_ARCHITECTURE.md`, and `DEVELOPMENT_ROADMAP.md`. `Vision.txt` was used only to check product intent. No existing specification is changed by this record.

## Decisions Safe to Adopt

### SD-001 — Order item status enum

- **Topic:** Order status values
- **Documents involved:** `BUSINESS_RULES.md`, `STATUS_MACHINE.md`, `DATABASE_DESIGN.md`
- **Difference:** Business rules and the database enum include `estimate_requested` but omit `exception`; the status machine starts order items at `pending_admin_review` and includes `exception`.
- **Recommended canonical behavior:** Use the status-machine order list: `pending_admin_review`, `confirmed`, `queued_for_purchase`, `purchased`, `seller_shipped`, `received_china`, `qc_checked`, `packed`, `sent_guangzhou`, `arrived_guangzhou`, `sent_bangladesh`, `arrived_bangladesh`, `ready_for_pickup`, `completed`, `cancelled`, `exception`. Keep estimate requests in the estimate lifecycle, not `order_status`.
- **Why:** An order item is created only after estimate acceptance, and the detailed transition table requires `exception`.
- **Developer approval required:** No. This follows the more detailed lifecycle specification and the documented source hierarchy.

### SD-002 — Estimate status enum

- **Topic:** Estimate status values
- **Documents involved:** `STATUS_MACHINE.md`, `DATABASE_DESIGN.md`
- **Difference:** The status machine allows `cancelled`; the database enum omits it.
- **Recommended canonical behavior:** Add `cancelled` to `estimate_status` and allow only the cancellation transitions defined by the status machine.
- **Why:** Otherwise valid status-machine transitions cannot be persisted.
- **Developer approval required:** No.

### SD-003 — Estimate acceptance and order confirmation

- **Topic:** Endpoint name, confirmation meaning, and group assignment timing
- **Documents involved:** `BUSINESS_RULES.md`, `STATUS_MACHINE.md`, `API_CONTRACT.md`, `PROJECT_ARCHITECTURE.md`, `DEVELOPMENT_ROADMAP.md`
- **Difference:** Project architecture names `POST /api/orders/confirm`; the detailed API contract and roadmap name `POST /api/estimates/:id/accept`. The word “confirmed” is also used for both client estimate acceptance and the later admin-approved order status. The accept API returns a group while the new order is still `pending_admin_review`.
- **Recommended canonical behavior:** Use `POST /api/estimates/:id/accept`. In one transaction, move the estimate through `accepted` to `converted_to_order`, create the order item as `pending_admin_review`, and assign it to the client’s active group. Reserve order status `confirmed` for the later admin approval.
- **Why:** This is the complete contract repeated by the roadmap and matches the status machine. It also removes an ambiguous duplicate confirmation action.
- **Developer approval required:** No. Do not introduce `/api/orders/confirm` as a second canonical route.

### SD-004 — API success envelope

- **Topic:** API response shape
- **Documents involved:** `API_CONTRACT.md`, `PROJECT_ARCHITECTURE.md`
- **Difference:** The architecture’s product-resolution example returns an unwrapped object; the API contract requires `{ "data": ..., "meta": ... }` for successful responses.
- **Recommended canonical behavior:** Use the API contract envelope for every endpoint, including product resolution.
- **Why:** The API contract is the detailed authority for response shapes.
- **Developer approval required:** No.

### SD-005 — Parcel receipt with QC result

- **Topic:** Order transition and receive-parcel response
- **Documents involved:** `STATUS_MACHINE.md`, `API_CONTRACT.md`, `PROJECT_ARCHITECTURE.md`
- **Difference:** `POST /api/staff/parcels/receive` accepts a completed QC result but its example returns `orderItemStatus: received_china`. The status machine requires `received_china -> qc_checked` after piece count, weight, and QC are recorded.
- **Recommended canonical behavior:** Persist both transitions and their audit events. If the request supplies a completed, non-`pending` QC result, return `qc_checked`; return `received_china` only when QC remains pending or incomplete.
- **Why:** The combined endpoint otherwise records completed QC while leaving the order before the QC transition.
- **Developer approval required:** No.

### SD-006 — Meaning of `partial` and `missing`

- **Topic:** Receiving/QC statuses
- **Documents involved:** `BUSINESS_RULES.md`, `STATUS_MACHINE.md`, `DATABASE_DESIGN.md`
- **Difference:** Business rules say quantity shortages make “status” `partial` or `missing`, but neither is an order status. They are QC values, while the parcel lifecycle uses `partially_received`.
- **Recommended canonical behavior:** Store `partial`/`missing` in `parcel_items.qc_status`; set the parcel to `partially_received` where appropriate; do not add these values to `order_status`. Use `exception` when the order requires operational review.
- **Why:** This preserves the typed lifecycles and matches the detailed QC and parcel state machines.
- **Developer approval required:** No.

### SD-007 — Manual courier tracking status

- **Topic:** Courier status value
- **Documents involved:** `STATUS_MACHINE.md`, `API_CONTRACT.md`
- **Difference:** The status machine defines `manual_recorded`; the courier-sync response uses `manual_tracking_recorded`.
- **Recommended canonical behavior:** Use `manual_recorded` in persistence and API responses.
- **Why:** It is the defined status-machine value.
- **Developer approval required:** No.

### SD-008 — Global settings permissions

- **Topic:** Role permissions for rates and profit rules
- **Documents involved:** `BUSINESS_RULES.md`, `DATABASE_DESIGN.md`, `API_CONTRACT.md`, `PROJECT_ARCHITECTURE.md`
- **Difference:** Business rules assign the default exchange rate to super admin and allow admin only an order-specific adjusted rate. Architecture lists exchange, shipping, and profit settings in both admin and super-admin responsibilities, while settings endpoints omit explicit roles.
- **Recommended canonical behavior:** Restrict global exchange-rate, shipping-rate, profit-rule, category-rule, and shipping-mark changes to `super_admin`. Allow `admin` to set an order-specific adjusted rate or final cost only as an audited manual override.
- **Why:** This follows the explicit high-priority rate rule and the least-privilege role definition.
- **Developer approval required:** No.

### SD-009 — Staff account and role management

- **Topic:** Role permissions
- **Documents involved:** `DATABASE_DESIGN.md`, `PROJECT_ARCHITECTURE.md`, `DEVELOPMENT_ROADMAP.md`
- **Difference:** Architecture lists staff management in the admin panel, while the role roadmap gives role management to super admin and the database grants super admin full user/policy control.
- **Recommended canonical behavior:** Only `super_admin` may create/deactivate staff accounts or change roles. `admin` may view operational staff identities and assign work, without changing authentication or roles.
- **Why:** This reconciles operational staff management with the explicit security boundary.
- **Developer approval required:** No.

### SD-010 — Approval actor identity

- **Topic:** Payment approval request shape and audit identity
- **Documents involved:** `BUSINESS_RULES.md`, `DATABASE_DESIGN.md`, `API_CONTRACT.md`, `PROJECT_ARCHITECTURE.md`
- **Difference:** The payment approval request accepts `approvedBy`, while audit and authorization rules require the real authenticated actor.
- **Recommended canonical behavior:** Derive `reviewed_by`/audit actor from the authenticated server session. Do not trust `approvedBy`; if temporarily accepted for compatibility, require it to match the session and do not use it as authority.
- **Why:** A caller-supplied actor can falsify financial audit history.
- **Developer approval required:** No. This is required by the security and audit rules.

### SD-011 — API fields missing from database tables

- **Topic:** Request-to-column mapping
- **Documents involved:** `API_CONTRACT.md`, `DATABASE_DESIGN.md`
- **Difference:** Estimate creation accepts `notes`, but `estimates` has no notes column. Payment-proof upload also accepts `notes`, but `payment_proofs` has no notes column.
- **Recommended canonical behavior:** Add nullable `notes text` columns to both tables, or explicitly remove the fields from the public contract before implementation. The additive-column option is canonical for the current contract.
- **Why:** Accepted request data must have defined persistence behavior.
- **Developer approval required:** No for the additive columns.

### SD-012 — Manual products without provider item IDs

- **Topic:** Manual product API and database constraint
- **Documents involved:** `BUSINESS_RULES.md`, `DATABASE_DESIGN.md`, `API_CONTRACT.md`
- **Difference:** Manual product creation is required and its request omits `providerItemId`, but `product_links.provider_item_id` is non-null and part of a unique index.
- **Recommended canonical behavior:** Parse and store a provider item ID when available; otherwise allow `provider_item_id` to be null for manual records and apply uniqueness only to non-null provider IDs.
- **Why:** Generating a fake provider ID would mix internal identity with external identity and make later reconciliation unreliable.
- **Developer approval required:** No.

### SD-013 — Wallet statement references

- **Topic:** Wallet response shape
- **Documents involved:** `BUSINESS_RULES.md`, `DATABASE_DESIGN.md`, `API_CONTRACT.md`
- **Difference:** Business rules require debit history to show order, product, group, CNY amount, BDT equivalent, and exchange rate. The wallet transaction response omits order/product/group references.
- **Recommended canonical behavior:** Add order item, product snapshot, and group identifiers/codes to relevant wallet-statement entries while retaining both currency amounts and the applied rate.
- **Why:** The current response cannot meet the client-visible ledger rule or support reconciliation.
- **Developer approval required:** No. This is an additive response change.

### SD-014 — Exception records have no database table

- **Topic:** Database tables
- **Documents involved:** `STATUS_MACHINE.md`, `DATABASE_DESIGN.md`, `DEVELOPMENT_ROADMAP.md`
- **Difference:** The status machine defines persistent exception records, fields, assignments, and statuses; the database design defines no exception table.
- **Recommended canonical behavior:** Add an `exceptions` table containing the fields and lifecycle specified in `STATUS_MACHINE.md`, with entity references, assignment, resolution data, and audit timestamps.
- **Why:** Entity status `exception` alone cannot store or resolve the required exception workflow.
- **Developer approval required:** No. This fills an explicitly specified persistence gap additively.

### SD-015 — Manual entry versus manual override

- **Topic:** Manual override permissions
- **Documents involved:** `BUSINESS_RULES.md`, `STATUS_MACHINE.md`, `API_CONTRACT.md`, `PROJECT_ARCHITECTURE.md`
- **Difference:** Staff are allowed to manually enter initial receiving, QC, carton, and tracking data, while the status machine says manual override is admin/super-admin only.
- **Recommended canonical behavior:** Treat first-time, role-authorized staff input as normal data entry. Treat changing an existing/system-derived value, bypassing a transition, or approving an otherwise ineligible action as an override restricted to `admin`/`super_admin`. Every override records actor, time, reason, old value, and new value.
- **Why:** This preserves staff workflows without weakening override controls.
- **Developer approval required:** No.

## Decisions Requiring Owner/Developer Confirmation

### OC-001 — Wallet reservation, debit timing, and insufficient balance (owner confirmed)

- **Topic:** Wallet reservation/debit behavior and estimate acceptance
- **Documents involved:** `BUSINESS_RULES.md`, `STATUS_MACHINE.md`, `DATABASE_DESIGN.md`, `API_CONTRACT.md`, `PROJECT_ARCHITECTURE.md`, `DEVELOPMENT_ROADMAP.md`
- **Difference:** Business rules explicitly leave “reserve or debit” undecided. Architecture says orders debit. The accept-estimate response implies reservation, the roadmap permits either, and the API lists `INSUFFICIENT_WALLET_BALANCE` even though business rules require partial wallet use plus an exchange-rate-priced remainder.
- **Recommended canonical behavior:** On `POST /api/estimates/:id/accept`, reserve only the available CNY balance, record the uncovered remainder, and return a visible warning without blocking acceptance. At `POST /api/extension/provider-order-sync` or the equivalent audited admin purchase commitment, append a full reservation release and an `order_debit` for the wallet-covered portion. Release active reservations on rejection/cancellation. Price the uncovered remainder with the estimate snapshot rate or an audited admin-adjusted rate.
- **Why:** This avoids debiting before admin approval and preserves the explicitly required partial-balance flow, but the financial commitment point is a business decision.
- **Developer approval required:** No. The owner confirmed this behavior for implementation; no automatic reservation-expiry rule was requested.

### OC-002 — Reversing posted wallet transactions (owner confirmed)

- **Topic:** Append-only accounting and wallet transaction states
- **Documents involved:** `BUSINESS_RULES.md`, `STATUS_MACHINE.md`, `DATABASE_DESIGN.md`
- **Difference:** Business/database rules require immutable posted transactions and correction by adjustment. The status machine defines `posted -> reversed` and allows either a new transaction or marking the original reversed. The schema has no reversal link.
- **Recommended canonical behavior:** Never mutate a posted transaction. Create a new posted adjustment/refund that links to the original transaction; keep the original `posted`. Add an explicit reversal link such as `reverses_transaction_id` and derive the net balance from both rows.
- **Why:** Marking the original row `reversed` conflicts with append-only financial history and can change historical balances silently.
- **Developer approval required:** No. The owner confirmed linked full/partial refund or adjustment entries; the posted original remains immutable.

### OC-003 — Carton lifecycle and label-print transition

- **Topic:** Carton statuses, defaults, transitions, and endpoints
- **Documents involved:** `BUSINESS_RULES.md`, `STATUS_MACHINE.md`, `DATABASE_DESIGN.md`, `API_CONTRACT.md`, `PROJECT_ARCHITECTURE.md`
- **Difference:** The status machine includes `label_printed` and `cancelled`, but the database enum omits both and defaults to `packed`. Carton creation returns `packed` plus a generated label. The Guangzhou-tracking endpoint then returns `sent_guangzhou`, but the only valid dispatch transition starts at `label_printed`; no API records printing.
- **Recommended canonical behavior:** Use the full status-machine enum and a database default of `draft`. A complete create request may transition atomically to `packed`; label generation alone must not claim it was printed. Record an explicit staff label-print/attach action before allowing Guangzhou dispatch.
- **Why:** The current contract forces an invalid `packed -> sent_guangzhou` jump or silently treats generation as physical printing.
- **Developer approval required:** Yes. Confirm whether physical print/attachment must be a persisted action and approve the endpoint/action shape used to record it.

### OC-004 — Missing payment-proof transition APIs (owner confirmed)

- **Topic:** Payment states and API endpoint names
- **Documents involved:** `STATUS_MACHINE.md`, `API_CONTRACT.md`, `DEVELOPMENT_ROADMAP.md`
- **Difference:** `needs_review` and `cancelled` are valid payment-proof states with defined transitions, but the API exposes only upload, approve, and reject actions.
- **Recommended canonical behavior:** Expose authenticated actions for marking `needs_review` and cancelling an eligible pending proof; continue to enforce the exact status-machine transitions and require reasons where applicable.
- **Why:** Without a contract, these documented states can be reached only by direct database edits or an undocumented generic update.
- **Developer approval required:** No. The owner confirmed explicit approve, reject, needs-review, and cancellation actions.

### OC-005 — Immutable product snapshots versus provider uniqueness

- **Topic:** Product tables and historical snapshots
- **Documents involved:** `BUSINESS_RULES.md`, `DATABASE_DESIGN.md`, `PROJECT_ARCHITECTURE.md`
- **Difference:** Product data attached to historical orders must remain unchanged, but `product_links` is unique on `(provider, provider_item_id)`. Updating that single row would rewrite historical title/image/category data; inserting a refreshed snapshot would violate the unique index.
- **Recommended canonical behavior:** Treat product/SKU snapshots referenced by accepted estimates or orders as immutable. Permit versioned rows for the same provider item, with uniqueness including a revision/version identity or an equivalent immutable-snapshot mechanism.
- **Why:** The existing uniqueness rule and the historical snapshot rule cannot both hold if supplier data is refreshed.
- **Developer approval required:** Yes. Confirm the versioning/deduplication schema before product persistence is extended.

### OC-006 — Provider orders and multiple seller tracking numbers

- **Topic:** Database cardinality and API request/response shapes
- **Documents involved:** `BUSINESS_RULES.md`, `DATABASE_DESIGN.md`, `API_CONTRACT.md`
- **Difference:** One order item may have multiple seller tracking numbers, and the database can associate multiple parcels, but provider sync accepts one `sellerTrackingNumber` and order detail returns one `providerOrder` object. `provider_orders` also stores only one seller tracking string per row while allowing multiple provider-order rows per order item.
- **Recommended canonical behavior:** Model provider orders and parcels as collections. Return `providerOrders: []`, persist each seller tracking number as a parcel/tracking entity, and allow sync to submit multiple tracking numbers without duplicating paid provider orders.
- **Why:** The singular contract loses split shipments and makes retries or multiple provider orders ambiguous.
- **Developer approval required:** Yes. Approve the collection shape and backward-compatibility handling for the singular fields.

### OC-007 — Reopening cancelled or completed records

- **Topic:** Terminal statuses and manual overrides
- **Documents involved:** `STATUS_MACHINE.md`, `BUSINESS_RULES.md`
- **Difference:** General rules imply cancelled/completed records may return to active workflow with admin override, but no transition is defined from either terminal state, and the order-specific rule says completed orders are read-only except for super-admin correction.
- **Recommended canonical behavior:** Keep normal APIs from reopening terminal records. Allow only `super_admin` to correct completed records through a fully audited correction path. Prefer a replacement/new record for renewed work; define a specific cancelled-record restoration transition only if the owner requires it.
- **Why:** “Return to active workflow” is materially different from correcting history and needs an explicit business rule.
- **Developer approval required:** Yes. Confirm whether cancelled records may be restored, by whom, and to which prior state.

## Blocking Decisions Before Further Implementation

Implementation of linked wallet reversals, carton dispatch, product snapshot persistence, provider split-shipment sync, payment review/cancellation actions, or terminal-state restoration should wait for the corresponding owner/developer confirmations above.
