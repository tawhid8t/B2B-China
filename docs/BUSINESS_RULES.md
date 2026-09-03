# Business Rules

## 1. Purpose

This document defines the operating rules for the cross-border sourcing and fulfillment platform.

The system must support the real business process from client order creation to China purchasing, warehouse receiving, repacking, Guangzhou forwarding, Bangladesh arrival, client pickup, payment accounting, and historical reporting.

Business rules should be enforced by backend logic, database constraints, admin permissions, and audit logs where possible.

## 2. Currency Rules

### 2.1 Supported Currencies

- CNY/RMB is the purchasing currency.
- BDT is the client-facing currency.
- The system may display both currencies when needed.

### 2.2 Default Exchange Rate

- Super admin must be able to set a default CNY-to-BDT exchange rate.
- The initial production default is `1 CNY = 19.2000 BDT`.
- The default exchange rate is used when no client-specific advance balance is available.
- Exchange rates must be stored historically.
- Exchange-rate rows are append-only; a changed default creates a newly effective row.
- Old orders must not change when the default exchange rate changes.

### 2.3 Advance Payment Exchange Rate

- When a client pays advance money, the admin records the BDT amount and the exchange rate for that payment date.
- The system converts the BDT amount into CNY/RMB wallet credit.
- The converted CNY amount is credited to the client wallet.
- The exchange rate used for a payment must never be silently changed after approval.

### 2.4 Admin-Adjusted Exchange Rate

- Admin may apply an adjusted exchange rate for orders beyond a client’s advance balance.
- The client must be able to see which rate was used.
- The system must record who set the adjusted rate and when.

## 3. Wallet Rules

### 3.1 Wallet Ledger

- Wallets are ledger-based, not editable balances.
- Every credit, debit, refund, and adjustment must create a wallet transaction.
- Existing approved wallet transactions must not be edited.
- If correction is needed, the system must create an adjustment transaction.
- A full or partial refund/adjustment must link to the original transaction and include a reason.

### 3.1.1 Wallet Totals

- `total funds` includes posted credits, debits, refunds, and adjustments but excludes reservation and reservation-release entries.
- `active reservations` is the remaining net CNY held by posted reservation entries and their releases.
- `available balance` is the sum of every posted ledger entry and must never be negative.

### 3.2 Wallet Credit

- Wallet credit is created only after admin approval.
- Client-uploaded proof alone does not increase wallet balance.
- Payment proof status values should include `pending`, `approved`, `rejected`, and `needs_review`.
- The client-claimed BDT amount remains historical. If admin approves a different verified amount, both amounts and the required reason must remain visible.

### 3.3 Wallet Debit

- Confirmed orders reserve only available wallet funds; confirmation never posts the final order debit and never makes the wallet negative.
- At audited supplier purchase commitment, release the active reservation and debit only the wallet-covered amount.
- Wallet debit should show:
  - Order reference
  - Product reference
  - Group reference
  - CNY amount
  - BDT equivalent
  - Exchange rate used

### 3.4 Insufficient Balance

- If wallet balance is enough, the order uses wallet credit.
- If wallet balance is partially enough, the system applies wallet balance first.
- Any remaining amount is priced using the order/estimate snapshot rate or an admin-adjusted rate with a required audit reason.
- Client must receive a visible alert when wallet balance is insufficient.

## 4. Product Link Rules

### 4.1 Supported Product Sources

- Supported sources are 1688, Taobao, and Tmall.
- Unsupported product links must return a clear error.
- Admin must be able to manually create a product if API lookup fails.

### 4.2 Product Data

The system should store:

- Original product link
- Source provider
- Provider item ID
- Product title
- Product images
- SKU/variant data
- Price in CNY
- Domestic China delivery fee
- Category
- Raw API response where available

### 4.3 Product Images

- Product images are required for client and admin identification.
- If API image fetch fails, admin/client must be able to upload or attach an image manually.
- Product image history should remain connected to the order even if the supplier later changes the listing.

### 4.4 Product Availability

- If a product becomes unavailable before purchase, admin must mark it as unavailable.
- Client should be notified.
- Admin may offer replacement, cancellation, or refund/credit.

## 5. Estimate Rules

### 5.1 Estimate Inputs

An estimate requires:

- Product
- SKU/variant
- Quantity
- Unit price in CNY
- Seller-to-China-address delivery fee
- Product category
- Estimated unit weight
- Exchange rate
- Shipping rate
- Profit rule

### 5.2 Estimate Calculation

The estimate must include:

- Product subtotal in CNY
- Domestic China delivery fee in CNY
- Converted BDT product cost
- Estimated product weight
- Category-based shipping estimate
- China-address-to-Guangzhou delivery estimate
- Profit
- Final estimated total

