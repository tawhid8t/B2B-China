# Status Machine

## 1. Purpose

This document defines the status lifecycle rules for the sourcing and fulfillment platform.

The goal is to keep every business object in a clear state, prevent impossible transitions, and make client/admin/staff dashboards trustworthy.

All important status changes should create audit logs or status event rows.

## 2. General Rules

- Status changes must be controlled by backend logic.
- Important status changes must store actor, timestamp, old status, new status, and reason where applicable.
- Client-facing status can be simpler than internal admin status.
- Staff should only see statuses relevant to their job.
- Manual override is allowed only for admin or super admin.
- Cancelled/completed records should not return to active workflow without admin override.

## 3. Estimate Status Machine

## 3.1 Estimate Statuses

```text
draft
sent_to_client
accepted
rejected
expired
converted_to_order
cancelled
```

## 3.2 Estimate Transitions

| From | To | Actor | Rule |
| --- | --- | --- | --- |
| `draft` | `sent_to_client` | system/admin | Estimate calculation completed |
| `sent_to_client` | `accepted` | client/admin | Estimate still valid |
| `sent_to_client` | `rejected` | client/admin | Client refuses estimate |
| `sent_to_client` | `expired` | system | Validity time passed |
| `accepted` | `converted_to_order` | system | Order item created |
| `draft` | `cancelled` | admin | Invalid or duplicate estimate |
| `sent_to_client` | `cancelled` | admin | Admin cancels before acceptance |

## 3.3 Estimate Rules

- Expired estimates cannot be accepted.
- Rejected estimates cannot be converted into orders.
- If client wants an expired/rejected estimate again, create a new estimate.
- Accepted estimate values should remain as historical snapshots.

## 4. Order Item Status Machine

## 4.1 Internal Order Statuses

```text
pending_admin_review
confirmed
queued_for_purchase
purchased
seller_shipped
received_china
qc_checked
packed
sent_guangzhou
arrived_guangzhou
sent_bangladesh
arrived_bangladesh
ready_for_pickup
completed
cancelled
exception
```

## 4.2 Order Transitions

| From | To | Actor | Rule |
| --- | --- | --- | --- |
| `pending_admin_review` | `confirmed` | admin | Admin approves product, SKU, quantity, and estimate |
| `pending_admin_review` | `cancelled` | admin/client | Client cancels or admin rejects |
| `confirmed` | `queued_for_purchase` | admin | Order is ready for extension/admin purchase |
| `queued_for_purchase` | `purchased` | extension/admin | Provider order and paid amount are recorded |
| `purchased` | `seller_shipped` | extension/admin/system | Seller tracking number is available |
| `seller_shipped` | `received_china` | staff/system | Parcel arrives at China receiving address |
| `received_china` | `qc_checked` | staff | Piece count, weight, and QC result recorded |
| `qc_checked` | `packed` | staff | Item added to carton |
| `packed` | `sent_guangzhou` | staff/admin | Guangzhou courier tracking recorded |
| `sent_guangzhou` | `arrived_guangzhou` | admin/system | Guangzhou warehouse confirms receipt |
| `arrived_guangzhou` | `sent_bangladesh` | admin/system | Shipping partner forwards goods |
| `sent_bangladesh` | `arrived_bangladesh` | admin/system | Goods arrive at Bangladesh warehouse |
| `arrived_bangladesh` | `ready_for_pickup` | admin | Client pickup is available |
| `ready_for_pickup` | `completed` | admin | Client collected goods and charges settled |
| Any active status | `exception` | system/admin/staff | Problem requires review |
| Any active status | `cancelled` | admin | Cancellation approved |
| `exception` | Previous active status | admin | Problem resolved |
| `exception` | `cancelled` | admin | Problem cannot be resolved |

For a product order containing several SKU lines, an admin confirmation performs the first two transitions for every line in one transaction. Both status events are retained even though `confirmed` is not displayed as a separate queue.

