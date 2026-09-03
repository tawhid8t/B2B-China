# Wallet and Payment Implementation

Status: complete and deployed on 2026-08-30.

## Accounting rules

- Wallet values are CNY; funding claims and verified payments are BDT.
- The persisted current default is `1 CNY = 19.2000 BDT`.
- Exchange-rate history and posted wallet transactions are append-only.
- Available balance is all posted ledger value. Active reservations are the
  inverse of posted reservation/release value. Total funds exclude reservation
  and release entries.
- Orders reserve no more than available balance. Uncovered CNY remains on the
  order and does not block confirmation or make a wallet negative.
- Purchase commitment releases the hold and debits only the wallet-covered
  amount. Corrections create linked opposite-effect entries.

## Delivered surfaces

- Client: `/client/wallet`, `/client/notifications`, payment and wallet CSVs.
- Admin: `/admin/payments`, `/admin/wallet`, `/admin/notifications`, live
  financial dashboard, and super-admin payment settings.
- Backend: private 10 MB proofs, atomic idempotent review credit, canonical
  wallet statements, corrections, partial reservations, lifecycle releases,
  recipient-only notifications, protected summaries, and reconciliation.

## Notification events

- New payment proof to each active admin/super admin.
- Payment review outcome to the submitting client.
- Uncovered wallet cost to the client and active administrators.
- Reservation release and wallet adjustment/correction to the affected client.

Notification RLS is recipient-only even for administrators. Authenticated users
can update only `read_at`; message content is server-controlled.

## Verification

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `supabase db push --linked --dry-run`

The live reconciliation returned zero negative wallets, malformed approved
proof credits, over-corrections, and invalid order-coverage rows. The linked
migration list includes `complete_wallet_notifications_and_dashboard` and
`remove_legacy_notification_admin_read_policy`.
