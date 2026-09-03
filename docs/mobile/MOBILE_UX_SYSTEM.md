# Client Mobile UX Architecture and Design System

- **Phase:** 4 — UX architecture and Google Stitch design exploration
- **Audience:** Product, design, mobile, backend, QA, security, and operations
- **Status:** Planning artifact; no production mobile feature implementation is authorized by this document

> **Visual direction supersession (2026-09-02):** Premium Dark Accent Commerce was approved through the standalone visual review pack. Its deep teal actions, crisp off-white canvas, white elevated cards, and restrained mint/aqua/violet/coral labelled accents supersede the older light commerce-green Stitch presentation as the visual reference for implementation. This does not alter business rules, lifecycle labels, API gates, or the approved five-item navigation.

## 1. Purpose and authority

This document defines the client-role mobile information architecture, interaction model, screen system, visual language, responsive behavior, and accessibility baseline for BridgeCart. The experience is optimized for a Bangladesh-based client sourcing from 1688 through the existing platform.

The backend, database, authorization and RLS rules, status machines, wallet ledger, estimate lifecycle, provider integrations, and API contracts remain authoritative. A visual control does not grant permission, a cached value does not authorize a mutation, and a Stitch concept does not create a backend capability.

Phase 4 changes no application code, dependencies, API, schema, migration, or repository structure. Google Stitch output is conceptual evidence only. Generated HTML and component structure must not be copied into production without translating it into the approved Expo architecture and real contracts.

## 2. Experience principles

1. **Start with the client's task.** The primary path is paste link, select SKUs, review a fresh server estimate, confirm, and track one product submission.
2. **Keep financial truth explicit.** Currency, estimate/actual state, saved rate, wallet coverage, reservations, and uncovered amounts are labeled rather than inferred.
3. **Make dense data scannable.** SKU and order density comes from consistent rows, alignment, grouping, and sticky summaries—not smaller touch targets.
4. **Progressively disclose detail.** Lists show the decision-critical summary; a sheet or detail screen retains the complete record.
5. **Treat freshness as part of the UI.** Current, refreshing, stale, expired, and offline states are visible and have different permitted actions.
6. **Fail closed for mutations.** Ordering and financial actions require connectivity, current authorization, and server acknowledgement.
7. **Stay restrained.** Off-white canvas, white surfaces, strong typography, subtle borders, minimal elevation, and functional motion support a trustworthy sourcing product.
8. **Do not imitate providers.** BridgeCart uses no 1688 or Alipay logos, branded icons, proprietary artwork, or copied visual identity.

## 3. Screenshot reference findings

The supplied screenshots are interaction references, not implementation or branding instructions.

| Reference | Pattern retained | Pattern rejected |
| --- | --- | --- |
| Alipay balance | Strong available-balance hierarchy, few primary actions, right-aligned transaction amounts, running-balance context | Alipay logo/icons, blue gradient identity, withdrawal action, floating translation control |
| 1688 orders | Search and status filtering, product-level grouping, dense repeated SKU lines, total and state at the group boundary | 1688 branding, provider-specific receipt/cart controls, delete/review actions, proprietary icons |
| 1688 image variant selector | Tall bottom sheet, product context, image-based variant grid, visible selected state, sticky quantity/amount action area | Orange marketplace identity, promotional banners, proprietary marketing content |
| 1688 quantity-per-size selector | Large scrollable SKU list, per-row stock/price/stepper, persistent selected-count summary | Provider checkout/cart semantics, copied typography and exact layout |

## 4. Information architecture

### 4.1 Primary navigation

The signed-in app has five first-level destinations:

| Destination | Purpose | Navigation rule |
| --- | --- | --- |
| **Home** | Start order, attention summary, recent activity, Statement and Favorites shortcuts | Default destination after verified client bootstrap |
| **Orders** | Search, filter, browse, and open owned product submissions | One card per `product_order`; SKU lines remain visible within the card/detail |
| **New Order** | Begin the 1688 link flow | Visually prominent central item; never a floating overlay over another sticky action |
| **Wallet** | Available balance, active reservations, total funds, funding, and ledger | Financial data revalidates on foreground and before action |
| **Account** | Read-only identity, Statement, Favorites, Notifications, Settings, Help, security, sign out | No profile edit until a protected update contract exists |

The central New Order item remains prominent even when another tab is selected, but only the current destination receives the selected label/state.

### 4.2 Secondary destinations

