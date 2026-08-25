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
  }
}
```

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
      "exchangeRateCnyToBdt": 16.2,
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
- `admin`
- `super_admin`

Request:

```json
{
  "clientId": "uuid",
  "amountBdt": 50000,
  "paidAt": "2026-08-25",
  "proofFilePath": "payment-proofs/client/payment.jpg",
  "notes": "bKash transfer"
}
```

Response:

```json
{
  "data": {
    "paymentProofId": "uuid",
    "status": "pending"
  }
}
```

## 7.2 Approve Payment Proof

```http
POST /api/admin/payments/:id/approve
```

Roles:

- `admin`
- `super_admin`

Request:

```json
{
  "amountBdt": 50000,
  "cnyToBdtRate": 16.2,
  "approvedBy": "uuid",
  "notes": "Verified bank transfer."
}
```

Response:

```json
{
  "data": {
    "paymentProofId": "uuid",
    "walletTransactionId": "uuid",
    "creditedCny": 3086.42,
    "runningBalanceCny": 3086.42,
    "status": "approved"
  }
}
```

## 7.3 Reject Payment Proof

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

## 7.4 Get Wallet Statement

```http
GET /api/wallet
```

Query:

```text
clientId=uuid
from=2026-08-01
to=2026-08-31
```

Response:

```json
{
  "data": {
    "clientId": "uuid",
    "balanceCny": 1520.5,
    "transactions": [
      {
        "walletTransactionId": "uuid",
        "type": "advance_credit",
        "amountBdt": 50000,
        "amountCny": 3086.42,
        "rate": 16.2,
        "runningBalanceCny": 3086.42,
        "createdAt": "2026-08-25T10:00:00.000Z"
      }
    ]
  }
}
```

## 8. Admin Settings APIs

## 8.1 Set Exchange Rate

```http
POST /api/admin/settings/exchange-rates
```

Request:

```json
{
  "cnyToBdt": 16.2,
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

## 8.2 Manage Shipping Rate

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

## 8.3 Manage Profit Rule

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
GET /api/notifications
```

Response:

```json
{
  "data": [
    {
      "notificationId": "uuid",
      "title": "Estimate ready",
      "body": "Your estimate is ready for review.",
      "entityType": "estimate",
      "entityId": "uuid",
      "readAt": null,
      "createdAt": "2026-08-25T10:00:00.000Z"
    }
  ]
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
    "notificationId": "uuid",
    "read": true
  }
}
```

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
