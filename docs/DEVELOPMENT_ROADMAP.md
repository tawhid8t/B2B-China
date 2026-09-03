# Development Roadmap

## 1. Purpose

This roadmap explains how to build the cross-border sourcing and fulfillment platform from zero to production.

The goal is to avoid building everything at once. The system should be built in controlled phases so the business can start using it early, replace Excel step by step, and add automation only after the core data is reliable.

## 2. Roadmap Strategy

Build order:

1. Foundation and database
2. Client ordering
3. Estimate engine
4. Admin operations
5. Wallet and bookkeeping
6. Purchasing workflow
7. Staff receiving and QC
8. Cartons and Guangzhou forwarding
9. Reports and exports
10. Automation improvements

The most important principle is this:

The website must become the system of record first. Automation can be improved later, but order, wallet, product, parcel, and carton data must be correct from the beginning.

## 3. Phase 0: Project Setup

## Goal

Prepare the technical foundation and project structure.

## Deliverables

- Next.js project setup
- TypeScript setup
- Tailwind CSS setup
- Supabase project setup
- Environment variable structure
- Git repository structure
- Basic folder architecture
- Shared UI layout
- Basic role-based route structure

## Recommended Folders

```text
app/
components/
lib/
services/
types/
supabase/
docs/
extension/
tests/
```

## Acceptance Criteria

- App runs locally.
- Supabase connection works.
- Environment variables are documented.
- Basic pages load without error.
- Project has consistent formatting and linting.

## 4. Phase 1: Authentication And Roles

## Goal

Allow different user types to securely access the correct parts of the system.

## Deliverables

- Client registration
- Login/logout
- Password reset
- Supabase Auth integration
- `profiles` table
- Role system:
  - `client`
  - `staff_receiver`
  - `staff_packer`
  - `admin`
  - `super_admin`
- Role-based dashboard routing
- Basic RLS policies

## Acceptance Criteria

- Client can create account and log in.
- Admin can log in.
- Staff can log in.
- Client cannot access admin/staff pages.
- Staff cannot access wallet/payment admin data.
- Super admin can manage roles.

## 5. Phase 2: Public Website

## Goal

Create the public-facing business website for trust, explanation, and onboarding.

## Deliverables

- Home page
- Services page
- How it works page
- Product rules page
- Shipping policy page
- Shipping fee explanation
- Restricted/banned products page
- Contact/WhatsApp CTA

## Acceptance Criteria

- Visitor understands how the service works.
- Visitor understands shipping/payment rules.
- Visitor can register or contact the business.
- Website works well on mobile.

## 6. Phase 3: Product Link Ordering

## Goal

Allow clients to paste 1688/Taobao links and create product order requests.

## Deliverables

- Product link input
- Link validation
- OTAPI product lookup
- Product snapshot storage
- Product image display
- SKU/variant display
- Quantity selection
- Manual product creation fallback
- Product lookup error handling

## API Work

- `POST /api/products/resolve-link`
- `POST /api/admin/products/manual`

## Acceptance Criteria

- Valid 1688 links resolve product information.
- Valid Taobao links resolve product information.
- Product images are shown.
- Client can select SKU and quantity.
- Invalid links show clear error.
- Admin can manually create product if OTAPI fails.

## 7. Phase 4: Estimate Engine

## Goal

Replace manual Excel pricing with automatic estimate calculation.

## Deliverables

- Exchange rate settings
- Category shipping rate settings
- Profit rule settings
- Category default weight settings
- Estimate calculation service
- Estimate breakdown UI
- Estimate validity period
- Estimate accept/reject flow

## Calculation Inputs

- Product unit price in CNY
- Quantity
- Seller domestic delivery fee
- CNY-to-BDT exchange rate
- Estimated product weight
- Category shipping rate
- China-to-Guangzhou rate
- Profit rule

## API Work

- `POST /api/estimates`
- `POST /api/estimates/:id/accept`
- `POST /api/estimates/:id/reject`

## Acceptance Criteria

- Estimate shows full cost breakdown.
- Estimate includes product and delivery cost.
- Estimate includes shipping and profit.
- Client can accept or reject.
- Expired estimate cannot be accepted.
- Accepted estimate creates order item.

## 8. Phase 5: Client Order Dashboard

## Goal

Give clients a clear view of their orders, costs, statuses, and groups.

## Deliverables

- Client dashboard
- Order list
- Order detail page
- Grouped order view
- Day/month filters
- Client-facing status labels
- Estimated vs actual cost display
- Product image display
- Group totals