- **Notifications:** notification bell in primary app bars; badge uses server unread metadata.
- **Product Statement:** shortcut from Home and Account; an order may link to the relevant loaded statement record when the relationship is returned.
- **Favorites:** shortcut from Home, New Order, Account, and eligible owned order detail.
- **Wallet transaction detail:** opened from a loaded ledger row; independent deep-link refresh waits for a detail API decision.
- **Settings and Help:** opened from Account.
- **Order, estimate, statement, favorite, and transaction details:** back-stack destinations, not tabs.

### 4.3 Route hierarchy

```text
launch
├─ restore-session
├─ sign-in
└─ client-verification
   ├─ home
   │  ├─ notifications
   │  ├─ statement
   │  │  └─ statement-detail
   │  └─ favorites
   ├─ orders
   │  └─ order-detail
   ├─ new-order
   │  ├─ product-loading
   │  ├─ product-and-sku-sheet
   │  ├─ estimate-review
   │  └─ estimate-result
   ├─ wallet
   │  ├─ transaction-detail
   │  └─ fund-wallet
   └─ account
      ├─ statement
      ├─ favorites
      ├─ notifications
      ├─ settings
      └─ help
```

### 4.4 Navigation behavior

- Preserve the selected tab's stack when moving between tabs; reselecting a tab returns to its root or scrolls its root list to the top.
- A deep link always passes through session, active-client, ownership, and current-record checks before opening a destination.
- Hide the bottom bar while a SKU, estimate, confirmation, proof-upload, or other surface owns a sticky footer.
- Do not stack a bottom sheet action footer above the tab bar.
- Back closes the topmost modal or sheet first. Android system back follows the same order.
- Unsaved local draft changes require a discard confirmation only when leaving would lose client-entered data.

## 5. Core flows

### A. App launch and authentication

1. Show a branded, static launch surface while the secure session adapter restores tokens.
2. If no session exists, show Login. Never reveal prior-client cached data.
3. If a session exists, verify it and load the server-derived active client profile before entering the shell.
4. Wrong role, inactive profile, missing client record, or forbidden response leads to a blocked-access screen with sign out and approved support guidance.
5. A previously verified client may see owner-scoped cached reads while refresh runs. If verification cannot complete, those reads are visibly stale and read-only.
6. A 401 triggers the architecture's single refresh attempt. Continued failure clears the app shell and returns to sign-in without exposing another account's cache.

**Gate:** a safe mobile bootstrap/profile contract is P0.

### B. Dashboard

1. Lead with the 1688 URL action, not marketplace browsing.
2. Show only server-returned order attention, recent activity, wallet summary, unread count, and payment state.
3. Provide direct Statement and Favorites shortcuts.
4. Each module handles its own partial error; one failed summary must not replace the whole screen with an error.
5. When aggregate data is unavailable, keep navigation and New Order usable and label the affected module.

**Gate:** a bounded dashboard summary is P1; bootstrap remains P0. Do not assemble twelve full-list reads or invent counts.

### C. New Order

1. Provide one labeled URL field, explicit Paste action, 1688 guidance, and a Resolve product button.
2. Read the clipboard only after client action and platform consent where required.
3. Perform local URL-shape validation for immediate feedback; only the server decides support and product identity.
4. Keep an unsubmitted link/draft locally, owner-scoped, without treating it as a server record.

### D. Product resolution and loading

1. Reserve product image, title, price, and variant space with stable skeletons.
2. Explain that product, price, SKU, stock, and availability are being checked online.
3. Cancel obsolete requests when the link changes; deduplicate an identical in-flight request.
4. Unsupported, unavailable, manual-review, timeout, and provider failures receive different actionable messages.
5. A cached product may be viewed, but cannot proceed until the server/provider freshness requirement succeeds.

**Gate:** resolve exists; revision-safe persistence, disappeared-SKU handling, and freshness identity are P0/P1 prerequisites.

### E. Multi-SKU selection

1. Present product context and freshness at the top of a tall sheet.
2. Use image tiles when an attribute is visually meaningful; use compact chips or rows for text attributes.
3. After choosing upstream attributes, expose valid SKU combinations and per-SKU quantities.
4. A size-heavy product uses a virtualized quantity list with price, stock, and stepper on every row.
5. Show selected SKU lines, total pieces, and provider subtotal in the sticky footer. This subtotal is display data, not the authoritative order estimate.
6. Unknown stock is labeled **Stock not confirmed**, not zero. Unavailable rows remain readable but cannot increment.
7. Aggregate duplicate SKU selections locally for presentation; the server must still reject or normalize invalid duplicates.

### F. Estimate

