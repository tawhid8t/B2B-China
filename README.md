# BridgeCart Operations MVP

Greenfield starter for a China-to-Bangladesh sourcing and fulfillment platform.

## Stack

- Next.js App Router, React, TypeScript, Tailwind CSS
- Supabase Auth, Postgres, Storage, RLS, Edge Functions-ready API boundaries
- OTAPI product lookup adapter for 1688/Taobao
- Chrome extension scaffold for admin-assisted purchasing

## Local setup

1. Install dependencies with `npm install`.
2. Copy environment values into `.env.local`.
3. Run `npm run dev`.
4. Apply `supabase/migrations/001_initial_schema.sql` to your Supabase project.

## Environment

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OTAPI_KEY=
```

When `OTAPI_KEY` is missing, `/api/products/resolve-link` returns deterministic mock product data for local testing.

## Main routes

- `/` operations overview
- `/client` client self-ordering and wallet concept
- `/admin` admin review and purchase queue concept
- `/staff` mobile warehouse receiving and carton flow
- `/extension` Chrome extension operating notes

## API contracts

The implemented route skeletons match the architecture plan:

- `POST /api/products/resolve-link`
- `POST /api/estimates`
- `POST /api/orders/confirm`
- `POST /api/payments/proof`
- `POST /api/admin/payments/:id/approve`
- `GET /api/extension/purchase-queue`
- `POST /api/extension/provider-order-sync`
- `POST /api/staff/parcels/receive`
- `POST /api/staff/cartons`
- `POST /api/courier/track-sync`
