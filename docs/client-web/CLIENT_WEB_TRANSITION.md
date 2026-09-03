# Client Web Transition

Status: Active transition record

Effective date: 2026-09-02

Active frontend target: Existing Next.js client portal

## 1. Decision

Native client development is intentionally paused after Mobile Phase 6. The active frontend objective is to turn the existing Next.js client portal into a production-quality, fully responsive, mobile-first, app-like client web application.

The pause consolidates delivery around the working client portal and avoids maintaining parallel native and web implementations of the same client workflows. It is a prioritization decision, not an abandonment or rollback of the native work. The native project, its verified foundation, and its design and architecture decisions remain preserved for a future explicitly approved restart.

This transition does not create a new website, a separate mobile-web codebase, or a replacement backend. Responsive client-web work must improve the existing routes and shared components incrementally.

## 2. Native implementation checkpoint

| Phase | Checkpoint | Result |
| --- | --- | --- |
| 0 | Client mobile product specification | Defined the authenticated-client product scope, journeys, authority boundaries, non-goals, open decisions, and future acceptance criteria. Documentation only. |
| 1 | Mobile-readiness repository audit | Audited the existing web, API, database, authentication, wallet, order, Statement, favorites, notification, and reusable-code foundations. Documentation only. |
| 2 | Mobile architecture | Selected Expo React Native and Expo Router, the `mobile/` workspace, shared-package boundaries, API-only business access, secure storage, caching, navigation, testing, and deployment direction. Documentation only. |
| 3 | Mobile API gap analysis | Mapped the planned mobile experience to implemented APIs and recorded blocking contract gaps and compatibility requirements. Documentation only. |
| 4 | Mobile UX architecture and design system | Defined the five-destination information architecture, interaction patterns, phone layouts, accessibility baseline, Google Stitch concepts, and responsive design references. Documentation and design exploration only. |
| 5 | Mobile application foundation | Implemented the Expo SDK 57 application foundation, workspaces, environment validation, navigation shell, theme tokens, UI primitives, error/loading/network/query infrastructure, secure-storage interface, typed API envelope handling, tests, lint/typecheck, and Android bundle validation. |
| 6 | Client mobile authentication and persistent session | Implemented locally: client-only password sign-in, protected route groups, server bootstrap verification, persistent chunked SecureStore sessions, refresh/retry and foreground revalidation, verified account identity, device-local logout, and user-scoped query cleanup. Live Supabase and physical-device verification remain pending. |

Mobile Phases 0-4 produced specifications, audits, architecture, contract analysis, and UX/design evidence. Phases 5-6 produced the native foundation and authentication/session layer. No later native business-feature phase has been implemented or authorized.

## 3. Completed native capabilities

- Expo Router application shell with startup, signed-out, and verified-client route protection.
- Five client destinations: Home, Orders, New Order, Wallet, and Account.
- Strict TypeScript, environment separation, safe-area handling, theme tokens, and shared Screen, Text, Button, Card, Loading, and Error primitives.
- Network awareness, TanStack Query foundation, typed API envelope parsing, redacting logs, and root error handling.
- Supabase password authentication using public client configuration only.
- Bearer-authenticated `GET /api/client/bootstrap` verification for active client accounts while retaining server authorization and RLS.
- Versioned two-slot SecureStore persistence with chunking, integrity validation, `WHEN_UNLOCKED` access, and no plaintext fallback.
- Cold-launch restoration, session refresh, foreground revalidation, recoverable network handling, and local-device logout.
- Mobile unit/component tests and root/mobile typecheck, lint, test, Expo Doctor, and Android export validation recorded in `docs/mobile/MOBILE_IMPLEMENTATION_STATUS.md`.

## 4. Native capabilities not implemented

The native Home, New Order, Orders, and Wallet routes remain foundation placeholders. The Account route contains only verified identity and device-local logout. The following client business experiences have not been implemented natively:

- Dashboard data and attention summaries.
- Product-link resolution, product display, multi-SKU selection, estimates, confirmation, and ordering mutations.
- Order list, order detail, lifecycle timeline, filters, and financial provenance.
- Wallet balances, funding instructions, proof upload/history, ledger activity, and transaction detail.
- Product Statement list/detail and its filters, metrics, and fixed server pagination.
- Favorites, provider refresh, and Repeat Order.
- Full notification experience, missing lifecycle events, native push, device registration, preferences, and entity deep links.
- Password recovery/deep links, global or all-device session revocation, biometric/device-security decisions, and production monitoring.
- Physical Android/iOS verification, signed store-ready builds, store delivery, and iOS Simulator validation.

## 5. Native freeze boundary

Until native development is explicitly resumed:

- Do not delete, rewrite, upgrade, or continue feature development in `mobile/`.
- Preserve native configuration, assets, tests, authentication/session code, UI foundation, navigation, and environment/build decisions.
- Preserve the native architecture and UX records under `docs/mobile/`, including Google Stitch identifiers and review conclusions.
- Preserve the root workspace arrangement and the existing `packages/contracts` and `packages/domain` boundaries. Shared packages may serve both platforms only through separately approved, backward-compatible changes; responsive web work must not reshape them merely for UI convenience.
- Do not undo Mobile Phases 0-6 or represent placeholder native business screens as implemented features.

