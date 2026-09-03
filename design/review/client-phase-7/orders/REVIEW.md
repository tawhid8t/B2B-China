# Phase 7 Orders review

Status: **Approved**

Primary reference: `design/reference/client-mobile/v1/originals/orders-standalone.png`

Secondary reference: `design/reference/client-mobile/v1/screens/orders-mobile-compact.png`

Primary review capture: `captures/mobile-430.png`

## Fidelity decisions

- Cards now prioritize the order number, authoritative status, product identity, SKU/quantity summary, order total, and five-stage delivery position from the approved mobile reference.
- SKU costs remain available through an explicit Details control. The page opens as a compact mobile-friendly order list rather than displaying all SKU cost rows by default.
- The reference-only search, filtering, order counts, category labels, and estimate expiry prompt are intentionally excluded because the current client contracts do not support them.
- The actual client status drives the progress position; no illustrative shipping state or financial value is introduced.

## Captures

- `mobile-430.png` / `mobile-430-full.png`
- `small-phone-320.png` / `small-phone-320-full.png`
- `tablet-768.png` / `tablet-768-full.png`
- `laptop-1024.png` / `laptop-1024-full.png`
- `desktop-1440.png` / `desktop-1440-full.png`

The approved captures are now locked as automated visual regression goldens.