### 5.3 Estimate Validity

- Estimates should have a validity period.
- Suggested default validity is 24 hours.
- Expired estimates require recalculation before confirmation.
- Client should see that estimates may change after real cost and real weight are known.

### 5.4 Estimate Confirmation

- Client can confirm or reject an estimate.
- Confirmed estimates become order items.
- Rejected estimates remain in history but do not enter purchasing flow.

## 6. Order Rules

### 6.1 Order Creation

- Every confirmed estimate creates an order item.
- One product/SKU/quantity combination should be tracked as one order item.
- Each order item must belong to one client.
- SKU-level order items remain the operational source of truth for purchasing, wallet, status, and audit history.
- One client submission for one product creates one product order containing all submitted SKU lines. A later submission of the same product creates a separate product order.
- Product orders are workflow/display aggregates only; they do not replace SKU-level order items.

### 6.2 Order Statuses

Recommended order statuses:

- `estimate_requested`
- `pending_admin_review`
- `confirmed`
- `queued_for_purchase`
- `purchased`
- `seller_shipped`
- `received_china`
- `qc_checked`
- `packed`
- `sent_guangzhou`
- `arrived_guangzhou`
- `sent_bangladesh`
- `arrived_bangladesh`
- `ready_for_pickup`
- `completed`
- `cancelled`

### 6.3 Status Visibility

- Clients should see simplified, useful statuses.
- Admin should see detailed operational statuses.
- Staff should only see statuses relevant to receiving and packing.

### 6.4 Order Editing

- Before purchase, admin may edit SKU, quantity, estimated weight, category, or price.
- After purchase, financial edits must create an audit log.
- After parcel receiving, quantity/weight changes must be recorded as corrections.

## 7. Legacy Order Groups

Order groups are retained only for historical records and compatibility. New client orders must not create or join an order group. Existing group IDs, group history, and legacy records must remain readable; they must not be deleted or rewritten as part of the retirement.

The client-facing replacement is the product statement defined in `docs/CLIENT_PRODUCT_STATEMENT.md`. It groups display data by product link while preserving the SKU-level order records underneath.

## 8. Purchasing Rules

### 8.1 Purchase Approval

- Orders must be admin-approved before entering the purchase queue.
- Admin should verify product, SKU, quantity, price, and delivery fee before purchase.
- Admin confirms the complete product order in one action. Every SKU line records `pending_admin_review` to `confirmed` to `queued_for_purchase`, and one purchase batch contains all of those SKU lines.

### 8.2 Chrome Extension Purchasing

- The extension fetches approved purchase queue items.
- The extension assists cart filling on 1688/Taobao.
- Admin manually checks cart before payment.
- Admin manually completes payment.
- Extension syncs paid amount, provider order number, seller tracking number, and provider status.
- Each queued product order has one persisted purchase task. Its task state is separate from SKU fulfillment status and may be `queued`, `cart_added`, `awaiting_provider_details`, `awaiting_admin_confirmation`, `needs_review`, or `confirmed`.
- A confirmed product-wide cart addition is stored before provider purchase details are captured. Until final purchase confirmation, SKU order items remain `queued_for_purchase`.
- The extension receives one version-2 task per product order. It opens the product once, prepares every requested SKU/color/size and quantity, validates every current SKU price, then performs one cart action. It must never turn a multi-SKU task into sequential cart additions.
- A missing, unavailable, ambiguous, changed-price, or unsupported multi-SKU layout is a product-wide `needs_review` result. No cart action occurs until an explicit reviewed-price retry can revalidate every requested line.

### 8.3 Provider Price Difference

- If actual paid price differs from estimate, the actual price must be stored.
- Client cost may be updated according to admin rules.
- Difference should be visible in admin reports.

### 8.4 Purchase Failure

If purchase fails, admin may:

- Retry purchase
- Change SKU
- Select replacement product
- Cancel order
- Refund wallet credit
- Ask client for approval

## 9. Supplier Shipping Rules

### 9.1 Seller Tracking

- Seller tracking number should be stored as soon as available.
- One order item may have one or more seller tracking numbers.
- One seller parcel may contain multiple order items.

### 9.2 Tracking Status

- The system should track whether seller parcel is pending, shipped, in transit, delivered to China address, or exception.
- Manual tracking entry must be supported.

## 10. Receiving Rules

### 10.1 Parcel Scan

- Staff should scan barcode or tracking number using phone camera.
- If scan fails, staff can enter tracking manually.
- If tracking is unknown, staff can create an exception record.

