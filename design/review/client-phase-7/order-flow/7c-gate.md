# Subphase 7C Gate — Product, Color, Size, and Quantity Selection

Status: `awaiting_owner_approval`

Implemented:

- Real product title, Chinese title, gallery, provider, category, supplier price range, and domestic delivery presentation.
- Attribute images used for visual color options when supplied by the provider.
- Human-readable provider attributes retained from the normalized SKU contract.
- Impossible and out-of-stock combinations remain visible and disabled.
- Single-SKU products without color or size attributes can now be selected and quantified.
- Multi-SKU quantities remain independent while selected combinations stay visible during further filtering.
- Phone bottom sheet with product context, touch-friendly SKU cards, price, stock, unavailable states, quantity controls, and fixed selection footer.
- Sticky phone summary exposes selected SKU count, pieces, subtotal, and Review estimate action.
- Tablet and desktop retain inline controls and the scalable SKU table.
- Large lists remain incrementally rendered in groups of 50, up to the normalized provider limit.
- Product selection layouts no longer create page-level horizontal overflow on 320 px or 430 px phones.

Deterministic scenarios:

- Single SKU with no attributes
- Multiple colors and sizes
- Out-of-stock and impossible combinations
- Long English and Chinese titles
- 120-SKU large-list fixture
- Independent quantities across multiple SKUs

Review captures:

- `design/review/client-phase-7/new-order/captures/7c-selection-sheet-mobile-430.png`
- `design/review/client-phase-7/new-order/captures/7c-selection-mobile-430.png`
- `design/review/client-phase-7/new-order/captures/7c-selection-tablet-768.png`
- `design/review/client-phase-7/new-order/captures/7c-selection-desktop-1440.png`

Subphase 7D has not started.
