# Admin Staging Workflow

This repository contains fictional, deterministic seed data for the admin
workflow. It is for a local Supabase stack or an intentionally separate staging
project only. It must never be applied to a linked, preview, or production
database containing business data.

## Start safely

1. Confirm the active target is local or the dedicated empty staging project.
2. For local verification, run `supabase start` and `supabase db reset --local`.
3. Sign in using a fixture account created by local Auth, then assign the
   matching role listed below if local Auth management is required.
4. Use the fixture records to exercise admin screens and the extension without
   checkout or provider payment.

The extension credential fixture is a hashed placeholder only. It is not a
usable Chrome-extension token. Create a fresh credential through the protected
admin UI when testing the extension.

## Fixture roles

| Fixture email | Role | Purpose |
| --- | --- | --- |
| `staging.client@example.test` | client | Owns all fictional orders and wallet data. |
| `staging.receiver@example.test` | staff_receiver | Receives parcels and records QC. |
| `staging.packer@example.test` | staff_packer | Packs verified items into cartons. |
| `staging.admin@example.test` | admin | Reviews/queues orders and runs purchasing. |
| `staging.superadmin@example.test` | super_admin | Exercises protected settings/governance. |

## Scenario inventory

- `PORD-STAGING-PENDING`: one 1688 link with two selected SKU lines, pending
  review; validates atomic confirmation into one product task.
- `PORD-STAGING-QUEUE`: two SKU lines queued together in one extension task;
  validates one product-wide cart action.
- `PORD-STAGING-CART`: cart-added task awaiting provider details; validates that
  cart addition is not a purchase.
- `PORD-STAGING-FULFILLMENT`: purchased, tracked, received/QC-checked product
  with a carton and tracking event; validates oversight screens.
- `PORD-STAGING-EXCEPTION`: an exception SKU line and open operational alert.
- A pending payment proof and posted wallet credit provide finance-review data.

All URLs, provider order IDs, tracking IDs, money values, names, and emails are
non-production fixtures. No seed contains provider passwords, a usable extension
credential, customer data, or payment details.
