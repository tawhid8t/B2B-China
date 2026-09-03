# BridgeCart client mobile reference pack v1

## Purpose

This directory is the persistent, non-public visual reference for the responsive
client web application. It prevents the source screenshots from having to be
uploaded or rediscovered during each UI task.

The files in `originals/` are immutable copies of the locally saved **Premium
Dark Accent Commerce** set. The files in `screens/` are reproducible crops made
from the multi-screen boards. Single-screen originals are referenced directly
and are not duplicated.

Nothing in this directory is shipped through `public/`.

## Authority rules

1. Business rules, API responses, authorization, database state, calculations,
   and supported workflows remain authoritative over all sample screenshot data.
2. Screenshots govern visual hierarchy and composition only after their
   `authorityStatus` is approved in `manifest.json`.
3. Product names, images, dates, amounts, counts, charts, order statuses, and
   contact details shown in references are illustrative.
4. Simulated device frames, iOS status bars, and home indicators are reference
   chrome. They must not be implemented in the responsive web application.
5. The standalone Dashboard, Orders, and Wallet images are proposed as the
   primary high-resolution compositions. The smaller board variants remain
   secondary candidates until the duplicate-screen authority review is approved.
6. A reference with an absent or incomplete product route does not authorize a
   new workflow, route, API, or placeholder business behavior.

## Structure

```text
v1/
  originals/          Immutable normalized copies of the eight source files
  screens/            Generated individual crops from composite boards
  generate-crops.ps1  Reproducible crop and integrity verification script
  manifest.json       Source hashes, screen registry, routes, states, and notes
  README.md            Reference-pack policy and usage
```

## Stable screen IDs

Future UI work should refer to `screenId` values from `manifest.json`, for
example `dashboard-mobile-standalone`, `sku-selection-sheet-mobile`, or
`notifications-mobile`. Agents should inspect only the relevant registered
asset and its manifest entry.

## Verification and crop regeneration

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\design\reference\client-mobile\v1\generate-crops.ps1
powershell -ExecutionPolicy Bypass -File .\design\reference\client-mobile\v1\generate-crops.ps1 -VerifyOnly
```

The script validates every original's SHA-256 hash and pixel dimensions before
generating crops. It refuses paths outside this reference-pack directory and
validates every crop rectangle against its source image.

## Remaining design-lock decisions

- Confirm which overlapping Dashboard, Orders, and Wallet composition is
  primary.
- Calibrate the browser reference viewport for the 853 x 1844 standalone images.
  The current `430x932-candidate` value is intentionally marked unapproved.
- Decide the exact browser font family during the token-extraction phase.
- Decide whether later normalized crops should remove reference OS/device chrome
  or use masks during visual comparison.

