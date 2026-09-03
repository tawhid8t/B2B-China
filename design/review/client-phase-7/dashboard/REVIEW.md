# Phase 7 Dashboard review

Status: **Approved**

Primary reference: `design/reference/client-mobile/v1/originals/dashboard-standalone.png`

Secondary reference: `design/reference/client-mobile/v1/screens/dashboard-mobile-compact.png`

Primary review capture: `captures/mobile-430.png`

## Fidelity decisions

- The mobile hierarchy follows the approved standalone reference: greeting and notification, available balance, reservations/rate, payment-proof state, funding action, allocation, shipment stages, attention, and recent activity.
- The UI shows real Available-versus-Reserved wallet truth instead of the illustrative Paid-versus-Reserved period chart.
- Server-supported recent orders, wallet activity, and notifications remain below the reference-height fold rather than being removed.
- Simulated OS status bars, device frames, avatars, and the home indicator are excluded.
- Refresh remains available from tablet/desktop without adding a second mobile header action.

## Captures

- `mobile-430.png` / `mobile-430-full.png`
- `small-phone-320.png` / `small-phone-320-full.png`
- `tablet-768.png` / `tablet-768-full.png`
- `laptop-1024.png` / `laptop-1024-full.png`
- `desktop-1440.png` / `desktop-1440-full.png`

The approved captures are now locked as automated visual regression goldens.
