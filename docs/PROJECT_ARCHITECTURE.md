# Cross-Border Sourcing Platform Architecture

## 1. Product Goal

Build a complete operations platform for a China-to-Bangladesh sourcing and fulfillment business.

The system replaces manual meetings, screenshots, Excel bookkeeping, advance-money reconciliation, parcel checking, repacking, and shipment tracking with a structured web platform.

The first production version should be an Operations MVP:

- Clients place orders themselves using Taobao or 1688 product links.
- Admin reviews, approves, prices, and manages purchasing.
- A Chrome extension assists purchasing on 1688/Taobao.
- Staff in China receive, scan, check, weigh, and repack products.
- Clients can see order status, grouped orders, wallet balance, payment history, and estimated or final costs.
- Manual override must exist for every automated process.

## 2. Technology Stack

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS

### Backend

- Supabase Auth
- Supabase Postgres
- Supabase Row Level Security
- Supabase Storage
- Supabase Realtime
- Supabase Edge Functions

### Integrations

- OTAPI for Taobao and 1688 product/order data
- Chrome extension for admin-assisted cart filling and provider order sync
- Courier API adapter, provider undecided
- OCR service for extracting courier tracking numbers from uploaded photos

## 3. Main User Roles

### Client

Clients are Bangladesh-based buyers. They can register, log in, paste product links, select variants, request estimates, confirm orders, upload payment proof, view wallet balance, view payment history, track order status, and download statements.

### Staff Receiver

A China-based warehouse staff member who receives supplier parcels, scans tracking/barcodes, confirms pieces, enters weight, uploads photos, and records QC status.

### Staff Packer

A China-based warehouse staff member who groups checked products, creates cartons, enters net/gross weight, prints shipping labels, and records Guangzhou courier tracking.

### Admin

The business operator who reviews estimates, approves orders, manages clients, approves payment proofs, checks wallet balances, controls purchasing queues, edits real costs, handles disputes, and exports reports.

### Super Admin

The owner-level account. It manages staff accounts, system settings, exchange rates, shipping rates, profit rules, shipping marks, category rules, and permissions.

## 4. Product Modules

## 4.1 Public Website

The public website explains the business and brings new clients into the system.

Required pages:

- Home
- Services
- How ordering works
- Shipping policy
- Shipping fee calculation
- Product rules
- Restricted/banned products
- Contact or WhatsApp call-to-action

## 4.2 Client Portal

The client portal is the main ordering system.

Core features:

- Account registration and login
- Client profile and pickup details
- Product link submission for Taobao/1688
- Product popup with image, title, variants, quantity, price, and domestic China delivery fee
- Estimate request
- Order confirmation
- Grouped order view
- Day/month filtering
- Wallet balance
- Payment proof upload
- Payment history
- Order status tracking
- Final cost updates after admin adjustment
- Downloadable invoice or statement

## 4.3 Admin Panel

The admin panel controls the business.

Core features:

- Client management
- Staff management
- Product estimate review
- Order approval
- Order group management
- Exchange rate management
- Category shipping rate management
- Profit rule management
- Wallet ledger
- Payment proof approval
- Purchasing queue
- Provider order sync review
- Real cost adjustment
- Courier tracking management
- Dispute, refund, and cancellation handling
- CSV/Excel export
- Audit logs

## 4.4 Staff Warehouse Panel

The staff panel must be mobile-friendly because receiving and packing will happen with a phone.

Core features:

- Staff login
- Parcel scan by phone camera
- Tracking number search
- Product detail popup
- Expected client/product/order group display
- Piece count entry
- Weight entry
- QC status: pending, pass, fail, partial, missing
- QC photo upload
- Carton creation
- Auto-generated carton code
- Net weight and gross weight entry
- Product list inside carton
- Printable shipping label
- Guangzhou domestic courier tracking entry
- Tracking number OCR from uploaded photo

## 4.5 Chrome Extension

The Chrome extension is admin-only.

Core features:

- Fetch approved purchase queue from the web app
- Open 1688/Taobao product pages
- Select exact SKU, color, size, and quantity
- Add items to admin cart
- Let admin manually cross-check and pay
- Capture provider order number
- Capture paid amount
- Capture seller tracking number
- Sync provider order status back to the admin dashboard

The extension must not store supplier account passwords.

## 5. Core Workflows

## 5.1 Client Order Flow

1. Client logs in.
2. Client pastes a Taobao or 1688 product link.
3. Backend calls OTAPI and fetches product data.
4. System stores fetched product information in the database.
5. Client selects color, size, SKU, and quantity.
6. System calculates an estimated cost.
7. Client confirms or rejects the estimate.
8. Confirmed order enters admin review.
9. Admin approves the order for purchasing.