## API Work

- `GET /api/orders`
- `GET /api/orders/:id`
- `GET /api/order-groups`
- `GET /api/order-groups/:id`

## Acceptance Criteria

- Client can see only their own orders.
- Client can filter by month/day.
- Client can see group totals.
- Client can open product details.
- Client can see status updates.

## 9. Phase 6: Admin Order Operations

## Goal

Allow admin to review, approve, adjust, and control all orders.

## Deliverables

- Admin dashboard
- Client list
- Order review queue
- Estimate review
- Order approval
- Manual price/weight/category adjustment
- Status update tools
- Admin notes
- Audit log creation

## API Work

- `PATCH /api/admin/orders/:id`
- `GET /api/admin/orders`
- `GET /api/admin/clients`

## Acceptance Criteria

- Admin can approve or reject orders.
- Admin can adjust estimated data with reason.
- Admin can update status.
- Every critical change creates audit log.

## 10. Phase 7: Wallet And Payment System

**Implementation status (2026-08-30): COMPLETE.** The six wallet/payment
delivery phases are deployed, including private proofs, admin review/settings,
immutable ledgers/corrections/exports, partial non-negative order coverage,
recipient-scoped notifications, live dashboards, and reconciliation. The
persisted default rate is `1 CNY = 19.2000 BDT`.

## Goal

Replace manual advance-money bookkeeping with a wallet ledger.

## Deliverables

- Payment proof upload
- Admin payment approval
- Payment rejection flow
- Wallet credit calculation
- Wallet debit/reservation logic
- Wallet statement
- Client payment history
- Admin wallet ledger
- Insufficient balance alerts

## API Work

- `POST /api/payments/proof`
- `POST /api/admin/payments/:id/approve`
- `POST /api/admin/payments/:id/reject`
- `GET /api/wallet`

## Acceptance Criteria

- Uploaded proof does not credit wallet before approval.
- Approved payment creates wallet credit.
- Client sees wallet balance.
- Orders debit or reserve wallet balance.
- Partial wallet balance is handled correctly.
- Corrections use adjustment transactions.

## 11. Phase 8: Purchasing Queue And Chrome Extension

## Goal

Reduce manual purchasing work while keeping admin payment control.

## Deliverables

- Purchase queue
- Purchase batch creation
- Chrome extension scaffold
- Extension authentication/token
- Queue fetch from extension
- Cart fill helper
- Provider order sync
- Paid amount sync
- Seller tracking sync
- Purchase exception handling

## API Work

- `GET /api/extension/purchase-queue`
- `POST /api/extension/provider-order-sync`

## Acceptance Criteria

- Admin-approved orders appear in purchase queue.
- Extension can fetch queue.
- Extension can assist cart filling.
- Admin manually pays.
- Extension syncs provider order data.
- Order status updates after purchase sync.

## 12. Phase 9: Seller Tracking And Courier Preparation

## Goal

Track seller parcels from supplier to the China receiving address.

## Deliverables

- Seller tracking number storage
- Provider order status sync
- Manual tracking entry
- Tracking event table
- Courier adapter interface
- Unknown/missing tracking exception flow

## API Work

- `POST /api/courier/track-sync`

## Acceptance Criteria

- Seller tracking number is linked to order.
- Admin can manually enter tracking.
- Tracking events appear in order detail.
- Courier provider can be added later without redesign.

## 13. Phase 10: Staff Receiving And QC

## Goal

Allow China staff to receive parcels and verify products by phone.

## Deliverables

- Staff receiving dashboard
- Barcode/tracking scan
- Manual tracking search
- Parcel detail popup
- Piece count entry
- Weight entry
- QC status
- QC notes
- QC photo upload
- Unknown parcel exception
- Partial/missing/fail workflows

## API Work

- `GET /api/staff/parcels/search`
- `POST /api/staff/parcels/receive`

## Acceptance Criteria

- Staff can scan or manually search parcel.
- Staff can see relevant product/client data.
- Staff can enter pieces and weight.
- Staff can mark QC result.
- Failed QC does not enter packing queue without admin approval.

## 14. Phase 11: Repacking, Cartons, And Labels

## Goal

Control repacking from checked products into cartons sent to Guangzhou.

## Deliverables

- Packing queue
- Carton creation
- Carton code generation
- Carton item assignment
- Net/gross weight entry
- Shipping mark management
- Printable carton label
- Label storage
- Carton status tracking

