# Client Dashboard Freeze — Admin Delivery

Effective date: 2026-09-07
Status: active until the product owner explicitly resumes client-dashboard work.

## Preserved checkpoint

The active client portal is the existing Next.js `/client` route tree. Its
responsive dashboard reached Client Web Phase 6; the source of truth is
[`CLIENT_WEB_IMPLEMENTATION_STATUS.md`](./CLIENT_WEB_IMPLEMENTATION_STATUS.md).

Implemented client capabilities retained at this checkpoint:

- authenticated client shell, responsive navigation, dashboard, wallet,
  notifications, account, product statement, order list, and New Order route;
- supplier-link resolution, multi-SKU selection, direct server confirmation,
  product-order cards, wallet funding/proof submission, ledger, and exports;
- server-side role checks, RLS-scoped reads, wallet history, and client-facing
  product/order snapshots.

Known deferred client work remains unchanged:

- an authoritative persisted multi-SKU estimate review before confirmation;
- order-detail route/deep links, cancellation/modification/refund flow, and
  complete Favorites/Repeat Order work;
- session-refresh production verification, Product Statement responsive table
  work, account editing/help, and browser E2E/accessibility coverage.

## Freeze rules

- Do not modify `app/client/**`, client components, client visual snapshots, or
  client API behavior during admin phases.
- Do not alter client ownership, RLS, wallet, order, estimate, or product
  snapshot behavior merely to simplify an admin feature.
- Admin work may add backward-compatible server/database support only when a
  focused client compatibility test proves existing client behavior remains
  intact.
- Client work resumes from this document and the linked implementation status,
  after an explicit product-owner approval.

## Regression baseline

Run the client static suite before and after an admin phase:

```powershell
npm test -- --test-name-pattern "client"
```

Run the targeted visual suites when a shared layout or UI primitive changes:

```powershell
npm run test:visual:dashboard
npm run test:visual:orders
npm run test:visual:new-order
```

No Phase 0 artifact changes a client route, API, schema behavior, or visual
snapshot.
