# Client Product Statement Contract

## Purpose

The client product statement is the active replacement for client-facing order groups. It is an interactive, spreadsheet-style page; XLSX export is out of scope for its first release.

## Row Identity And Scope

- One row represents one client product link. All SKU/color/size order items for that client and product link are aggregated into that row.
- SKU-level order items remain the source of truth for purchasing, wallet transactions, warehouse events, statuses, and audits.
- Rows include legacy orders as well as ungrouped future orders. Legacy group identifiers are not displayed as active client workflow data.

## Columns And Data Rules

Each row displays product code, product image, total paid product amount (CNY), total local delivery charge (CNY), total weight (kg), total quantity, China warehouse-to-Guangzhou cost (weight x CNY 4/kg), Bangladesh shipping fee, service charge (6% of product amount), total BDT, average unit cost, current shipping position, and the client-visible admin note.

- A persisted estimate is the only source that qualifies an order for estimated values. If no persisted estimate exists, estimate-derived cells remain blank until their actual value is available.
- A verified actual value replaces its corresponding estimate immediately. The row total uses actual components where available and remaining estimate components where available, and is labelled `partial` until every required component is actual.
- BDT values are summed from each SKU line's saved historical rate/BDT amount. The statement must not recalculate historical lines using a newer exchange rate.
- Local delivery comes from the saved supplier/provider delivery amount. Guangzhou cost uses the applicable statement weight at CNY 4/kg. Bangladesh shipping uses the saved category shipping rate and applicable weight. Service charge is 6% of the applicable product amount.
- `Average unit cost` equals the displayed total BDT divided by the total quantity when both are available; otherwise it is blank.
- If a product-link row contains different SKU statuses, it shows the least-advanced client-facing order status plus a `mixed progress` indicator.

## Query And Presentation

- Server-side authorization restricts every response to the signed-in client.
- Supported filters are date range, month, category, and status.
- The table returns exactly 30 rows per page and displays numbered pagination.
- The chart uses the same filtered dataset and shows distinct ordered-product count, total quantity, total weight, and category-wise versions of those metrics.
- Empty and error states must be explicit. Mobile presentation may scroll horizontally but must not hide financial or status information.

## Compatibility

The feature does not delete order groups, rewrite legacy records, alter wallet ledger history, or change order-status transitions. Any new database fields or API endpoints require an additive, separately reviewed implementation phase.