## API Work

- `POST /api/staff/cartons`
- `POST /api/staff/cartons/:id/guangzhou-tracking`

## Acceptance Criteria

- Only eligible items can be packed.
- Carton has code, weights, shipping mark, and item list.
- Printable label is generated.
- Carton status updates correctly.

## 15. Phase 12: Guangzhou Forwarding And Bangladesh Arrival

## Goal

Track cartons from China staff to Guangzhou partner and then to Bangladesh.

## Deliverables

- Guangzhou courier tracking entry
- OCR tracking extraction from photo
- Manual correction for OCR
- Guangzhou receipt status
- Bangladesh arrival status
- Ready-for-pickup status
- Client notification

## API Work

- `POST /api/ocr/tracking-number`
- `POST /api/courier/track-sync`

## Acceptance Criteria

- Staff can enter or extract Guangzhou tracking.
- Admin can mark Guangzhou receipt.
- Admin can mark Bangladesh arrival.
- Client can see pickup-ready status.

## 16. Phase 13: Reports And Exports

## Goal

Replace Excel bookkeeping while still supporting downloadable files.

## Deliverables

- Client statement
- Product list with images
- Wallet ledger export
- Payment history export
- Estimate vs actual report
- Purchase report
- Parcel receiving report
- QC exception report
- Carton report
- Profit report
- Monthly business summary
- CSV export
- Excel export

## API Work

- `GET /api/reports/client-statement`
- `GET /api/admin/reports/profit`
- `GET /api/admin/reports/cartons`

## Acceptance Criteria

- Admin can export reports.
- Client can download own statement.
- Product images are included or linked.
- Financial totals match wallet and order data.

## 17. Phase 14: Notifications And Realtime

## Goal

Keep clients, admin, and staff updated without manual messaging.

## Deliverables

- In-app notifications
- Admin alerts
- Staff task alerts
- Client order updates
- Wallet balance alerts
- Realtime dashboard updates
- Optional email/WhatsApp integration later

## Acceptance Criteria

- Client is notified when estimate is ready.
- Client is notified when wallet balance is low.
- Admin is notified when payment proof is uploaded.
- Staff/admin are notified for QC exceptions.
- Dashboards update without refresh where useful.

## 18. Phase 15: Security, Reliability, And Launch

## Goal

Prepare the MVP for real business usage.

## Deliverables

- Complete RLS policy review
- Role permission tests
- Audit log review
- Error logging
- Integration logs
- Backup/export process
- Production environment variables
- Supabase storage policies
- Extension security review
- Admin training checklist
- Staff training checklist

## Acceptance Criteria

- Client cannot access another client’s data.
- Staff cannot access wallet/payment/profit data.
- Secrets are not exposed in frontend or extension.
- Payment proof and QC files are private.
- Manual override requires reason.
- Critical errors are logged.

## 19. Suggested MVP Release Cut

The first usable business release should include:

- Auth and roles
- Client order by product link
- OTAPI product lookup
- Estimate calculation
- Admin approval
- Wallet and payment proof
- Client order groups
- Admin purchase queue
- Manual provider order tracking
- Staff receiving and QC
- Carton creation
- Manual Guangzhou tracking
- Client status dashboard
- Basic exports

Delay until after MVP:

- Full courier API integration
- OCR tracking extraction
- Advanced WhatsApp/email automation
- Advanced profit analytics
- Full automatic provider purchasing
- Mobile app

## 20. Recommended Build Order For Developers

1. Create database migrations.
2. Create Supabase auth/profile/role logic.
3. Create shared app layout and route guards.
4. Create product lookup API.
5. Create estimate engine.
6. Create order and group logic.
7. Create wallet ledger logic.
8. Create admin approval flows.
9. Create extension purchase queue.
10. Create staff receiving flow.
11. Create carton/label flow.
12. Create reports.
13. Add realtime notifications.
14. Harden RLS and audit logs.
15. Prepare launch checklist.

## 21. Launch Checklist

- Production Supabase project created
- Production database migrations applied
- RLS enabled and tested
- Storage buckets created
- OTAPI key configured
- Admin and super admin accounts created
- Two staff accounts created
- Default exchange rate configured
- Category shipping rates configured
- Profit rules configured
- Shipping mark configured
- Payment proof process tested
- Order flow tested end to end
- Staff scan flow tested
- Carton label tested
- Export reports tested
- Backup process documented
- Chrome extension installed privately
