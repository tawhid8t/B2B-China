# Frontend Design System

Task: `FRONTEND-F1`  
Finalized: 2026-08-27  
Scope: reusable customer-facing visual foundation

## 1. Design intent

The platform should feel like a dependable international commerce service connecting Bangladesh buyers with China marketplaces. Its interface is efficient, calm, and operationally clear.

- Deep commerce green carries brand and primary-action weight.
- Vermilion is a controlled secondary signal, not a competing half of the page.
- Muted gold is reserved for premium or logistics emphasis.
- Off-white canvas, white surfaces, charcoal text, and gray-green secondary text carry most of the interface.
- National references remain abstract. Do not use flag layouts, loud red/green splits, or decorative gradients.

The implementation uses existing React, Tailwind, and Lucide dependencies. No font or component dependency was added.

## 2. Typography

Use the `font-sans` stack:

```text
Geist, Inter, ui-sans-serif, system-ui, -apple-system,
BlinkMacSystemFont, Segoe UI, Noto Sans Bengali,
Noto Sans SC, Noto Sans, sans-serif
```

Geist or Inter is used when already available on the device. System and Noto fallbacks preserve Bangla, Chinese, and English coverage without a large download.

Usage rules:

- Body copy: `text-sm` or `text-base`, normal weight, `leading-6` or greater.
- Labels: `text-sm font-semibold`.
- Page title: `text-2xl sm:text-3xl font-semibold tracking-tight`.
- Major commerce total: `text-3xl font-semibold tabular-nums`.
- Eyebrow: `text-xs font-bold uppercase tracking-[0.12em]`.
- Do not use uppercase for sentences, Chinese, or Bangla content.
- Use tabular numerals for prices, quantities, and operational totals.

## 3. Tokens

Tokens are defined in `tailwind.config.ts` and `app/globals.css`. Use semantic tokens for page structure; use named brand scales only where the semantic purpose is clear.

### 3.1 Semantic colors

| Token | Value | Usage |
| --- | --- | --- |
| `canvas` | `rgb(247 248 245)` | App/page background. |
| `surface` | `rgb(255 255 255)` | Cards, sheets, inputs, navigation. |
| `surface-muted` | `rgb(240 244 241)` | Quiet panels, selected-control backgrounds. |
| `foreground` | `rgb(25 35 32)` | Primary text and icons. |
| `muted` | `rgb(83 101 94)` | Secondary copy, metadata, placeholders. |
| `border` | `rgb(207 218 212)` | Standard borders and dividers. |
| `success` | `#17774e` | Successful outcomes. |
| `warning` | `#946023` | Attention that is not destructive. |
| `danger` | `#a93636` | Errors and destructive actions. |
| `info` | `#2d6398` | Neutral informational status. |

Legacy `paper`, `ink`, `line`, `jade`, `coral`, and `saffron` aliases remain temporarily so current pages keep rendering. New customer-facing work uses the semantic and brand-scale names.

### 3.2 Commerce green

| Token | Value | Typical usage |
| --- | --- | --- |
| `commerce-50` | `#f0f8f4` | Subtle brand background. |
| `commerce-100` | `#dcefe5` | Selected state/badge. |
| `commerce-200` | `#b6dac5` | Decorative border only. |
| `commerce-300` | `#85be9d` | Hovered neutral border. |
| `commerce-400` | `#4a9a6f` | Supporting visual. |
| `commerce-500` | `#17774e` | Brand icon/accent. |
| `commerce-600` | `#0e623f` | Strong accent. |
| `commerce-700` | `#0a4f33` | Default primary action. |
| `commerce-800` | `#0b402c` | Primary hover/strong text. |
| `commerce-900` | `#093425` | Primary active/deep surface. |
| `commerce-950` | `#031f15` | Rare maximum contrast. |

White text belongs on `commerce-700` or darker for normal-sized controls.

### 3.3 Vermilion

The `vermilion-50` through `vermilion-900` scale is a secondary commerce accent. Prefer `vermilion-600` for icons/accents and `vermilion-700` or darker for small text. Do not use it for every CTA, large page fields, or routine success states.

