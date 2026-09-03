# BridgeCart client design-system candidate v1

This directory contains the Phase 2 design-lock candidate derived from the
Premium Dark Accent Commerce reference pack. It is evidence and specification,
not production styling.

Files:

- `tokens.candidate.json` is the machine-readable candidate token set.
- `REFERENCE_MEASUREMENTS.md` records raster measurements and comparison limits.
- `DESIGN_LOCK_REPORT.md` records recommendations, conflicts, and approval gates.
- `typography-review.html` is the reproducible four-family comparison fixture.
- `typography-comparison.png` is the rendered Phase 2 comparison evidence.

The application continues to use `app/globals.css`, `tailwind.config.ts`, and
`app/fonts.ts` until this candidate is explicitly approved and migrated in a
later phase.

In development, open `/design-system/client` to inspect the deterministic
gallery. The route returns a production 404 and is never an authenticated client
workflow.
