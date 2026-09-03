# API Contract

## 1. Purpose

This document defines the application API contract for the cross-border sourcing and fulfillment platform.

The API supports:

- Client product ordering
- OTAPI product lookup
- Estimate calculation
- Order confirmation
- Wallet and payment proof handling
- Admin approval and purchasing
- Chrome extension purchase assistance
- Staff receiving, QC, and carton creation
- Courier tracking and OCR
- Notifications and reports

The first implementation can use Next.js API routes. Supabase Edge Functions may later host integration-heavy routes such as OTAPI, courier sync, OCR, and scheduled jobs.

## 2. General API Rules

## 2.1 Base URL

Local development:

```text
http://localhost:3000/api
```

Production:

```text
https://your-domain.com/api
```

## 2.2 Authentication

All private routes require Supabase Auth session.

Chrome extension routes require an admin session or a dedicated extension token.

### Client mobile bootstrap

`GET /api/client/bootstrap`

Purpose:

- restore and verify a native client session before protected mobile routes open;
- return only the minimal active profile and client identity required by the mobile shell.

Authentication and authorization:

- requires `Authorization: Bearer <supabase-access-token>`;
- accepts only an active `client` profile with an associated `clients` row;
- derives profile and client identity from the authenticated session and accepts no request body or client ID;
- uses the request-scoped Supabase client, so Row Level Security remains in force.

Response:

```json
{
  "data": {
    "profile": {
      "id": "uuid",
      "email": "client@example.com",
      "fullName": "Client Name",
      "role": "client",
      "status": "active"
    },
    "client": {
      "id": "uuid",
      "businessName": "Business Name"
    }
  },
  "meta": {}
}
```

Errors:

- `401 UNAUTHORIZED` for a missing, invalid, or expired bearer session;
- `403 FORBIDDEN` for an inactive/non-client profile or missing client record;
- `500 INTERNAL_ERROR` when the verified profile/client identity cannot be loaded.

The response is private and non-cacheable. Mobile route guards consume this response, but every later business endpoint still performs its own server authorization.

Public routes:

- `POST /products/resolve-link` may be authenticated in production to prevent abuse.
- Public website routes do not use this API contract unless needed for contact/lead capture.

## 2.3 Authorization

Authorization is role-based:

- `client`
- `staff_receiver`
- `staff_packer`
- `admin`
- `super_admin`

Backend routes must also rely on Supabase Row Level Security where possible.

## 2.4 Response Format

Successful response:

```json
{
  "data": {},
  "meta": {}
}
```