Before any `queued_for_purchase` SKU reaches `purchased`, the associated purchase task may move from `queued` to `cart_added` only after one verified product-wide cart action. A failed validation moves the task to `needs_review` and does not change SKU order statuses.

## 4.3 Client-Facing Status Mapping

| Internal Status | Client Display |
| --- | --- |
| `pending_admin_review` | Pending review |
| `confirmed` | Confirmed |
| `queued_for_purchase` | Purchasing |
| `purchased` | Purchased |
| `seller_shipped` | Seller shipped |
| `received_china` | Received in China |
| `qc_checked` | Checked in China |
| `packed` | Packed |
| `sent_guangzhou` | Sent to Guangzhou |
| `arrived_guangzhou` | Received by shipping partner |
| `sent_bangladesh` | On the way to Bangladesh |
| `arrived_bangladesh` | Arrived in Bangladesh |
| `ready_for_pickup` | Ready for pickup |
| `completed` | Completed |
| `cancelled` | Cancelled |
| `exception` | Needs attention |

## 4.4 Order Rules

- Order cannot enter purchase queue without admin approval.
- Order cannot be marked purchased without paid amount or provider order reference unless admin override is used.
- Order cannot be packed before receiving and QC.
- QC failed items cannot be packed unless admin approves.
- Completed orders should be read-only except for super admin correction.

## 5. Legacy Order Group Status Machine

Order-group status is retained solely to interpret records created before group retirement. New orders must not create or transition groups; client shipping progress is derived from SKU-level order statuses and displayed through the product statement.

## 5.1 Group Statuses

```text
open
full
packing
sent_guangzhou
arrived_guangzhou
sent_bangladesh
arrived_bangladesh
ready_for_pickup
completed
cancelled
exception
```

## 5.2 Group Transitions

| From | To | Actor | Rule |
| --- | --- | --- | --- |
| `open` | `full` | system | 40 fulfilled order items reached |
| `open` | `packing` | staff/admin | Items are being repacked |
| `full` | `packing` | staff/admin | Group moves to packing |
| `packing` | `sent_guangzhou` | staff/admin | Cartons sent to Guangzhou |
| `sent_guangzhou` | `arrived_guangzhou` | admin/system | Guangzhou warehouse confirms receipt |
| `arrived_guangzhou` | `sent_bangladesh` | admin/system | International forwarding begins |
| `sent_bangladesh` | `arrived_bangladesh` | admin/system | Goods arrive in Bangladesh |
| `arrived_bangladesh` | `ready_for_pickup` | admin | Client pickup available |
| `ready_for_pickup` | `completed` | admin | Client collects goods |
| Any active status | `exception` | admin/system | Group has unresolved issue |
| Any active status | `cancelled` | admin | Group cancelled |

## 5.3 Group Rules

- A client should have only one active open group unless admin override is used.
- A group can contain up to 40 fulfilled order items.
- Group totals must update when order item actual costs update.
- Client should see group totals and product details.

## 6. Payment Proof Status Machine

## 6.1 Payment Proof Statuses

```text
pending
needs_review
approved
rejected
cancelled
```

## 6.2 Payment Proof Transitions

| From | To | Actor | Rule |
| --- | --- | --- | --- |
| `pending` | `needs_review` | admin | Proof unclear or requires extra confirmation |
| `pending` | `approved` | admin | Payment verified |
| `pending` | `rejected` | admin | Payment invalid |
| `needs_review` | `approved` | admin | Issue resolved |
| `needs_review` | `rejected` | admin | Issue unresolved |
| `pending` | `cancelled` | client/admin | Client uploaded wrong proof |

## 6.3 Payment Proof Rules

- Wallet credit is created only after approval.
- Rejected proof must include reason.
- Approved proof should not be edited.

## 7. Wallet Transaction Status Machine

## 7.1 Wallet Transaction Statuses

```text
pending
posted
reversed
cancelled
```

## 7.2 Wallet Transaction Transitions