### 10.2 Receiving Data

Staff must enter:

- Tracking number
- Received piece count
- Package weight
- QC status
- Notes if needed
- Photos if needed

### 10.3 Quantity Difference

- If received quantity is less than expected, status becomes `partial`.
- If received quantity is more than expected, admin review is required.
- If item is missing, status becomes `missing`.

## 11. Quality Check Rules

### 11.1 QC Statuses

Supported QC statuses:

- `pending`
- `pass`
- `fail`
- `partial`
- `missing`

### 11.2 QC Failure

- Failed products cannot enter packing queue without admin override.
- Staff should upload photo evidence for failed items.
- Admin decides whether to return, replace, refund, discount, or ship anyway with client approval.

### 11.3 QC Audit

- QC result must include staff user ID.
- QC time must be stored.
- Any later QC change must be logged.

## 12. Repacking Rules

### 12.1 Packing Eligibility

Products can be packed only when:

- They are received.
- QC is passed or admin-approved.
- Piece count is confirmed.
- Weight is recorded.

### 12.2 Category-Based Packing

- Same-category products should be packed together where practical.
- Restricted or fragile categories may require separate cartons.
- Admin must be able to override category packing.

### 12.3 Carton Creation

Each carton must have:

- Auto-generated carton code
- Client or shipping mark
- Product list
- Net weight
- Gross weight
- Category
- Created by staff user
- Created timestamp

### 12.4 Carton Label

Each carton label must include:

- Carton code
- Shipping mark
- Destination warehouse or forwarding mark
- Gross weight
- Product category
- Barcode or QR code if available

## 13. Guangzhou Forwarding Rules

### 13.1 Domestic Courier To Guangzhou

- Each carton shipped to Guangzhou must have a domestic courier tracking number.
- Staff may enter tracking manually.
- Staff may upload tracking label photo for OCR extraction.

### 13.2 Guangzhou Receipt

- Guangzhou warehouse receipt can be marked manually unless an API is available.
- Once Guangzhou confirms receipt, responsibility moves to shipping partner.

## 14. Bangladesh Delivery Rules

### 14.1 Bangladesh Arrival

- Admin can update carton/order group status when goods arrive in Bangladesh.
- Client should be notified when items are ready for pickup.

### 14.2 Shipping Charge Payment

- Client pays shipping charges at Bangladesh warehouse if that remains the business process.
- The platform should still record expected and actual shipping charges for reporting.

## 15. Manual Override Rules

Manual override is required for:

- Product data
- Product image
- SKU
- Quantity
- Weight
- Category
- Exchange rate
- Profit
- Domestic delivery fee
- Seller tracking
- Courier status
- QC result
- Final client cost
- Wallet adjustment
- Carton assignment

Every manual override must store:

- Actor
- Time
- Reason
- Old value
- New value

## 16. Notification Rules

Notify clients when:

- Estimate is ready
- Estimate expires
- Order is confirmed
- Wallet balance is insufficient
- Product is unavailable
- Seller ships item
- Product is received in China
- QC fails or needs approval
- Group is packed
- Goods arrive in Bangladesh
- Pickup is ready

Notify admin when:

- New estimate request is created
- Payment proof is uploaded
- Wallet balance issue occurs
- Purchase fails
- Courier exception occurs
- Staff reports QC issue
- Unknown parcel is scanned

## 17. Reporting Rules

The system must support:

- Product list with images
- Client statement
- Payment history
- Wallet ledger
- Estimate vs actual cost report
- Purchase report
- Shipping report
- Parcel receiving report
- QC exception report
- Carton report
- Profit report
- Monthly business summary

Reports should be exportable as CSV or Excel.

## 18. Audit Rules

Audit logs are required for:

- Payment approval
- Wallet transaction
- Exchange rate change
- Profit rule change
- Shipping rate change
- Order status change
- Actual cost change
- QC status change
- Manual override
- Staff/admin user change

Audit logs should not be editable from the normal application.

## 19. Data Retention Rules

- Order history should be kept permanently unless legally required otherwise.
- Payment proof should be retained according to business/accounting needs.
- QC photos should remain linked to the product/order.
- Supplier product snapshots should be retained even if original listings disappear.

## 20. MVP Defaults

- Estimate validity: 24 hours
- Group size limit: 40 fulfilled order items
- Wallet currency: CNY/RMB
- Client display currency: BDT
- Product source: OTAPI
- Purchase method: Chrome extension assisted, admin pays manually
- Payment method: manual proof upload, admin approval
- Courier integration: manual first, adapter-ready for future API
- OCR: optional enhancement after manual tracking works
- All financial changes require audit logs
