# Phase 7 New Order review

Status: **Awaiting owner approval**

Primary references:

- `design/reference/client-mobile/v1/screens/new-order-entry-mobile.png`
- `design/reference/client-mobile/v1/screens/product-loading-mobile.png`
- `design/reference/client-mobile/v1/screens/sku-selection-sheet-mobile.png`
- `design/reference/client-mobile/v1/screens/size-quantities-sheet-mobile.png`

## Fidelity decisions

- The existing authenticated link resolver remains the only entry point; it now uses the source hierarchy of a clear New Order heading, link field, supported-link guidance, and a full-width primary resolution action on phones.
- Resolver loading remains honest about the data being checked and continues to expose its existing retry and validation states.
- Mobile variant selection keeps the existing bottom sheet while changing narrow rows from a wide table into touch-friendly variant cards with price, stock, and quantity controls.
- The existing local estimate, server confirmation, pending-payment messaging, failure state, and success state remain intact. The unavailable dedicated estimate-review and submission-result routes remain deferred.
