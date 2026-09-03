# Favorites / Repeat Order

## Purpose

Clients can save a confirmed prior order as a favorite and use it to begin a new order without pasting the supplier link again. A favorite is a convenience reference, never a price, availability, SKU, or order snapshot for reuse.

## Invariants

- A repeat order is a new estimate and, only after estimate acceptance, a new order item.
- The original order item, estimate, provider data, financial records, and status history remain unchanged.
- The repeat flow must obtain current provider product/SKU data before it creates a new estimate.
- The estimate uses current exchange, shipping, profit, domestic-delivery, and weight rules; the normal estimate-validity rule then applies.
- No client-provided client ID, price, provider payload, or SKU ownership claim is trusted by the server.

## Data model

### `client_favorites`

Add an additive, client-owned table:

| Column | Rule |
| --- | --- |
| `id uuid primary key` | Favorite identifier. |
| `client_id uuid not null references clients(id)` | Favorite owner. |
| `source_order_item_id uuid not null references order_items(id) on delete restrict` | Confirmed source order. |
| `source_product_link_id uuid not null references product_links(id) on delete restrict` | Original product reference for display/provenance. |
| `source_product_sku_id uuid references product_skus(id) on delete restrict` | Original selected SKU when known. |
| `preferred_provider_sku_id text` | Last known provider SKU identifier; preference only. |
| `preferred_variant_attributes jsonb not null default '{}'` | Last selected color/size attributes; preference only. |
| `preferred_variant_label text` | Historical display label; never used as a matching key. |
| `status text not null default 'active'` | `active` or `archived`. |
| `created_at`, `archived_at`, `archived_by` | Lifecycle and audit support. |

Constraints and indexes:

- Unique `(client_id, source_order_item_id)`.
- Index `(client_id, status, created_at desc)`.
- A client may favorite only an owned, non-cancelled order that reached `confirmed` or a later valid order status.

### `favorite_refreshes`

Add a short-lived, server-created record for every repeat-order refresh attempt:

| Column | Rule |
| --- | --- |
| `id uuid primary key` | Refresh identifier. |
| `favorite_id uuid not null references client_favorites(id) on delete restrict` | Favorite being refreshed. |
| `client_id uuid not null references clients(id)` | Denormalized owner for RLS. |
| `status text not null` | `resolved`, `unavailable`, `manual_review_required`, or `failed`. |
| `resolved_product_link_id uuid references product_links(id)` | Fresh immutable product snapshot when resolved. |
| `resolved_at`, `expires_at` | Refresh is usable for estimate creation only until expiry; default 15 minutes. |
| `provider_sku_match_status text` | `matched`, `selection_required`, or `unavailable`. |
| `created_at` | Attempt history. |

Add nullable `favorite_id` and `favorite_refresh_id` foreign keys to `estimates`. Accepted order items remain traceable through their `estimate_id`; no historical `order_items` rows are changed.

Provider raw payload remains in the normal `integration_logs` record, not in a client-readable favorite row.

### Product-snapshot prerequisite

`favorite_refreshes.resolved_product_link_id` must point to a fresh immutable product/SKU snapshot. The current `product_links` provider-identity uniqueness and upsert pattern must be made revision-safe before implementation; it cannot overwrite the source order's product record. The implementation may add product revisions or another additive immutable snapshot strategy, but must not mutate historical order-linked product data.

## API contract

All endpoints require an authenticated session. The server derives the client from that session; request bodies never include `clientId`.

### `GET /api/favorites`

Roles: `client`, `admin`, `super_admin`.

Clients receive only their active favorites. Admin roles may read for support using the existing client-scoped authorization rules.

Each item includes favorite provenance, last-known display details, and its latest refresh status. It does not expose raw provider payloads or historical financial values as current prices.

### `POST /api/favorites`

Roles: `client`, `admin`, `super_admin`.

Request:

```json
{ "orderItemId": "uuid" }
```

Creates one favorite from an eligible owned source order. A duplicate active favorite returns `CONFLICT`; an ineligible/missing order returns `NOT_FOUND` or `FORBIDDEN` without disclosing another client's data.

### `DELETE /api/favorites/:id`

Roles: `client`, `admin`, `super_admin`.

Archives the favorite. It does not delete source order, estimate, product, SKU, provider, or audit history.

### `POST /api/favorites/:id/refresh`