1. Request a new server-authoritative estimate for the complete SKU selection.
2. The review sheet shows product, selected lines, total pieces, provider goods, China domestic shipping, applicable cost components, saved rate, CNY/BDT totals, wallet reservation, uncovered amount, warnings, status, and expiry.
3. Label values **Estimated** and explain that actual purchase, weight, and delivery costs may change.
4. An expired or changed result becomes read-only and offers **Get new estimate**; the app never extends or recalculates validity locally.
5. Price, stock, SKU, product, tariff, or rate drift stops the flow and displays what changed before another confirmation.

**Gate:** the canonical multi-SKU estimate, revision, expiry, and acceptance contract is P0.

### G. Confirm order

1. Confirmation is explicit and uses the reviewed estimate/revision plus the required idempotency key.
2. Disable duplicate submission while in flight.
3. An ambiguous timeout is reconciled before the client is allowed to resubmit.
4. Success shows one product submission, its SKU-line count, `pending_admin_review`, reservation coverage, uncovered amount, and next steps.
5. Failure preserves the draft and reviewed result when safe; expired/conflicting results require fresh review.

The UI never labels a newly confirmed order Purchased. Direct multi-SKU confirmation is currently atomic in one HTTP request, but the full pre-confirm estimate flow remains a P0 contract gap.

### H. Orders

1. Search and server-backed filters sit above horizontally scrollable status chips.
2. One card represents one `product_order`, with product identity, order code, summary status, dates, total pieces, compact SKU lines, and explicitly labeled financial state.
3. SKU lines retain independent status visibility when progress differs; the product card says **Mixed progress** where appropriate.
4. Cached cards may appear immediately with a last-updated/stale label while the current page refreshes.
5. Pagination and filters never mix cached pages into authoritative totals.

**Gate:** a typed, owned, paginated product-order list is P0. The existing order-card read model is useful but untyped and unpaginated.

### I. Order detail

1. Show product/source identity, product-order code, current summary, dates, freshness, and all SKU lines.
2. Use the authoritative client labels: Pending review, Confirmed, Purchasing, Purchased, Seller shipped, Received in China, Checked in China, Packed, Sent to Guangzhou, Received by shipping partner, On the way to Bangladesh, Arrived in Bangladesh, Ready for pickup, Completed, Cancelled, and Needs attention.
3. Show the event timeline, quantities, provider references when client-safe, estimated/actual/partial finances, reservation and uncovered values, historical rate, logistics, and posted refund/correction activity returned by the server.
4. Client editing is absent. Cancellation, replacement, reopen, or refund initiation appears only if a future protected response explicitly authorizes it.
5. Completed and cancelled orders remain historical and read-only.

**Gate:** owned order detail, timeline, financial provenance, and action eligibility are P0.

### J. Wallet

1. Place **Available balance (CNY)** first, followed by **Active reservations (CNY)** and **Total funds (CNY)**. An optional server-returned BDT equivalent is secondary and timestamped.
2. The only primary money action is **Fund wallet**. There is no withdrawal or credit-line UI.
3. Funding opens active server instructions, proof selection/upload, status history, and own-pending proof cancellation.
4. Transaction rows show type, timestamp, signed value, currency, and running available balance.
5. Detail retains CNY/BDT, saved rate, linked order/product, actor/reason when client-visible, original/correcting relationship, and correction totals.
6. Foreground and pre-action refresh are mandatory. Stale wallet data is read-only.

**Gate:** wallet and funding exist; the shared response schema is P0. Independent transaction-detail refresh is P1 only if separate deep linking is retained.

### K. Product Statement

1. Show server chart metrics and filters for date/month, category, status, and cost state.
2. Render mobile cards or expandable rows while retaining product link, quantities, estimated and actual CNY/BDT, logistics, total BDT, saved rate, cost state, and progress.
3. Use text labels **Actual**, **Estimated**, **Partial**, and **Mixed progress**; color is supplementary.
4. Every server page contains exactly 30 rows. The footer says, for example, **Rows 1–30 · Page 1**, with previous/next controls.
5. Detail uses the complete loaded statement row. It does not claim independent freshness or direct deep-link support until an endpoint exists.
6. The initial native experience has no export action.

**Gate:** the list exists, but exact row/chart schemas and corrected contract documentation are P0; a one-row detail read is P2.

### L. Favorites and Repeat Order

1. Favorites show historical product/variant reference, source provenance, last refresh, and Current, Refresh required, Unavailable, or manual-review state.
2. An old favorite never authorizes current price, SKU, stock, estimate, or order.
3. Repeat Order forces provider refresh and receives a new immutable revision.
4. Prior quantities are suggestions only. The client reviews current SKUs, availability, prices, and quantities.
5. A successful refresh is usable for estimate creation for 15 minutes; expiry requires another refresh.
6. Repeat Order creates new estimate/order records and never mutates the historical source.