Error response:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "details": {}
  }
}
```

## 2.5 Common Error Codes

```text
UNAUTHORIZED
FORBIDDEN
VALIDATION_ERROR
NOT_FOUND
CONFLICT
EXPIRED_ESTIMATE
INSUFFICIENT_WALLET_BALANCE
PROVIDER_LOOKUP_FAILED
PROVIDER_SYNC_FAILED
COURIER_SYNC_FAILED
OCR_FAILED
MANUAL_REVIEW_REQUIRED
INTERNAL_ERROR
```

## 2.6 Pagination

List endpoints should support:

```text
page
pageSize
sort
direction
```

Example metadata:

```json
{
  "meta": {
    "page": 1,
    "pageSize": 25,
    "total": 240
  }
}
```

## 3. Product APIs

## 3.1 Resolve Product Link

```http
POST /api/products/resolve-link
```

Purpose:

Fetch product information from OTAPI using a Taobao, Tmall, or 1688 link.

Roles:

- `client`
- `admin`
- `super_admin`

Request:

```json
{
  "url": "https://detail.1688.com/offer/123456789.html"
}
```

Response:

```json
{
  "data": {
    "productId": "uuid",
    "provider": "alibaba1688",
    "providerItemId": "123456789",
    "originalUrl": "https://detail.1688.com/offer/123456789.html",
    "title": "Cotton shirt",
    "titleCn": "棉衬衫",
    "images": ["https://..."],
    "category": "apparel",
    "domesticDeliveryCny": 8,
    "priceMinCny": 42,
    "priceMaxCny": 46,
    "skus": [
      {
        "skuId": "uuid",
        "providerSkuId": "123:456",
        "label": "Black / M",
        "attributes": {
          "color": "Black",
          "size": "M"
        },
        "priceCny": 42,
        "availableQuantity": 120,
        "imageUrl": "https://..."
      }
    ]
  },
  "meta": {
    "source": "provider",
    "cached": false
  }
}
```

When OTAPI temporarily reports `NotAvailable / ItemIsNotComplete`, the server retries within a bounded 20-second window. If a complete snapshot for the same provider item was saved in the previous 15 minutes, `meta.source` is `persisted_snapshot`, `meta.cached` is `true`, and `meta.snapshotAgeSeconds` is included. An exhausted temporary lookup returns `PROVIDER_LOOKUP_FAILED` with retry metadata; it is not classified as manual review.

Errors:

- `VALIDATION_ERROR`
- `PROVIDER_LOOKUP_FAILED`
- `MANUAL_REVIEW_REQUIRED`

## 3.1.1 Preview Product Link

```http
POST /api/products/preview-link
```

Purpose:

Resolve a supported marketplace link for an unauthenticated, read-only product preview. This endpoint does not create a product snapshot or write to Supabase.

Request:

```json
{
  "url": "https://detail.1688.com/offer/123456789.html"
}
```

Response data uses the normalized product fields from §3.1, excluding `productId`, `source`, and raw provider payloads. The response metadata includes whether the result was served from the server-side preview cache.

Errors:

- `VALIDATION_ERROR`
- `PROVIDER_LOOKUP_FAILED`
- `MANUAL_REVIEW_REQUIRED`

## 3.2 Manually Create Product

```http
POST /api/admin/products/manual
```

Purpose:

Allow admin to create a product when OTAPI lookup fails.

Roles:

- `admin`
- `super_admin`

Request:

```json
{
  "originalUrl": "https://detail.1688.com/offer/123456789.html",
  "provider": "alibaba1688",
  "title": "Cotton shirt",
  "images": ["storage/path.jpg"],
  "category": "apparel",
  "domesticDeliveryCny": 8,
  "skus": [
    {
      "label": "Black / M",
      "attributes": {
        "color": "Black",
        "size": "M"
      },
      "priceCny": 42
    }
  ]
}
```

Response:

```json
{
  "data": {
    "productId": "uuid",
    "created": true
  }
}
```

## 4. Estimate APIs

## 4.1 Create Estimate

```http
POST /api/estimates
```

Purpose:

Calculate and store a product estimate.

Roles:

- `client`
- `admin`
- `super_admin`

Request:

```json
{
  "clientId": "uuid",
  "productId": "uuid",
  "skuId": "uuid",
  "quantity": 12,
  "estimatedUnitWeightKg": 0.35,
  "notes": "Optional client note"
}
```

Response:

```json
{
  "data": {
    "estimateId": "uuid",
    "status": "sent_to_client",
    "validUntil": "2026-08-26T12:00:00.000Z",
    "breakdown": {
      "unitPriceCny": 42,
      "quantity": 12,
      "productSubtotalCny": 504,
      "domesticDeliveryCny": 8,
      "exchangeRateCnyToBdt": 19.2,
      "productSubtotalBdt": 8294.4,
      "estimatedTotalWeightKg": 4.2,
      "categoryShippingBdt": 2604,
      "chinaToGuangzhouBdt": 147,
      "profitBdt": 663.55,
      "totalBdt": 11708.95
    }
  }
}
```

Errors:

- `VALIDATION_ERROR`
- `NOT_FOUND`
- `MANUAL_REVIEW_REQUIRED`

## 4.2 Accept Estimate

```http
POST /api/estimates/:id/accept
```

Purpose:

Client accepts estimate and converts it into an order item.

Roles:

- `client`
- `admin`
- `super_admin`

Request:

```json
{
  "clientId": "uuid"
}
```

Response:

```json
{
  "data": {
    "orderItemId": "uuid",
    "groupId": "uuid",
    "groupCode": "DTH-AUG-01",
    "status": "pending_admin_review",
    "walletReservationStatus": "reserved_or_partial"
  }
}
```

Errors:

- `EXPIRED_ESTIMATE`
- `INSUFFICIENT_WALLET_BALANCE`
- `CONFLICT`

## 4.3 Reject Estimate

```http
POST /api/estimates/:id/reject
```

Request:

```json
{
  "reason": "Too expensive"
}
```

Response:

```json
{
  "data": {
    "estimateId": "uuid",
    "status": "rejected"
  }
}
```

## 5. Order APIs

## 5.0 Confirm Product Session

```http
POST /api/orders/confirm
```

Purpose:

Confirm one resolved product session with one or more selected SKU lines. This is the customer-facing direct confirmation flow: no estimate/order data is stored while the customer is only changing quantities or shipping inputs; records are created only when this endpoint succeeds.

Roles:

- `client`
- `admin`
- `super_admin`

Request:

```json
{
  "clientId": "uuid",
  "productId": "uuid",
  "estimatedUnitWeightKg": 0.35,
  "internationalShippingCategory": "Ladies Slipper",
  "idempotencyKey": "customer-session-key",
  "lines": [
    {
      "skuId": "uuid",
      "quantity": 12
    }
  ]
}
```

Rules:

- `productId`, `skuId`, and quantities must be canonical persisted IDs/values.
- The server loads product/SKU prices and current exchange rate; the client must not submit authoritative prices or totals.
- The server validates the shipping tariff item against server-side tariff configuration.
- The endpoint supports one product per request and one or more SKU lines for that product.
- On success, it creates `pending_admin_review` order items and reserves up to the available CNY balance for supplier product cost. Confirmation does not post an order debit.
- Insufficient wallet balance does not block confirmation. Available balance never becomes negative; the uncovered CNY amount is persisted and returned with a pending-payment warning.
- Remaining estimated logistics/service components are stored on the order item snapshot for admin follow-up.
- Repeating the same `idempotencyKey` for the same client returns the original result instead of creating duplicate order items.

Response:

```json
{
  "data": {
    "clientId": "uuid",
    "groupId": "uuid",
    "groupCode": "GRP-20260827-ABCD1234",
    "status": "pending_admin_review",
    "productBaseCostCny": 348,
    "grandEstimatedTotalBdt": 11759,
    "walletBalanceCny": 0,
    "pendingPayment": true,
    "requiredAmountCny": 348,
    "reservedAmountCny": 100,
    "uncoveredAmountCny": 248,
    "appliedRate": 19.2,
    "orderItems": [
      {
        "orderItemId": "uuid",
        "skuId": "uuid",
        "groupId": "uuid",
        "groupCode": "GRP-20260827-ABCD1234",
        "status": "pending_admin_review",
        "reservationTransactionId": "uuid",
        "productCostCny": 348,
        "estimatedTotalBdt": 11759,
        "walletBalanceCny": 0,
        "requiredAmountCny": 348,
        "reservedAmountCny": 100,
        "uncoveredAmountCny": 248,
        "appliedRate": 19.2,
        "pendingPayment": true
      }
    ]
  },
  "meta": {
    "warnings": [
      {
        "code": "INSUFFICIENT_WALLET_BALANCE",
        "message": "Order confirmed. CNY 100.00 is reserved and CNY 248.00 remains payable."
      }
    ]
  }
}
```

Errors:

- `VALIDATION_ERROR`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `MANUAL_REVIEW_REQUIRED`

The legacy request body `{ "estimateId": "uuid", "clientId": "uuid" }` remains supported for existing Phase 6B estimate acceptance compatibility and points callers toward `POST /api/estimates/:id/accept`.

At audited provider purchase commitment, the active reservation is fully released and an `order_debit` is appended only for the wallet-covered portion. The actual uncovered CNY amount and applied snapshot rate are stored on the order. A rate different from the order snapshot requires `rateAdjustmentReason`; retries must match the settled paid amount and rate.

## 5.1 List Client Orders

```http
GET /api/orders
```

Roles:

- `client`
- `admin`
- `super_admin`

Query:

```text
clientId=uuid
status=seller_shipped
month=2026-08
day=2026-08-25
groupId=uuid
page=1
pageSize=25
```

Response:

```json
{
  "data": [
    {
      "orderItemId": "uuid",
      "groupCode": "DTH-AUG-01",
      "productTitle": "Cotton shirt",
      "image": "https://...",
      "skuLabel": "Black / M",
      "quantity": 12,
      "estimatedTotalBdt": 11708.95,
      "actualTotalBdt": null,
      "status": "seller_shipped",
      "createdAt": "2026-08-25T10:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 25,
    "total": 1
  }
}
```

## 5.2 Get Order Detail

```http
GET /api/orders/:id
```

Response:

```json
{
  "data": {
    "orderItemId": "uuid",
    "clientId": "uuid",
    "groupId": "uuid",
    "product": {},
    "sku": {},
    "estimate": {},
    "providerOrder": {},
    "parcelItems": [],
    "cartons": [],
    "statusEvents": [],
    "walletTransactions": []
  }
}
```

## 5.3 Admin Update Order

### Confirm a Product Order

```http
POST /api/admin/product-orders/:id/confirm
```

Roles: `admin`, `super_admin`.

The operation atomically validates that every SKU line is pending review, records `confirmed` then `queued_for_purchase` status events for each line, and creates one purchase batch containing all lines.

Response data includes `productOrderId`, `purchaseBatchId`, `orderItemIds`, and `status: "queued_for_purchase"`.

```http
PATCH /api/admin/orders/:id
```

Roles:

- `admin`
- `super_admin`

Request:

```json
{
  "status": "queued_for_purchase",
  "actualTotalBdt": 11840,
  "actualWeightKg": 4.4,
  "adminNotes": "Actual seller price changed.",
  "manualOverrideReason": "Supplier price changed before purchase."
}
```

## 5.4 Client Product Statement

```http
GET /api/client/product-statement
```

Roles: `client` only. The signed-in client is derived server-side; this endpoint accepts no client ID.

Query parameters: `page` (minimum 1), `startDate` (`YYYY-MM-DD`), `endDate` (`YYYY-MM-DD`), `month` (`YYYY-MM`), `category`, and `status`. Each page contains exactly 30 product-link rows.

The response `data` contains client-safe aggregated rows, one per product link. `meta` contains `{ page, pageSize: 30, total, chart }`; the chart uses the same filtered dataset and includes ordered-product count, quantity, weight, and category breakdowns. Rows include cost value/source labels (`actual`, `estimated`, `partial`, or `unavailable`), mixed-progress indication, client-visible notes, and no audit/internal provider payload fields.

Response:

```json
{
  "data": {
    "orderItemId": "uuid",
    "status": "queued_for_purchase",
    "updated": true
  }
}
```

## 6. Order Group APIs

## 6.1 List Order Groups

```http
GET /api/order-groups
```

Query:

```text
clientId=uuid
month=2026-08
day=2026-08-25
status=open
```

Response:

```json
{
  "data": [
    {
      "groupId": "uuid",
      "groupCode": "DTH-AUG-01",
      "status": "open",
      "itemCount": 31,
      "fulfilledItemCount": 12,
      "estimatedTotalBdt": 248500,
      "actualTotalBdt": 241900,
      "createdAt": "2026-08-01T00:00:00.000Z"
    }
  ]
}
```

## 6.2 Get Order Group Detail

```http
GET /api/order-groups/:id
```

Response:

```json
{
  "data": {
    "groupId": "uuid",
    "groupCode": "DTH-AUG-01",
    "totals": {},
    "orders": []
  }
}
```

## 7. Payment And Wallet APIs

## 7.1 Upload Payment Proof

```http
POST /api/payments/proof
```

Roles:

- `client`

Request:

```text
Content-Type: multipart/form-data

amountBdt=50000.00
paidAt=2026-08-25
notes=bKash transfer (optional, maximum 1000 characters)
proof=<JPG, PNG, WebP, or PDF; maximum 10 MB>
```

The server derives the client from the authenticated session and generates the
private Storage path. Callers cannot supply `clientId` or `proofFilePath`.

Response:

```json
{
  "data": {
      "id": "uuid",
      "claimedAmountBdt": 50000,
      "status": "pending"
  }
}
```

## 7.2 Get Client Payment History

```http
GET /api/payments?page=1
```

Roles:

- `client`

The response contains only the authenticated client's proof submissions and
uses the standard `data` plus pagination `meta` envelope.

## 7.3 Approve Payment Proof

```http
POST /api/admin/payments/:id/approve
```

Roles:

- `admin`
- `super_admin`

Request:

```json
{
  "verifiedAmountBdt": 50000,
  "cnyToBdtRate": 19.2,
  "reason": null
}
```

Response:

```json
{
  "data": {
    "paymentProofId": "uuid",
    "walletTransactionId": "uuid",
    "claimedAmountBdt": 50000,
    "approvedAmountBdt": 50000,
    "cnyToBdtRate": 19.2,
    "creditedCny": 2604.17,
    "status": "approved"
  }
}
```

## 7.4 Reject Payment Proof

```http
POST /api/admin/payments/:id/reject
```

Request:

```json
{
  "reason": "Amount does not match proof."
}
```

Response:

```json
{
  "data": {
    "paymentProofId": "uuid",
    "status": "rejected"
  }
}
```

The authenticated reviewer identity is always derived from the server session.
If `verifiedAmountBdt` differs from the client's claim, `reason` is required.
Approval is atomic and retry-safe: the proof transition and one immutable wallet
credit commit together, and a matching retry returns the existing credit.

## 7.5 Mark Payment Proof As Needs Review

```http
POST /api/admin/payments/:id/needs-review
```

Request:

```json
{
  "reason": "The transfer reference is unclear."
}
```

Only a `pending` proof may enter `needs_review`.

## 7.6 Cancel Payment Proof

```http
POST /api/payments/:id/cancel
POST /api/admin/payments/:id/cancel
```

A client may cancel only their own `pending` proof. Admin and super admin may
cancel an eligible pending proof with an audited reason. Cancellation never
creates or removes wallet credit.

## 7.7 Get Wallet Statement

```http
GET /api/wallet
```

Query:

```text
clientId=uuid
from=2026-08-01
to=2026-08-31
type=advance_credit
page=1
pageSize=30
```

Clients cannot select a client ID; the authenticated client profile is always
used. Admin and super admin requests require a client ID. Supported types are
`advance_credit`, `order_debit`, `refund`, `adjustment`, `reservation`, and
`reservation_release`.

Response:

```json
{
  "data": {
    "clientId": "uuid",
    "totalFundsCny": 1800.5,
    "activeReservedCny": 280,
    "availableBalanceCny": 1520.5,
    "transactions": [
      {
        "walletTransactionId": "uuid",
        "type": "advance_credit",
        "amountBdt": 50000,
        "amountCny": 2604.17,
        "rate": 19.2,
        "runningBalanceCny": 2604.17,
        "paymentProof": {},
        "order": {},
        "correctsTransactionId": null,
        "cumulativeCorrectedCny": 0,
        "correctionRemainingCny": 2604.17,
        "actor": {},
        "reason": "Verified payment",
        "createdAt": "2026-08-25T10:00:00.000Z"
      }
    ]
  },
  "meta": { "page": 1, "pageSize": 30, "total": 1 }
}
```

## 7.8 Create Manual Wallet Adjustment

```http
POST /api/admin/clients/:id/wallet/adjustments
```

Request:

```json
{ "amountCny": -25, "cnyToBdtRate": 19.2, "reason": "Audited balance correction" }
```

Roles: `admin`, `super_admin`. Positive and negative adjustments create new
posted entries. A negative adjustment is rejected if available funds would
become negative.

## 7.9 Create Linked Wallet Correction

```http
POST /api/admin/wallet/transactions/:id/corrections
```

Request:

```json
{ "amountCny": 10, "reason": "Partial supplier refund" }
```

The amount is a positive absolute CNY value. The server derives the opposite
financial sign, original rate, proportional BDT value, client, references,
and authenticated actor. Cumulative corrections cannot exceed the original.

## 7.10 CSV Exports

```http
GET /api/payments/export
GET /api/admin/wallet/export?clientId=uuid&type=refund&from=2026-08-01&to=2026-08-31
```

Client exports contain only the authenticated client's payment history. Admin
ledger exports require an authorized admin role and an explicit client ID.
CSV cells are escaped for spreadsheet compatibility and formula safety.

## 8. Admin Settings APIs

## 8.1 Set Exchange Rate

```http
GET /api/admin/settings/exchange-rates
POST /api/admin/settings/exchange-rates
```

Roles: `super_admin` only. `GET` returns append-only rate history. `POST` appends
a current or future effective rate; it never edits an existing rate.

Request:

```json
{
  "cnyToBdt": 19.2,
  "effectiveOn": "2026-08-25",
  "source": "admin"
}
```

Response:

```json
{
  "data": {
    "exchangeRateId": "uuid",
    "created": true
  }
}
```

## 8.2 Manage Payment Instructions

```http
GET /api/admin/settings/payment-instructions
POST /api/admin/settings/payment-instructions
PATCH /api/admin/settings/payment-instructions/:id
```

Roles: `super_admin` only. Destinations include method, display label, account
name/identifier, transfer instructions, active state, and sort order. Inactive
destinations remain in history and are hidden from clients.

## 8.3 Manage Shipping Rate

```http
POST /api/admin/settings/shipping-rates
```

Request:

```json
{
  "category": "apparel",
  "bdtPerKg": 620,
  "active": true
}
```

Response:

```json
{
  "data": {
    "shippingRateId": "uuid",
    "updated": true
  }
}
```

## 8.4 Manage Profit Rule

```http
POST /api/admin/settings/profit-rules
```

Request:

```json
{
  "name": "Default 8 percent",
  "category": null,
  "percentage": 0.08,
  "fixedBdt": null,
  "active": true
}
```

Response:

```json
{
  "data": {
    "profitRuleId": "uuid",
    "updated": true
  }
}
```

## 9. Chrome Extension APIs

## 9.1 Get Purchase Queue

```http
GET /api/extension/purchase-queue
```

The canonical response is schema version 2: one task per product order with one
product URL and `skus[]`. Temporary top-level SKU fields mirror the first SKU
for legacy extension compatibility. The extension must prepare the complete
`skus[]` list before making one cart action.

## 9.1.1 Record Product Cart Result

```http
POST /api/extension/purchase-cart-result
```

The extension session/credential submits `purchaseTaskId`, every SKU-line `orderItemId`, `cartAdded`, and an optional message. A successful result is accepted only when the submitted lines exactly match every queued SKU for the product order. It persists `cart_added` but does not mark any order item as purchased.

Roles:

- `admin`
- `super_admin`

Response:

```json
{
  "data": [
    {
      "orderItemId": "uuid",
      "provider": "alibaba1688",
      "productUrl": "https://detail.1688.com/offer/123456789.html",
      "providerItemId": "123456789",
      "providerSkuId": "123:456",
      "skuLabel": "Black / M",
      "attributes": {
        "color": "Black",
        "size": "M"
      },
      "quantity": 12,
      "expectedUnitPriceCny": 42
    }
  ]
}
```

## 9.2 Sync Provider Order

## 9.1.2 Capture Provider Purchase For Admin Review

```http
POST /api/extension/provider-order-capture
```

The extension submits one product-wide provider header and one uniquely matched
line for every requested SKU. Capture records are append-only and move only the
purchase task to `awaiting_admin_confirmation`; they never mark SKU lines as
Purchased or commit wallet funds.

```http
POST /api/extension/provider-order-sync
```

Roles:

- `admin`
- `super_admin`

Request:

```json
{
  "orderItemId": "uuid",
  "provider": "alibaba1688",
  "providerOrderId": "1688-order-123",
  "paidAmountCny": 512,
  "sellerTrackingNumber": "YT123456789CN",
  "providerStatus": "seller_shipped",
  "rawPayload": {}
}
```

Response:

```json
{
  "data": {
    "providerOrderId": "uuid",
    "orderItemStatus": "seller_shipped",
    "syncedAt": "2026-08-25T10:00:00.000Z"
  }
}
```

## 10. Staff Warehouse APIs

## 10.1 Search Parcel

```http
GET /api/staff/parcels/search
```

Roles:

- `staff_receiver`
- `admin`
- `super_admin`

Query:

```text
trackingNumber=YT123456789CN
```

Response:

```json
{
  "data": {
    "parcelId": "uuid",
    "trackingNumber": "YT123456789CN",
    "clientName": "Dhaka Trend House",
    "orderItems": []
  }
}
```

## 10.2 Receive Parcel

```http
POST /api/staff/parcels/receive
```

Roles:

- `staff_receiver`
- `admin`
- `super_admin`

Request:

```json
{
  "trackingNumber": "YT123456789CN",
  "orderItemId": "uuid",
  "receivedPieces": 12,
  "weightKg": 4.2,
  "qcStatus": "pass",
  "qcPhotoPaths": ["qc-photos/photo.jpg"],
  "notes": "All pieces received."
}
```

Response:

```json
{
  "data": {
    "parcelId": "uuid",
    "parcelItemId": "uuid",
    "orderItemStatus": "received_china",
    "qcStatus": "pass"
  }
}
```

## 10.3 Create Carton

```http
POST /api/staff/cartons
```

Roles:

- `staff_packer`
- `admin`
- `super_admin`

Request:

```json
{
  "clientId": "uuid",
  "category": "apparel",
  "shippingMark": "BC-DTH",
  "netWeightKg": 22.4,
  "grossWeightKg": 24.1,
  "items": [
    {
      "orderItemId": "uuid",
      "quantity": 12
    }
  ]
}
```

Response:

```json
{
  "data": {
    "cartonId": "uuid",
    "cartonCode": "BC-DTH-APPAREL-0001",
    "labelFilePath": "carton-labels/BC-DTH-APPAREL-0001.pdf",
    "status": "packed"
  }
}
```

## 10.4 Add Guangzhou Tracking

```http
POST /api/staff/cartons/:id/guangzhou-tracking
```

Request:

```json
{
  "courierName": "SF Express",
  "trackingNumber": "SF123456789CN"
}
```

Response:

```json
{
  "data": {
    "cartonId": "uuid",
    "status": "sent_guangzhou",
    "trackingNumber": "SF123456789CN"
  }
}
```

## 11. Courier And OCR APIs

## 11.1 Sync Courier Tracking

```http
POST /api/courier/track-sync
```

Roles:

- `staff_receiver`
- `staff_packer`
- `admin`
- `super_admin`

Request:

```json
{
  "entityType": "carton",
  "entityId": "uuid",
  "courierName": "manual",
  "trackingNumber": "SF123456789CN"
}
```

Response:

```json
{
  "data": {
    "trackingNumber": "SF123456789CN",
    "status": "manual_tracking_recorded",
    "checkpoints": [],
    "syncedAt": "2026-08-25T10:00:00.000Z"
  }
}
```

## 11.2 Extract Tracking From Image

```http
POST /api/ocr/tracking-number
```

Roles:

- `staff_receiver`
- `staff_packer`
- `admin`
- `super_admin`

Request:

```json
{
  "imagePath": "courier-photos/photo.jpg"
}
```

Response:

```json
{
  "data": {
    "trackingNumbers": ["SF123456789CN"],
    "confidence": 0.92,
    "requiresReview": false
  }
}
```

## 12. Notification APIs

## 12.1 List Notifications

```http
GET /api/notifications?page=1
```

Response:

```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Wallet payment still required",
      "body": "This order has CNY 25.00 not covered by wallet funds.",
      "eventType": "wallet_insufficient",
      "entityType": "order_item",
      "entityId": "uuid",
      "readAt": null,
      "createdAt": "2026-08-25T10:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 1, "unread": 1 }
}
```

## 12.2 Mark Notification Read

```http
POST /api/notifications/:id/read
```

Response:

```json
{
  "data": {
    "id": "uuid",
    "readAt": "2026-08-25T10:05:00.000Z"
  }
}
```

Only `client`, `admin`, and `super_admin` financial-workspace roles may use
these endpoints. RLS limits every role, including admins, to notification rows
addressed to their own profile. Recipients may update only `read_at`; title,
body, event type, entity reference, and timestamps remain server-controlled.

## 13. Report APIs

## 13.1 Client Statement

```http
GET /api/reports/client-statement
```

Query:

```text
clientId=uuid
from=2026-08-01
to=2026-08-31
format=json
```

Formats:

- `json`
- `csv`
- `xlsx`

## 13.2 Admin Profit Report

```http
GET /api/admin/reports/profit
```

Query:

```text
from=2026-08-01
to=2026-08-31
clientId=uuid
format=json
```

## 13.3 Carton Shipment Report

```http
GET /api/admin/reports/cartons
```

Query:

```text
from=2026-08-01
to=2026-08-31
status=sent_guangzhou
format=xlsx
```

## 14. File Upload APIs

## 14.1 Create Signed Upload URL

```http
POST /api/files/signed-upload
```

Request:

```json
{
  "bucket": "payment-proofs",
  "fileName": "payment.jpg",
  "contentType": "image/jpeg"
}
```

Response:

```json
{
  "data": {
    "path": "payment-proofs/client-id/payment.jpg",
    "signedUploadUrl": "https://..."
  }
}
```

Allowed buckets:

- `product-images`
- `payment-proofs`
- `qc-photos`
- `carton-labels`
- `courier-photos`
- `exports`

## 15. Realtime Channels

Recommended realtime channels:

- `client:{clientId}:orders`
- `client:{clientId}:wallet`
- `client:{clientId}:notifications`
- `admin:orders`
- `admin:payments`
- `warehouse:receiving`
- `warehouse:packing`

Realtime events should be sent for:

- New estimate
- Estimate accepted/rejected
- Order status change
- Wallet transaction posted
- Payment proof reviewed
- Parcel received
- QC failed
- Carton created
- Courier tracking updated

## 16. Versioning

Initial API version:

```text
v1
```

For the MVP, routes may live under `/api/...`.

If breaking changes are needed later, use:

```text
/api/v2/...
```

## 17. MVP Implementation Priority

Build APIs in this order:

1. Auth/session helpers
2. Product resolve link
3. Estimate create/accept/reject
4. Order list/detail/admin update
5. Payment proof and wallet approval
6. Order groups
7. Extension purchase queue and provider sync
8. Staff parcel receive
9. Staff carton creation
10. Courier manual tracking
11. Reports and exports
12. OCR tracking extraction