## 6. Design direction reusable by client web

The latest approved visual authority is Premium Dark Accent Commerce: deep teal primary actions, a crisp off-white canvas, white elevated surfaces, strong typography, subtle borders, and restrained mint, aqua, violet, and coral labeled accents. It supersedes the older light commerce-green Stitch palette. Stitch outputs and supplied screenshots remain interaction and information-hierarchy references, not production component source or branding instructions.

Responsive client-web phases should reuse these ideas where they fit the existing web implementation:

- Phone-first, five-destination navigation with a prominent New Order action, adapted without creating separate business implementations.
- Safe-area-aware sticky navigation/actions, minimum touch targets, keyboard clearance, and layouts that remain usable from small phones through desktop.
- Tall sheets or full-height phone panels for multi-SKU selection and estimate review, with appropriate desktop dialog/panel adaptations.
- Image-based variant grids and dense quantity-per-SKU rows with visible selection, stock, quantity, and sticky summaries.
- Product-submission order grouping with compact SKU lines, clear status, pieces, cost state, total, and last-update context.
- Strong wallet hierarchy for Available balance, Active reservations, and Total funds, followed by right-aligned ledger amounts and running-balance context.
- Explicit Estimated, Actual, Partial, Mixed progress, Current, Refreshing, Stale - read only, and Expired states.
- Progressive disclosure through scannable cards/lists and complete detail views without hiding important financial or status information.

The 1688 and Alipay references must not be copied as trade dress. Do not use proprietary names as branding, logos, icons, artwork, colors, marketing content, or pixel-identical layouts.

## 7. Shared platform foundation

The following existing platform work remains reusable by both the client web and any future native client:

- The existing Next.js authenticated API boundary and response/error contracts.
- Supabase Auth, server-derived actor and client identity, RLS ownership enforcement, and private storage controls.
- Product resolution/provider adapters, normalized product/SKU data, and server-side freshness and availability decisions.
- Authoritative multi-SKU confirmation behavior, product-order and SKU-line identities, and the existing order/status lifecycle.
- The append-only wallet ledger, reservations, funding/payment-proof workflow, corrections, historical rates, and reconciliation rules.
- Product Statement aggregation and its client-owned read boundary.
- Favorites/Repeat Order domain rules and the implemented portions of their protected routes.
- Recipient-owned notification APIs and existing durable notification events.
- Shared wire contracts and framework-neutral domain decisions that have been explicitly approved and validated for both consumers.

Supabase/Postgres, server APIs, and the documented status and financial rules remain authoritative. Browser caches and responsive presentation state are never authorization, financial truth, or permission to perform a business transition. No service-role key, provider credential, or other server secret may enter client code.

## 8. Active objective and scope boundaries

**Active objective:** improve the existing Next.js client portal into one production-quality responsive application that feels app-like on phones while retaining practical desktop layouts.

**In scope for this roadmap:** authenticated client-web routes, shared client-facing responsive components, client navigation, layout, density, cards/tables, dialogs/sheets, interaction states, accessibility, and presentation-level performance.

**Outside this roadmap:** native application development, admin and super-admin interfaces, staff receiver/packer workflows, warehouse and purchasing-extension workflows, the public marketing site, backend rewrites, database redesign, API renaming, status-machine changes, financial-rule changes, and authorization changes. A narrowly required shared compatibility change must be identified and separately approved before expanding scope.

Each later client-web phase must inspect and preserve working behavior, modify the smallest practical surface, use the existing routes and contracts, and stop after that explicitly approved phase.

## 9. Carried contract gaps

This transition does not resolve the native planning documents' known gaps. Future work must not invent behavior for:

- A canonical reviewed multi-SKU estimate/confirmation lifecycle.
- Consistent session-derived identity across all client mutations.
- Canonical typed and refreshable product-order list/detail contracts.
- Revision-safe Favorites refresh and complete Repeat Order behavior.
- Client cancellation scope, reservation release, refunds, and disputes.
- Estimate expiry automation and incomplete provider, QC, shipping, pickup, and non-wallet notification events.

These gaps remain governed by the existing business, database, API, status-machine, and implementation-checkpoint documents. They do not authorize backend changes during responsive web UI phases.

## 10. Future native-resume strategy

Native development may resume only after explicit approval. A resume phase must:

1. Treat the current Phase 6 source and documentation as the checkpoint; do not regenerate or replace the native project.
2. Re-audit the repository, authoritative contracts, deployed migrations, mobile dependencies, Expo compatibility, and security assumptions.
3. Reconcile any client-web contract changes while preserving backward compatibility for both platforms.
4. Complete live Supabase bearer/RLS verification and physical Android/iOS checks for SecureStore, background/foreground transitions, logout, and session recovery.
5. Confirm identifiers, EAS/store accounts, release ownership, monitoring, privacy, and rollback requirements.
6. Continue unfinished native business features only through separately approved phases with their blocking contracts resolved first.