**Gate:** Favorites list, authorized refresh, revision-safe snapshot, match states, and repeat estimate are P0 if this feature remains in MVP.

### M. Notifications

1. Load the recipient-owned inbox with unread metadata and pagination.
2. Group rows by time and distinguish unread with indicator plus text/weight.
3. Mark-read changes only after server acknowledgement; an offline tap does not silently queue.
4. Entity links pass through current authorization and ownership. Missing or no-longer-visible destinations show a neutral fallback.
5. Sensitive amounts, private URLs, and provider payloads are not placed in push or preview copy.

The in-app inbox is usable. Native push, device tokens, background delivery, permission timing, preferences, and push deep-link payloads remain undefined.

### N. Account, Settings, and Help

- **Account:** show server-returned identity, business/pickup summary, supported security/session information, secondary destinations, and sign out. Profile edit is absent.
- **Settings:** distinguish local device controls from server-backed preferences. Cache clearing may be local; notification preferences, biometric unlock, theme, and session management stay visibly unavailable until approved.
- **Help:** expose ordering, product rules, restricted products, shipping, estimates/actuals, wallet/funding, repeat ordering, and account/security guidance. Cached content shows its refresh time. Contact support has no fake destination.

**Gate:** bootstrap/profile is P0; versioned help content is P2 if not bundled; account editing and preference sync are P3 product decisions.

## 6. Screen inventory and readiness

| # | Screen | Primary purpose | Backend readiness / design gate |
| --- | --- | --- | --- |
| 1 | Login | Authenticate and recover from validation errors | Auth exists; native storage/refresh and safe bootstrap required |
| 2 | Dashboard | Start order and see bounded attention summary | P0 bootstrap; P1 aggregate summary |
| 3 | New Order | Paste and resolve one 1688 link | Resolve implemented; freshness/revision work remains |
| 4 | Product Loading | Stable online resolution state | Provider failure/freshness behavior must be contractual |
| 5 | Image-based SKU Selection Sheet | Select visual attribute combinations and quantities | P0 canonical multi-SKU quote boundary |
| 6 | Quantity-per-size SKU Selection Sheet | Enter quantities across a large size list | P0 duplicate/fresh-stock handling and quote boundary |
| 7 | Estimate Review Sheet | Review fresh estimate, reservation, uncovered balance, expiry | P0 multi-SKU estimate/acceptance |
| 8 | Estimate Result | Show confirmed product submission and pending review | P0 response must return product-order identity and replay outcome |
| 9 | Orders List | Browse owned product submissions | P0 typed/paginated list |
| 10 | Order Detail | Inspect SKU, timeline, and financial provenance | P0 owned detail contract |
| 11 | Wallet | View balances, fund, and browse ledger | Implemented; P0 DTO/document alignment |
| 12 | Wallet Transaction Detail | Inspect one loaded ledger entry | Loaded-row use possible; P1 independent read/deep link |
| 13 | Product Statement List | Filter exact 30-row server pages and chart totals | Implemented; P0 exact schemas/document correction |
| 14 | Product Statement Detail | Retain every loaded financial field on mobile | Loaded-row use possible; P2 independent refresh/deep link |
| 15 | Favorites | Browse historical saved choices and freshness | P0 list and safe refresh |
| 16 | Repeat-order SKU Sheet | Rebuild selection against fresh provider data | P0 revision-safe refresh and repeat estimate |
| 17 | Notifications | Recipient-owned in-app inbox and read state | Basic inbox implemented; push is not authorized |
| 18 | Account | Read-only client identity and secondary navigation | P0 bootstrap/profile DTO |
| 19 | Settings | Local settings and honest future capability states | Local-only initially; preference contracts remain open |
| 20 | Help | Native guidance and configured support route | Bundle approved content or add P2 versioned content |

## 7. Visual design system

### 7.1 Color tokens

| Token | Value | Use |
| --- | --- | --- |
| `canvas` | `#F7F8F5` | App background |
| `surface` | `#FFFFFF` | Cards, sheets, inputs, navigation |
| `surface-muted` | `#F0F4F1` | Quiet groups and selected neutral states |
| `foreground` | `#192320` | Primary text/icons |
| `muted` | `#53655E` | Secondary text and metadata |
| `border` | `#CFDAD4` | Dividers and control boundaries |
| `primary` | `#0A4F33` | Primary controls; white text |
| `brand-success` | `#17774E` | Brand accents and success |
| `warning` | `#946023` | Estimated, partial, expiry, attention |
| `danger` | `#A93636` | Error/destructive state |
| `info` | `#2D6398` | Neutral informational state |
| `secondary-accent` | `#B53F29` | Rare commerce emphasis, never the default CTA |