Roles: `client`, `admin`, `super_admin`.

Resolves the favorite's original supplier URL through the provider boundary with a cache bypass/fresh lookup. It creates an integration log and a `favorite_refreshes` record, then returns one of:

- `resolved`: fresh product ID, current SKU list, provider availability, current CNY price data, and current domestic delivery data.
- `unavailable`: no estimate/order can be created from this refresh.
- `selection_required`: the product is available but the original SKU cannot be safely reused.

Provider/network failures use the existing error envelope with `PROVIDER_LOOKUP_FAILED` or `MANUAL_REVIEW_REQUIRED`. A clearly unavailable product is a successful response with `data.status: "unavailable"`, so the client can see the actionable state.

### `POST /api/favorites/:id/estimates`

Roles: `client`, `admin`, `super_admin`.

Request:

```json
{
  "refreshId": "uuid",
  "skuId": "uuid",
  "quantity": 12,
  "estimatedUnitWeightKg": 0.35,
  "notes": "Optional client note"
}
```

The server verifies that the refresh belongs to the authenticated client, is `resolved`, has not expired, and that the SKU belongs to its fresh product snapshot. It then invokes the standard estimate creation rules and records `favorite_id` and `favorite_refresh_id` on the new estimate. Its successful response is the standard estimate envelope.

Errors: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `VALIDATION_ERROR`, `MANUAL_REVIEW_REQUIRED`, and `PROVIDER_LOOKUP_FAILED`.

## Permissions and RLS

- Clients can select, insert, and archive only favorites and refreshes where `client_id` is their own client record.
- Clients have no direct write permission to `product_links`, `product_skus`, `integration_logs`, `audit_logs`, estimates, or order items through this feature.
- Refresh, product snapshot persistence, estimate creation, and audit writes run only in authorized server-side services.
- `staff_receiver` and `staff_packer` have no access to favorites, refreshes, pricing, or financial estimate data.
- `admin` and `super_admin` access follows the existing client-support model; only the client owner may initiate a client self-service repeat order.

## Client flow

1. From an eligible order detail, the client selects **Save to favorites**.
2. In Favorites, the client selects **Repeat order**.
3. The application refreshes the supplier listing and shows current product data, current variants, and the refresh state.
4. The client confirms quantity and selects a current SKU where needed.
5. The application creates a new estimate from the fresh refresh. It does not show or carry forward an old estimate total.
6. The normal estimate acceptance flow creates a new `pending_admin_review` order item and follows the existing order status machine.

## Refresh, availability, and SKU behavior

### Price and estimate refresh

- Every repeat-order estimate requires a successful fresh provider resolution; public-preview cache results and historical source values are insufficient.
- The refresh token expires after 15 minutes. An expired refresh must be repeated before estimate creation.
- The new estimate snapshots current provider price/delivery plus current business settings. Estimate acceptance follows the existing validity period and must not reuse a prior accepted estimate.

### Unavailable products

- Keep the favorite visible with an unavailable state and the last-known preference for reference.
- Do not create an estimate, reservation, order item, or purchase-queue entry.
- Record a `product_unavailable` exception and notify the client/admin according to the notification policy when implemented.
- The client may archive the favorite; an admin may offer a replacement or manual product workflow.

### SKU matching

- First attempt an exact current `provider_sku_id` match.
- If unavailable, attempt an exact normalized attributes match. Labels are display-only and cannot authorize an automatic substitution.
- If no exact available match exists but current SKUs exist, require the client to select a current SKU and mark the refresh `selection_required`.
- If no current SKU is available, treat the repeat item as unavailable.
- A newly selected SKU always uses its current price and availability; the saved variant remains historical preference only.

## Audit and history

Create append-only audit events for favorite creation, archival, refresh start/result, SKU-selection change, repeat-estimate creation, and estimate acceptance/rejection. Include actor, favorite/refresh/estimate identifiers, source order item, before/after preference data where changed, reason for manual action, and timestamp.

Every provider refresh attempt creates an `integration_logs` record with the server-side request metadata, raw provider payload where available, status, and error details. Raw payloads remain restricted to authorized operational access.

No action in this feature updates historical estimate breakdowns, order price/quantity/SKU records, status events, wallet transactions, provider orders, or audit entries. New records carry provenance through `favorite_id`, `favorite_refresh_id`, and the source order reference.