| From | To | Actor | Rule |
| --- | --- | --- | --- |
| `pending` | `posted` | system/admin | Transaction confirmed |
| `pending` | `cancelled` | admin | Transaction should not affect wallet |
| `posted` | `reversed` | admin | Correction/refund required |

## 7.3 Wallet Rules

- Posted wallet transactions must not be edited or deleted.
- Reversal never mutates the posted original. It creates a linked posted refund or adjustment with the opposite financial effect and a required reason.
- Full and partial corrections are allowed, but cumulative corrections cannot exceed the original transaction.
- Running balance must be recalculated or validated after each posted transaction.

## 8. Purchase Batch Status Machine

## 8.1 Purchase Batch Statuses

```text
open
sent_to_extension
partially_purchased
purchased
closed
cancelled
exception
```

## 8.2 Purchase Batch Transitions

| From | To | Actor | Rule |
| --- | --- | --- | --- |
| `open` | `sent_to_extension` | admin | Batch is available to extension |
| `sent_to_extension` | `partially_purchased` | extension/admin | Some items purchased |
| `sent_to_extension` | `purchased` | extension/admin | All items purchased |
| `partially_purchased` | `purchased` | extension/admin | Remaining items purchased |
| `purchased` | `closed` | admin | Batch review complete |
| Any active status | `exception` | admin/extension | Provider sync or purchase issue |
| Any active status | `cancelled` | admin | Batch cancelled |

## 8.3 Product Purchase Task States

`queued`, `cart_added`, `awaiting_provider_details`, `awaiting_admin_confirmation`, `needs_review`, and `confirmed` describe the product-wide purchasing task. They do not replace the SKU-level order status machine. A cart result can only mark a task `cart_added` after every SKU in that product order is reported prepared and one cart-add confirmation is present.

## 9. Provider Order Status Machine

## 9.1 Provider Order Statuses

```text
created
paid
seller_processing
seller_shipped
delivered_china
cancelled
refund_requested
refunded
exception
```

## 9.2 Provider Order Transitions

| From | To | Actor | Rule |
| --- | --- | --- | --- |
| `created` | `paid` | extension/admin | Paid amount recorded |
| `paid` | `seller_processing` | provider/system | Seller begins processing |
| `seller_processing` | `seller_shipped` | provider/system/admin | Seller tracking available |
| `seller_shipped` | `delivered_china` | courier/system/staff | Parcel delivered to China address |
| Any active status | `cancelled` | provider/admin | Provider order cancelled |
| Any active status | `refund_requested` | admin/provider | Refund process started |
| `refund_requested` | `refunded` | provider/admin | Refund received |
| Any active status | `exception` | system/admin | Provider data mismatch |

## 10. Parcel Status Machine

## 10.1 Parcel Statuses

```text
expected
in_transit
delivered
received
partially_received
unknown
exception
closed
```

## 10.2 Parcel Transitions

| From | To | Actor | Rule |
| --- | --- | --- | --- |
| `expected` | `in_transit` | system/admin | Seller tracking says shipped |
| `in_transit` | `delivered` | courier/system | Courier marks delivered |
| `delivered` | `received` | staff | Staff scans and confirms all pieces |
| `delivered` | `partially_received` | staff | Some expected pieces missing |
| `expected` | `received` | staff | Staff receives before courier sync |
| Any active status | `unknown` | staff | Tracking is not matched |
| Any active status | `exception` | staff/admin/system | Parcel mismatch or damage |
| `received` | `closed` | system/admin | Parcel items handled |
| `partially_received` | `closed` | admin | Issue resolved |

## 11. QC Status Machine

## 11.1 QC Statuses

```text
pending
pass
fail
partial
missing
admin_approved
```

## 11.2 QC Transitions

| From | To | Actor | Rule |
| --- | --- | --- | --- |
| `pending` | `pass` | staff | Product looks correct |
| `pending` | `fail` | staff | Product damaged/wrong |
| `pending` | `partial` | staff | Some pieces missing or issue with part of order |
| `pending` | `missing` | staff | Expected product not found |
| `fail` | `admin_approved` | admin | Admin approves packing/shipping anyway |
| `partial` | `admin_approved` | admin | Admin approves next action |
| `missing` | `admin_approved` | admin | Admin resolves exception |