No gradient, glassmorphism, flag layout, large decorative field, or heavy shadow belongs in the client app. Borders and spacing carry most hierarchy.

### 7.2 Typography

Stitch uses Geist. Production uses the framework-neutral stack below and must test every selected font on the target platform:

```text
Geist, Inter, system-ui, -apple-system, BlinkMacSystemFont,
Segoe UI, Noto Sans Bengali, Noto Sans SC, Noto Sans, sans-serif
```

| Style | Size / line height | Weight | Use |
| --- | --- | --- | --- |
| Financial display | 32 / 40 | 600 | Available balance and decisive total |
| Page title | 24 / 32 | 600 | Root screen title |
| Section title | 20 / 28 | 600 | Major group |
| Card title | 17 / 24 | 600 | Product/order title |
| Body | 16 / 24 | 400 | Default readable copy and form values |
| Compact | 14 / 20 | 400–600 | Dense rows, labels, metadata |
| Caption | 12 / 16 | 500 | Timestamps and nonessential context |

Use tabular numerals for money, quantity, rates, dates, and running balances. Never shrink essential financial text to fit one line; wrap the label or move the value to a second row.

### 7.3 Spacing, size, and shape

- Base spacing unit: 4 logical points.
- Phone gutter: 16; compact gap: 8–12; card padding: 16; section rhythm: 24.
- Minimum target: 44 × 44; primary field/button: at least 48 high.
- Control radius: 10; card: 14; panel/modal: 18; bottom-sheet top corners: 24.
- App bar content height: 56 plus top safe area.
- Bottom navigation: 64 minimum plus bottom safe area.
- Sticky footer: content padding 12–16 plus bottom safe area.
- Use one subtle panel shadow only for overlays or sticky boundaries; routine cards use borders.

### 7.4 Icons and images

- Use one generic outlined icon family with consistent optical size; never copy a provider/payment icon.
- Every icon-only control has an accessible name and at least a 44-point target.
- Product and variant images use bounded square containers and do not determine card height after load.
- Image failure shows a neutral product placeholder, the product/variant label, and screen-reader fallback text.
- Public product images may use cache; private or signed images do not persist to disk without a later security decision.
- A selected image tile uses border, check icon, and selected text. Unavailable uses disabled semantics plus **Unavailable** text.

## 8. Component patterns

### 8.1 App bar and bottom navigation

- Root app bars use BridgeCart text wordmark, contextual title/greeting, and Notifications.
- Secondary app bars use Back, title, and at most two relevant actions.
- Badge count is capped visually (for example `99+`) while its accessible label announces the true supported value.
- Bottom destinations always keep icon and text; New Order may have elevated shape, never decorative animation.

### 8.2 Buttons, inputs, and search

- One primary action per surface. Secondary and tertiary actions must not compete by fill.
- Disabled buttons explain why in nearby text when the reason is not obvious.
- Inputs have persistent labels; placeholders are examples, not labels.
- URL input exposes Paste as a named action and never reads clipboard on focus.
- Search uses debounce/cancellation where appropriate, retains the query when returning from detail, and has a clear action.
- Validation appears next to the field with icon/text and screen-reader announcement.

### 8.3 Cards and rows

- **Product row:** square image, two-line title, provider/source metadata, variant summary, trailing value/action.
- **Order card:** product submission header, summary status, SKU-line block, pieces, cost-state label, total, last update. It never resembles a desktop table.
- **Financial card:** one dominant amount followed by separately labeled supporting amounts; currencies remain attached to values.
- **Transaction row:** type icon, title/reference, timestamp, signed amount, currency, running balance. Positive/negative signs are never communicated by color alone.
- **Statement card:** identity, pieces/progress, cost state, estimated/actual values, logistics, rate, and total; lower-priority fields may expand but are never omitted.
- **List separator:** inset one-pixel semantic border between related rows; larger spacing separates unrelated groups.

### 8.4 Badges and status

- A badge is descriptive, not interactive.
- Every badge has readable text and, where useful, an icon. Color only reinforces meaning.
- Order labels come directly from the authoritative status mapping in `docs/STATUS_MACHINE.md`.
- Financial state uses **Estimated**, **Actual**, **Partial**, and **Mixed progress** exactly.
- Freshness uses **Current**, **Refreshing**, **Stale — read only**, or **Expired** plus timestamp.
- Exception/needs-attention states use warning or danger only according to severity and always include next guidance.