## 5.2 Estimate Calculation Flow

The estimate engine calculates:

- Product unit price in CNY
- Product subtotal in CNY
- Seller-to-China-address domestic delivery fee in CNY
- CNY to BDT conversion
- Estimated product weight
- Category-based international shipping estimate
- China-address-to-Guangzhou domestic delivery estimate
- Business profit, either fixed percentage or fixed amount
- Final estimated cost per product and per order

The estimate should clearly show that final cost may change after actual weight, seller payment, and courier cost are known.

## 5.3 Wallet And Advance Payment Flow

1. Client uploads payment proof.
2. Admin verifies the proof.
3. Admin enters paid BDT amount and that day’s exchange rate.
4. System converts BDT to RMB/CNY wallet credit.
5. Client orders debit from wallet balance.
6. If wallet balance is not enough, system alerts the client.
7. Any amount beyond advance balance uses admin-adjusted/default exchange rate.
8. Client can always see full payment and wallet history.

Wallet transactions must be append-only. Existing wallet rows should not be edited after approval.

## 5.4 Order Grouping Flow

Each client has active order groups.

Rules:

- One group can hold up to 40 fulfilled order items.
- When a group reaches 40 fulfilled items, it closes.
- A new group is created automatically.
- Client can filter groups by day or month.
- Client can open any product inside a group for full details.
- Group totals update when admin enters real cost.

## 5.5 Purchasing Flow

1. Admin approves confirmed orders.
2. Approved items enter the purchase queue.
3. Chrome extension fetches the purchase queue.
4. Extension fills SKU, color, size, and quantity on 1688/Taobao.
5. Admin checks the cart and pays manually.
6. Extension captures paid amount, provider order number, and seller tracking number.
7. Admin dashboard updates order status.

## 5.6 Receiving And QC Flow

1. Seller ships product to China address.
2. Seller tracking number is saved.
3. Staff receives parcel.
4. Staff scans barcode/tracking number.
5. System shows product, client, quantity, and destination details.
6. Staff enters received pieces and weight.
7. Staff uploads photos if needed.
8. Staff marks QC status.
9. Product moves to repacking queue.

## 5.7 Repacking And Carton Flow

1. Staff groups checked products by client/category/shipping rule.
2. Staff creates carton.
3. System generates carton code.
4. Staff enters net weight and gross weight.
5. System generates printable label with super admin shipping mark.
6. Staff ships carton to Guangzhou.
7. Staff enters Guangzhou courier tracking manually or uploads photo for OCR.
8. Client/admin can track carton status.

## 6. System Architecture

## 6.1 Frontend Architecture

Recommended Next.js route groups:

- `/` public landing page
- `/auth` login, registration, password reset
- `/client` client dashboard and ordering
- `/admin` admin dashboard
- `/staff` staff warehouse dashboard
- `/api` backend routes

Recommended frontend structure:

- Shared design system components
- Shared forms
- Role-based dashboard layouts
- Product order components
- Wallet components
- Order group components
- Staff scanning components
- Admin table/report components

## 6.2 Backend Architecture

Supabase is the main backend.

Backend responsibilities:

- Authentication
- Role-based authorization
- Database storage
- Product/order/wallet persistence
- File storage
- Realtime updates
- Audit history

Next.js API routes or Supabase Edge Functions should handle:

- OTAPI product lookup
- Estimate calculations
- Order confirmation
- Payment proof submission
- Admin payment approval
- Purchase queue
- Provider order sync from extension
- Parcel receiving
- Carton creation
- Courier tracking sync
- OCR tracking extraction

## 6.3 Integration Layer

Create separate services:

- `OtapiService`
- `ExchangeRateService`
- `EstimateService`
- `WalletService`
- `OrderGroupService`
- `CourierProviderAdapter`
- `OcrService`
- `NotificationService`
- `AuditLogService`

Every external integration call should write to `integration_logs`.

## 7. Database Architecture

Recommended core tables:

- `profiles`
- `clients`
- `product_links`
- `estimates`
- `order_items`
- `order_groups`
- `wallet_transactions`
- `purchase_batches`
- `provider_orders`
- `parcels`
- `cartons`
- `shipping_rates`
- `exchange_rates`
- `profit_rules`
- `category_rules`
- `audit_logs`
- `notifications`
- `integration_logs`

## 8. API Contracts

### `POST /api/products/resolve-link`

Input:

```json
{ "url": "https://detail.1688.com/offer/123456789.html" }
```

Output:

