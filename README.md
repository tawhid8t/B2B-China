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
RAPIDAPI_KEY=
RAPIDAPI_HOST=
OTAPI_DEV_MOCK_MODE=false
```

Set `OTAPI_DEV_MOCK_MODE=true` only for local development. Production requests use the server-only `RAPIDAPI_KEY` and `RAPIDAPI_HOST` values.

The local `.mcp.json` file can connect the RapidAPI OTAPI MCP server for development assistance. It is intentionally ignored by Git and must never be copied into frontend code or committed.

## Main routes

- `/` operations overview
- `/client/wallet` client wallet, private proof submission, history, and CSV export
- `/client/notifications` client payment and wallet inbox
- `/admin` protected operations and financial dashboard
- `/admin/payments` payment review queue and proof verification
- `/admin/wallet` client wallet reconciliation, adjustments, corrections, and export
- `/admin/notifications` admin financial event inbox
- `/staff` mobile warehouse receiving and carton flow
- `/extension` Chrome extension operating notes

## API contracts

The implemented route skeletons match the architecture plan:

- `POST /api/products/resolve-link`
- `POST /api/estimates`
- `POST /api/orders/confirm`
- `POST /api/payments/proof`
- `POST /api/admin/payments/:id/approve`
- `GET /api/wallet`
- `GET /api/notifications`
- `POST /api/notifications/:id/read`
- `GET /api/extension/purchase-queue`
- `POST /api/extension/provider-order-sync`
- `POST /api/staff/parcels/receive`
- `POST /api/staff/cartons`
- `POST /api/courier/track-sync`