### 8.5 Bottom sheet, modal, and sticky action

- SKU and estimate work uses a tall bottom sheet with drag indicator, title/context, explicit Close, scrollable body, and safe-area footer.
- A sheet may expand toward full height on small phones or with large text.
- Selection and estimate sheets hide bottom navigation.
- Keep the summary visible while the list scrolls, but never cover the focused row or keyboard.
- A modal is reserved for short confirmation, discard, or irreversible-warning decisions; it is not a replacement for a long form.
- Closing an in-flight financial/order request does not imply cancellation. Show progress or reconciliation state.

### 8.6 SKU selectors and quantity stepper

- Image selector: two or three columns depending on width; thumbnail, label, selection mark, and availability text.
- Text selector: wrapping chips for small sets; list rows for price/stock/quantity-heavy sets.
- Quantity stepper order is decrement, editable/read-only quantity value as approved, increment.
- Disable decrement at zero and increment at known stock limit; announce new quantity and validation through accessibility APIs.
- Long SKU lists virtualize, keep stable keys, and preserve entered quantities while rows recycle.
- Footer summarizes unique selected SKUs, total pieces, provider subtotal CNY, and Review estimate.

## 9. Loading, error, empty, and freshness states

| Surface | Loading | Empty | Error / stale behavior |
| --- | --- | --- | --- |
| Bootstrap | Static shell/splash | Sign-in | Forbidden/inactive/support state; no prior-owner data |
| Dashboard | Independent module skeletons | Useful New Order and shortcuts | Keep successful modules; retry failed module |
| Product | Reserved image/text/variant skeleton | Not applicable | Unsupported/unavailable/manual review/provider timeout are distinct |
| SKU list | Stable row skeletons | No purchasable SKUs | Preserve product context; disable estimate |
| Estimate | Sheet skeleton with reserved summary/footer | No selected items | Expired/conflict becomes read-only; get a new estimate |
| Orders | Card skeletons | No orders; start New Order | Cached list may remain with stale timestamp and retry |
| Wallet | Redacted number skeletons and transaction rows | No ledger entries | Stale balances are visible read-only; funding disabled |
| Statement | Metric and card skeletons | No rows for filter | Preserve filter and last good page; never merge totals |
| Favorites | Product-card skeletons | Explain save eligibility | Expired/unavailable stays historical; refresh required |
| Notifications | Inbox-row skeletons | All caught up | Failed mark-read remains unread and retryable |
| Image | Reserved aspect ratio | Neutral placeholder | Product text remains usable |

Skeletons mirror final geometry and contain no fake readable data. A skeleton pulse is subtle and disabled by reduced motion. After a reasonable delay, add explanatory text without replacing the stable skeleton.

### 9.1 Offline rules

- A persistent, nonmodal banner says **Offline · showing saved data** and includes the last successful refresh time.
- Cached lists/details remain owner-scoped, encrypted as defined by architecture, bounded, and read-only.
- Local, unsubmitted order drafts may be edited offline.
- Product resolve/refresh, estimate, confirmation, proof upload/cancel, wallet truth, notification read state, and all business mutations require connectivity.
- Mutations are never silently queued. On reconnection, invalidate relevant reads; the client chooses whether to retry.
- If a mutation outcome was ambiguous, reconcile by idempotency key/current server state before showing Retry.

## 10. Interaction rules

- Pull-to-refresh is optional convenience, never the sole refresh method. It refreshes the current server query and retains stale content until success.
- Filters apply to server queries. Show active-filter count and provide Clear all.
- Changing filters returns to page one and top of list.
- Opening detail records list scroll position, query, filters, and loaded-page context.
- Paginated lists load incrementally and do not issue every request at launch.
- Scroll-to-top appears only for genuinely long lists and does not cover sticky actions.
- Sheets preserve quantities during transient keyboard/orientation changes.
- Destructive and confirm controls are not adjacent without separation and clear labels.
- A successful server mutation updates/invalidate queries only after acknowledgement and shows concise feedback.
- Haptics, if later used, reinforce a confirmed state; they never substitute for visible or spoken feedback.

## 11. Motion rules

| Motion | Duration | Rule |
| --- | --- | --- |
| Control/state feedback | 150 ms | Color, border, selection, pressed state |
| Content transition | 200 ms | Small insert/remove or tab content fade |
| Sheet/modal | 250–300 ms | Standard platform movement with no bounce dependency |
| Skeleton | Slow subtle pulse | Disabled under reduced motion |

No autoplay carousel, decorative loop, parallax, celebratory particle effect, or motion-dependent explanation is permitted. Reduced motion replaces nonessential transitions with immediate state changes or a short opacity change.