```json
{
  "provider": "alibaba1688",
  "providerItemId": "123456789",
  "title": "Product title",
  "images": [],
  "category": "apparel",
  "domesticDeliveryCny": 8,
  "skus": []
}
```

### `POST /api/estimates`

Creates a cost estimate for a selected product/SKU/quantity.

### `POST /api/orders/confirm`

Converts an accepted estimate into an order item.

### `POST /api/payments/proof`

Uploads or records client payment proof.

### `POST /api/admin/payments/:id/approve`

Approves payment proof and credits client wallet.

### `GET /api/extension/purchase-queue`

Returns approved orders ready for extension-assisted purchasing.

### `POST /api/extension/provider-order-sync`

Receives provider order number, paid amount, seller tracking number, and provider status.

### `POST /api/staff/parcels/receive`

Receives parcel scan, piece count, weight, QC status, and notes.

### `POST /api/staff/cartons`

Creates carton record and printable label.

### `POST /api/courier/track-sync`

Syncs or records courier tracking updates.

## 9. Permissions And Security

Use Supabase Row Level Security.

Permission rules:

- Client can only see their own orders, wallet, payments, notifications, invoices, and groups.
- Staff receiver can only access receiving-related tasks.
- Staff packer can only access packing/carton-related tasks.
- Admin can manage day-to-day business operations.
- Super admin can manage all system settings and users.

Security requirements:

- Never expose OTAPI secret keys in the browser.
- Never store 1688/Taobao passwords in the Chrome extension.
- Keep payment proof files private.
- Keep QC photos private.
- Use signed URLs for private file access.
- Log all wallet, rate, payment, order, and status changes.

## 10. Automation And Manual Fallback

Automation should improve speed, but manual fallback is required.

Manual fallback examples:

- Manually enter product information if OTAPI fails.
- Manually edit estimated weight.
- Manually approve or reject payment proof.
- Manually enter seller tracking.
- Manually update courier status.
- Manually enter Guangzhou tracking.
- Manually correct OCR extraction.
- Manually adjust final cost.

## 11. Reporting And Bookkeeping

The system should replace the current Excel workflow but still support export.

Required reports:

- Client order statement
- Client wallet ledger
- Payment history
- Product list with images
- Estimate vs actual cost report
- Admin profit report
- Supplier purchase report
- Parcel receiving report
- Carton shipment report
- Monthly client summary

Exports should support CSV and Excel.

## 12. MVP Build Phases

### Phase 1: Foundation

- Next.js app setup
- Supabase project setup
- Auth and roles
- Database schema
- Public website
- Client/admin/staff layouts

### Phase 2: Ordering And Estimates

- Product link submission
- OTAPI product fetch
- SKU selection
- Estimate calculation
- Client order confirmation
- Admin order review

### Phase 3: Wallet And Bookkeeping

- Payment proof upload
- Admin payment approval
- Wallet ledger
- Exchange rate logic
- Order debit logic
- Client payment history

### Phase 4: Purchasing

- Admin purchase queue
- Chrome extension queue fetch
- Cart filling assistant
- Provider order sync
- Seller tracking sync

### Phase 5: Warehouse Operations

- Staff receiving panel
- Barcode/tracking scan
- QC workflow
- Weight and piece entry
- Carton creation
- Label printing

### Phase 6: Shipping And Reports

- Courier adapter
- Manual tracking fallback
- OCR tracking extraction
- Client/group reports
- Admin exports
- Final cost adjustment

## 13. Testing Plan

Test cases:

- Valid 1688 link resolves product data.
- Valid Taobao link resolves product data.
- Invalid link returns clear error.
- Estimate calculation handles quantity, weight, exchange rate, category rate, China domestic delivery, and profit.
- Wallet credit uses admin-approved rate.
- Wallet debit handles partial balance.
- Order groups close after 40 fulfilled items.
- Client cannot access another client’s orders.
- Staff cannot access client wallet data.
- Admin can approve payment proof.
- Extension can fetch purchase queue.
- Provider order sync updates order status.
- Parcel scan opens correct product.
- Duplicate parcel scan is handled safely.
- QC fail keeps product out of packing queue.
- Carton label contains carton code and shipping mark.
- Manual courier tracking works without selected API provider.

## 14. Defaults And Assumptions

- First release is Operations MVP.
- OTAPI is the main product data source.
- Courier API is undecided, so the system uses an adapter and manual fallback.
- Payments are manual proof upload plus admin approval.
- Purchasing is extension-assisted, not fully automatic payment.
- Estimated weight can use category defaults until actual staff weight is entered.
- BDT is client-facing currency.
- CNY/RMB is purchasing and wallet currency.
- Every financial and status-changing action must be auditable.