Core values:

```text
50 #fff4f1   100 #ffe5de  200 #ffcabe  300 #f89f8b
400 #e96f55  500 #cf5137  600 #b53f29  700 #933421
800 #792f23  900 #652b22
```

### 3.4 Muted gold

The `gold-50` through `gold-900` scale identifies premium/logistics emphasis and selected contextual information. It is not a replacement for warning yellow.

Core values:

```text
50 #fbf8ed   100 #f4edcf  200 #eadb9c  300 #ddc263
400 #c9a33a  500 #ad7c2b  600 #946023  700 #77471f
800 #633b20  900 #54331f
```

### 3.5 Background and text rules

- Page: `bg-canvas text-foreground`.
- Standard section/card: `bg-surface`.
- Quiet grouping: `bg-surface-muted`.
- Secondary text: `text-muted`; do not lower opacity further for essential information.
- Primary brand link or icon: `text-commerce-700`.
- Do not use color alone to communicate selection, status, or errors.

### 3.6 Borders

- Default: `border border-border`.
- Hoverable neutral control: hover toward `commerce-300`.
- Error: `border-danger` plus text explanation and `aria-invalid`.
- Avoid multiple nested borders when spacing alone can express grouping.

### 3.7 Radius

| Token | Value | Usage |
| --- | --- | --- |
| `rounded-control` | `0.625rem` | Inputs, buttons, tabs, compact controls. |
| `rounded-card` | `0.875rem` | Cards and state panels. |
| `rounded-panel` | `1.125rem` | Modal and major grouped surfaces. |
| `rounded-sheet` | `1.5rem` | Mobile bottom-sheet top corners. |
| `rounded-full` | full | Badges, avatars, small indicators only. |

### 3.8 Spacing

Tailwind's standard spacing scale remains the base. The normalized layout variables are:

| Token/utility | Mobile | `sm` | `lg` | Usage |
| --- | --- | --- | --- | --- |
| `--page-gutter` | `1rem` | `1.5rem` | `2rem` | Horizontal page padding. |
| `--section-space` | `3.5rem` | `4.5rem` | `6rem` | Public-page section rhythm. |
| `content-shell` | max `80rem` | same | same | Centered commerce page wrapper. |
| `safe-area-bottom` | `max(1rem, env(safe-area-inset-bottom))` | same | same | Sticky action/sheet footer. |
| `safe-area-top` | safe-area inset | same | same | Full-height mobile navigation. |

Recommended component padding:

- Compact control group: `p-3` or `p-4`.
- Card: `p-5 sm:p-6`.
- Major panel/sheet body: `px-5 sm:px-6`.
- Keep at least `gap-3` between adjacent actions.

### 3.9 Shadows

| Token | Usage |
| --- | --- |
| `shadow-soft` | Default cards and quiet elevation. |
| `shadow-panel` | Sticky summaries and prominent panels. |
| `shadow-overlay` | Modal/drawer top layer only. |

Borders should carry most surface separation. Do not place a heavy shadow on every card.

### 3.10 Focus

All interactive elements receive a visible `2px` commerce-green outline with a `3px` offset through the global rule or `focus-ring` utility.

- Never remove the focus indicator without an equal or stronger replacement.
- Error borders do not replace focus.
- Focus must remain visible against canvas, surface, and dark primary controls.

### 3.11 Motion and transitions