## 12. Accessibility rules

- Meet WCAG AA contrast for text and meaningful controls; validate actual native rendering on both platforms.
- Support operating-system text scaling through at least 200% without hiding values or actions. Sheets may become full-screen and rows may stack.
- Maintain a logical screen-reader order: title, freshness/status, content, summary, action.
- Announce currencies semantically, for example “one thousand three hundred fifty Chinese yuan,” rather than relying on symbol pronunciation.
- Quantity controls include SKU/variant context in their accessible names and announce limits/errors.
- Status, selection, unread state, positive/negative transaction direction, and errors never depend on color alone.
- Icon-only controls have names; decorative images/icons are hidden from accessibility.
- Focus moves to the sheet title when opened, to the first error after failed submission, and to a meaningful result heading after success.
- Dynamic updates use polite announcements except security, expiry-at-confirmation, or destructive failures that require immediate attention.
- Touch targets are 44 points minimum with spacing that prevents accidental adjacent activation.
- English concepts reserve wrapping and vertical growth for Bangla. Do not truncate Chinese provider attributes before the complete value is available on detail/accessible text.

## 13. Responsive and device behavior

Design portrait-first for logical widths from 320 to 430 points/dp:

| Reference | Validation focus |
| --- | --- |
| 320 × 568 small Android | One-column layout, stacked financial values, full-height sheets, keyboard clearance |
| 360 × 640 common Android | Dense SKU rows, search/filter controls, bottom safe spacing |
| 390 × 844 modern reference | Canonical Stitch composition and normal text scale |
| 430 × 932 large phone | Bounded content width, no stretched stepper/cards, useful whitespace |

- Respect status-bar, cutout, Dynamic Island/notch, home-indicator, gesture, and navigation-bar insets.
- Sticky footers include `max(16, bottom safe area)` padding.
- With the keyboard open, scroll the focused control above it and keep the action reachable without covering errors.
- Avoid fixed-height text containers. At large text sizes, metadata moves below titles and amount pairs stack.
- Use two image-selector columns at narrow width or large text; use three only when labels remain readable.
- Large SKU/order/statement/wallet/notification lists virtualize and render incrementally.
- Landscape must remain operable but is not a separately optimized Phase 4 composition. Tablet layouts and split-screen treatment remain open.

## 14. Stitch design artifacts

### 14.1 Project and design system

| Artifact | Identifier | Result |
| --- | --- | --- |
| Stitch project | `projects/10119592321456026761` | **BridgeCart Client Mobile — Phase 4**, private, mobile concepts only |
| Design system | `assets/3054082193541440278` | **BridgeCart Mobile v1**, light, Geist, commerce-green, restrained surfaces |
| Generation model | `GEMINI_3_1_PRO` | Used for all concepts and correction passes |

The existing **Unified Business Commerce Client** and **Cross-Border Sourcing Hub** projects were inspected as prior exploration and were not edited. The new project retains superseded iterations for design traceability; the following 20 IDs are the canonical reviewed set. Stitch renders are 780 pixels wide, representing a 2× preview of a 390 logical-pixel mobile frame.

### 14.2 Canonical screen registry