## 11.3 QC Rules

- QC failed products cannot be packed without admin approval.
- QC status must record staff user and timestamp.
- QC fail, partial, and missing should notify admin.

## 12. Carton Status Machine

## 12.1 Carton Statuses

```text
draft
packed
label_printed
sent_guangzhou
arrived_guangzhou
sent_bangladesh
arrived_bangladesh
ready_for_pickup
completed
exception
cancelled
```

## 12.2 Carton Transitions

| From | To | Actor | Rule |
| --- | --- | --- | --- |
| `draft` | `packed` | staff | Carton has items and weights |
| `packed` | `label_printed` | staff | Label generated/printed |
| `label_printed` | `sent_guangzhou` | staff/admin | Guangzhou courier tracking added |
| `sent_guangzhou` | `arrived_guangzhou` | admin/system | Guangzhou partner confirms receipt |
| `arrived_guangzhou` | `sent_bangladesh` | admin/system | International shipment started |
| `sent_bangladesh` | `arrived_bangladesh` | admin/system | Arrived in Bangladesh |
| `arrived_bangladesh` | `ready_for_pickup` | admin | Client can collect |
| `ready_for_pickup` | `completed` | admin | Pickup complete |
| Any active status | `exception` | staff/admin/system | Tracking, weight, or receipt issue |
| `draft` | `cancelled` | staff/admin | Carton abandoned before shipping |

## 12.3 Carton Rules

- Carton cannot be sent to Guangzhou without carton code, gross weight, and tracking number.
- Carton label should be created before dispatch.
- Carton cannot be completed before Bangladesh pickup is confirmed.

## 13. Courier Tracking Status Machine

## 13.1 Tracking Statuses

```text
created
picked_up
in_transit
out_for_delivery
delivered
exception
manual_recorded
unknown
```

## 13.2 Tracking Rules

- Courier API is optional in MVP.
- Manual tracking entry is valid.
- OCR-extracted tracking must be reviewed if confidence is low.
- Courier exceptions should notify admin.

## 14. Exception Rules

## 14.1 Exception Types

Recommended exception categories:

```text
product_unavailable
price_changed
sku_mismatch
payment_problem
wallet_insufficient
provider_purchase_failed
tracking_missing
parcel_unknown
quantity_mismatch
qc_failed
carton_weight_mismatch
courier_exception
client_dispute
refund_required
manual_review
```

## 14.2 Exception Resolution

Exception records should store:

- Entity type
- Entity ID
- Exception type
- Severity
- Description
- Assigned admin
- Status
- Resolution note
- Created by
- Resolved by
- Created timestamp
- Resolved timestamp

## 14.3 Exception Statuses

```text
open
assigned
waiting_client
waiting_supplier
resolved
cancelled
```

## 15. Audit Requirements

Create audit logs for:

- Estimate acceptance/rejection
- Order approval
- Order status changes
- Payment proof approval/rejection
- Wallet transaction posting/reversal
- Provider order sync
- Parcel receiving
- QC status change
- Carton creation
- Guangzhou tracking entry
- Final cost adjustment
- Manual override

Audit log should include:

- Actor
- Entity
- Action
- Before data
- After data
- Reason
- Timestamp

## 16. MVP Enforcement Priority

Implement status machines in this order:

1. Estimate
2. Order item
3. Payment proof
4. Wallet transaction
5. Purchase batch
6. Provider order
7. Parcel
8. QC
9. Carton
10. Courier tracking
11. Exceptions

## 17. Default Client Timeline

A normal successful order should follow:

```text
Estimate sent
Estimate accepted
Pending admin review
Confirmed
Queued for purchase
Purchased
Seller shipped
Received in China
QC checked
Packed
Sent to Guangzhou
Arrived at Guangzhou
Sent to Bangladesh
Arrived in Bangladesh
Ready for pickup
Completed
```