| Token | Value | Usage |
| --- | --- | --- |
| `duration-fast` | `150ms` | Hover/color response. |
| `duration-base` | `200ms` | Control/state changes. |
| `duration-slow` | `300ms` | Large surface movement only. |
| `ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Standard UI motion. |

`prefers-reduced-motion: reduce` disables nonessential animation and smooth scrolling. Avoid decorative animation loops.

### 3.12 Content widths and layers

| Token | Value | Usage |
| --- | --- | --- |
| `max-w-commerce` | `80rem` | Main commerce layout. |
| `max-w-reading` | `46rem` | Prose and descriptions. |
| `max-w-form` | `36rem` | Auth and narrow forms. |
| `z-navigation` | `40` | Fixed navigation. |
| `z-overlay` | `50` | Backdrop-level surfaces. |
| `z-modal` | `60` | Modal/drawer dialog. |
| `z-toast` | `70` | Future transient announcements. |

## 4. Breakpoints

Tailwind defaults are retained:

- Base `<640px`: primary one-handed mobile design.
- `sm >=640px`: wide phone/small tablet refinement.
- `md >=768px`: tablet columns where useful.
- `lg >=1024px`: desktop navigation and product-detail layout.
- `xl >=1280px`: content refinement only.

Essential information and actions must never depend on a desktop breakpoint.

## 5. Primitive usage

Primitives live in `components/ui` and can be imported from `@/components/ui`.

### 5.1 Button

Variants: `primary`, `secondary`, `outline`, `ghost`, `danger`. Sizes: `sm`, `md`, `lg`, `icon`.

```tsx
<Button loading={submitting}>Request estimate</Button>
<Button variant="outline">Back</Button>
<Button variant="danger">Reject estimate</Button>
```

- Buttons perform actions; navigation uses links.
- Icon-only buttons require an `aria-label`.
- Loading disables repeat submission and preserves the visible label.
- Default tap target is at least 44px; `lg` is 48px.
- `buttonClasses` may style a clear CTA link, but it remains an anchor semantically.

### 5.2 Input and Textarea

```tsx
<Input label="Supplier link" required error={error} hint="1688, Taobao, or Tmall" />
<Textarea label="Note" maxLength={2000} />
```

Labels, hints, and errors are programmatically connected. Use the provided `error` prop instead of a disconnected red paragraph. Keep mobile text at 16px to avoid unwanted input zoom.

### 5.3 Card

Use `Card`, `CardHeader`, `CardContent`, and `CardFooter`. A card groups one coherent subject; it is not automatically clickable. If an entire card navigates, use one semantic link with a visible focus state and avoid nested controls.

### 5.4 Badge

Badges are compact labels. Available variants: `neutral`, `commerce`, `vermilion`, `gold`, `info`, `success`, `warning`, and `danger`.

Do not use a badge as a button. Do not communicate status only through its color.

### 5.5 Alert

Use `info`, `success`, `warning`, or `danger`. Danger alerts default to `role="alert"`; other variants use polite status semantics. Alerts explain a state and recovery, not merely decorate a card.

### 5.6 Skeleton and LoadingState

- `Skeleton` is visual and hidden from assistive technology.
- `LoadingState` supplies the announced loading label.
- Match skeleton dimensions to final content to reduce layout shift.
- Never replace a failed API response with a skeleton or mock result.

### 5.7 Modal

`Modal` uses the browser's native modal dialog behavior, supports Escape, backdrop dismissal, focus handling, labelled title/description, a scrollable body, and an optional safe-area footer.

Use for short confirmations or focused tasks. Do not use for long mobile SKU selection.

### 5.8 Drawer and BottomSheet

`BottomSheet` is the default mobile SKU pattern. `Drawer side="right"` is available for desktop secondary tasks.

```tsx
<BottomSheet
  open={open}
  onOpenChange={setOpen}
  title="Choose variant"
  footer={<Button className="w-full">Request estimate</Button>}
>
  {/* Long, scrollable SKU list */}