| # | Concept | Stitch screen ID | Render | Review result |
| --- | --- | --- | --- | --- |
| 1 | Login | `466098eb364b4998b35afbdf689fed0e` | 780 × 1768 | Canonical |
| 2 | Dashboard (1688-only) | `846c86990a0a4111987fd003f08cb863` | 780 × 1768 | Corrected provider scope; canonical |
| 3 | New Order | `ebe41da29dd84448a6d01dc1dff6d430` | 780 × 2048 | Canonical |
| 4 | Product Loading | `95ae5a8774d04c7595084028ea3ea883` | 780 × 2198 | Canonical |
| 5 | Image-based SKU Selection Sheet | `15aa36c1c67743c1867b8137b3a0e502` | 780 × 1768 | Canonical |
| 6 | Quantity-per-size SKU Selection Sheet | `8031f4a168a24521914ef9789ab41b2b` | 780 × 1768 | Canonical |
| 7 | Estimate Review Sheet | `d49ede00ea624ecc8d12f75c4410c94f` | 780 × 1768 | Corrected full financial hierarchy; canonical |
| 8 | Estimate Result | `38ed0a4e33fc467e8012b3a5955e3df0` | 780 × 1888 | Canonical |
| 9 | Orders List | `3c23c33862e6433c8d41e06eba769421` | 780 × 2024 | Canonical |
| 10 | Order Detail | `3ccf2629ae7f4f6a88a08384e81c2117` | 780 × 2976 | Canonical |
| 11 | Wallet | `3feac9caafab47988f05d2ba04006c70` | 780 × 1830 | Corrected ledger terminology; canonical |
| 12 | Wallet Transaction Detail | `96419cf0c82a49f6b53ae506c51ab78a` | 780 × 2170 | Canonical |
| 13 | Product Statement List | `4cd9b540a0b24ff39605231e49c11fcd` | 780 × 2752 | Corrected 30-row paging/no export; canonical |
| 14 | Product Statement Detail | `2e07fd032c9a42c28ba9aa21eb370bae` | 780 × 1812 | Canonical |
| 15 | Favorites | `d3e89c27cfba457fae564b4266e3c79f` | 780 × 2118 | Canonical; P0-gated feature |
| 16 | Repeat-order SKU Sheet | `2d5d4e4f99254f33ad53218b6f6c2d0b` | 780 × 1768 | Canonical; P0-gated feature |
| 17 | Notifications | `83a79ce0e62945f6ba30f18d56553b2f` | 780 × 1948 | Canonical for in-app inbox only |
| 18 | Account | `1447097c76404f9bb5d6b02c19386ebc` | 780 × 1828 | Canonical |
| 19 | Settings | `420c6ba72f894df08216a37ef5da596e` | 780 × 1956 | Canonical with future controls disabled |
| 20 | Help | `a22004e747b14f3785b00a395bf0511e` | 780 × 2056 | Canonical; contact remains configuration-gated |

### 14.3 Stitch review conclusions

- The reference screenshot behavior translated well into two distinct SKU sheets: visual variants and long quantity-per-size lists.
- A fixed footer can preserve selected count, pieces, provider subtotal, and the next action without shrinking the SKU rows.
- Orders remain scannable when grouped by product submission and when SKU lines are compact rather than hidden.
- Wallet hierarchy works only after replacing the generator's invented credit-line concept with Available balance, Active reservations, and Total funds.
- Estimate review required a compact SKU summary so server-calculated BDT, wallet reservation, and uncovered balance remain visible before confirmation.
- Statement cards can retain dense financial fields, but the canonical concept required removal of an invented export action and explicit 30-row server pagination.
- Generated sample names, amounts, URLs, images, and copy are illustrative only. Production data and calculations come exclusively from protected APIs.

## 15. Architecture and implementation boundaries

- Use the Expo/React Native architecture in `MOBILE_ARCHITECTURE.md`; Stitch HTML is not a component source.
- Mobile calls the existing authenticated API boundary for all business reads and mutations. Supabase is used directly only for authentication.
- Never bundle service-role keys, OTAPI/provider credentials, repositories, server services, or authoritative financial calculators.
- Share wire schemas and framework-neutral selection helpers only after the Phase 2 package boundaries and Phase 3 contract work are approved.
- Status display text must map from canonical status values; it must not be duplicated ad hoc across screens.
- Provider normalization, SKU availability, estimate calculation, wallet totals, Statement aggregation, eligibility, authorization, and ownership stay server-authoritative.
- A Stitch screen may illustrate a P0/P1 target state; it must not be wired to inferred `unknown[]` data or route-local implementation types.
- No production feature screen begins until its P0 dependencies in `MOBILE_API_GAP_ANALYSIS.md` are satisfied.

## 16. Open design decisions

1. Approved BridgeCart logo, app icon, launch artwork, and final generic icon family.
2. Final support channels, contact destination, operating hours, escalation copy, and offline contact behavior.
3. Bangla launch timing, translation ownership, Chinese provider-attribute translation policy, and locale-specific currency/date formatting.
4. Supported phone/OS matrix, tablet posture, landscape polish level, and quantitative performance budgets.
5. Dark-mode scope; Phase 4 is light-first.
6. Push permission timing, notification categories, badge rules, preference model, and sensitive-content policy.
7. Whether wallet transaction and Statement detail require independent refresh/deep-link endpoints.
8. Whether client cancellation from `pending_admin_review` is part of production; no control exists until a protected eligibility contract is approved.
9. Refund/dispute initiation and consent workflow; current designs display only posted server outcomes.
10. Account-editable fields, session/device management, biometric policy, and server-synchronized settings.

## 17. Phase 4 acceptance boundary

Phase 4 is complete when this document and the canonical Stitch registry are reviewed, the 20 screen resources remain retrievable, and no production code or contracts have changed. Phase 5 or any mobile initialization requires separate approval.

The design must be revalidated after the P0 API contracts are finalized. Any contract-driven change updates the UX states and fields; it does not move business calculations or authorization into the client.
