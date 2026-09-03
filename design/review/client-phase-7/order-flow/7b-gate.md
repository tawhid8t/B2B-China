# Subphase 7B Gate — Link Entry and Loading

Status: `awaiting_owner_approval`

Implemented:

- Mobile-first link-entry composition aligned with the approved New Order reference.
- Client-side empty, malformed, unsupported-marketplace, and public-link validation.
- Existing 1688, Taobao, and Tmall support retained.
- `AbortController`-based cancellation with stale-request protection.
- Supplier URL preservation across cancel, retryable provider errors, manual review, and network failure.
- Dedicated loading composition with a product skeleton and honest text stages.
- No fabricated percentage, price, stock, or completion reporting.
- Separate cancelled, retryable provider, manual-review, and connection presentations.
- Reduced-motion support and accessible live loading status.

Review captures:

- `design/review/client-phase-7/new-order/captures/7b-loading-mobile-430.png`
- `design/review/client-phase-7/new-order/captures/7b-cancelled-mobile-430.png`
- `design/review/client-phase-7/new-order/captures/7b-retryable-error-mobile-430.png`

Validation states automated:

- Empty link
- Malformed link
- Unsupported marketplace
- Loading
- Cancelled
- Retryable provider failure
- Manual-review response
- Network failure
- Resolved product transition

Subphase 7C has not started.