</BottomSheet>
```

- The body scrolls independently while header and action footer remain visible.
- Height uses `100dvh` so the mobile keyboard does not cover the critical footer.
- The footer applies bottom safe-area spacing.
- Keep selected price and quantity summary in the footer when the SKU list is long.
- Escape/backdrop close must not discard a submitted server action; pending actions should disable dismissal at the feature layer if required.

### 5.9 Tabs

`Tabs` is controlled and includes its active panel. It implements tab roles and Arrow, Home, and End keyboard behavior.

- Use tabs for peer views, not ordered workflow steps.
- Keep labels short; the mobile tab list may scroll horizontally inside its own boundary.
- Do not hide required estimate information behind a tab.

### 5.10 QuantityStepper

`QuantityStepper` is controlled and clamps changes to `min`/`max`.

```tsx
<QuantityStepper value={quantity} onChange={setQuantity} min={1} max={availableQuantity} />
```

The feature owns SKU availability and validation. The primitive only changes the provided quantity; it performs no pricing or business calculations.

### 5.11 PriceDisplay

`PriceDisplay` supports only `BDT` and `CNY`, uses `Intl.NumberFormat`, and displays tabular numerals.

```tsx
<PriceDisplay value={estimate.totalBdt} currency="BDT" size="xl" showCode />
```

It formats a server-returned value only. Never use it to convert currencies, calculate totals, round business values, or infer missing prices.

### 5.12 StatusBadge

`StatusBadge` accepts the canonical `OrderStatus` type and maps every existing order status to a readable client label. Do not expose raw underscored enums. Do not add a status in this component before the protected domain type exists.

### 5.13 PageHeader

Use one `PageHeader` per route-level screen. The title is a semantic `h1`; optional eyebrow and description establish context. Actions stack on mobile and align right on larger screens.

### 5.14 EmptyState, ErrorState, LoadingState

- `EmptyState`: a valid no-content condition, never an authorization or API failure.
- `ErrorState`: a failed operation with a concrete recovery action where possible.
- `LoadingState`: a pending operation with a specific label.

State components accept an action slot so the feature owns retry/navigation behavior.

## 6. Mobile composition rules

1. Design the base layout before adding breakpoint overrides.
2. Use full-width primary actions for critical one-handed flows when space is tight.
3. Keep tap targets at least 44px and avoid adjacent destructive/confirm actions without spacing.
4. Use `content-shell` for page gutters and `safe-area-bottom` for fixed action containers.
5. Only one fixed bottom layer may be present: page navigation or a flow action bar, never both.
6. Bottom-sheet header and footer remain fixed while long SKU content scrolls.
7. Selected quantity and price remain visible in the sheet footer.
8. Use `min-w-0`, wrapping, and contained scrolling to prevent page-level horizontal overflow.
9. Test with the on-screen keyboard open; use dynamic viewport height for sheets and drawers.

## 7. Desktop composition rules

- Center pages within `max-w-commerce`; do not stretch content edge-to-edge.
- Use `max-w-reading` for long explanatory copy and `max-w-form` for auth/form layouts.
- Desktop may introduce sidebars and sticky purchase summaries at `lg`.
- Retain the same information order and action language used on mobile.
- Increase whitespace before adding decoration.

## 8. Accessibility requirements

- Use semantic landmarks, headings, labels, lists, tables, buttons, and links.
- Maintain the global visible focus indicator.
- Every icon-only action has an accessible name.
- Inputs expose `aria-invalid` and connected hint/error text.
- Async changes use polite status announcements; blocking failures use alerts.
- Modal and sheet titles are programmatically associated with native dialogs.
- Color is never the only status signal.
- Preserve contrast by using the specified foreground/background pairings.
- Support keyboard navigation, 200% zoom, content wrapping, and reduced motion.
- Buttons are actions; links navigate.

## 9. Implementation boundaries

These components own presentation and local interaction mechanics only. They do not own:

- API requests or response envelopes;
- authentication/authorization;
- SKU availability rules beyond an explicitly passed `max`;
- estimate, currency, wallet, shipping, or profit calculations;
- order/status transitions;
- persistence or optimistic success claims.

Feature components remain responsible for passing server-returned values, API state, labels, and actions into the primitives.

## 10. Adoption guidance

F1 does not redesign existing pages. Upcoming customer-facing work should adopt these primitives incrementally:

1. use semantic tokens and `content-shell`;
2. replace one-off fields/actions with `Input`, `Textarea`, and `Button`;
3. use `BottomSheet`, `QuantityStepper`, and `PriceDisplay` in the product flow;
4. use `Alert` and state primitives for API outcomes;
5. use `StatusBadge` only for real server-returned order status;
6. remove legacy aliases after all old pages have migrated.

Do not create mock pages or change protected business behavior to demonstrate the design system.
