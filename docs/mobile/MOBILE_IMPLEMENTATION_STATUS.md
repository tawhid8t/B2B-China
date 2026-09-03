# Mobile Implementation Status

## Phase 6 — Client Mobile Authentication and Persistent Session

**Status:** Implemented locally; live Supabase and physical-device verification remain pending.

### Delivered

- Password sign-in using the public Supabase project URL/publishable key; no registration, password recovery, social login, or staff/admin mobile UI.
- Cold-launch session restoration, proactive expiry refresh, one refresh-and-retry after a bootstrap `401`, foreground revalidation, and active-only automatic refresh.
- Two-slot, versioned SecureStore session persistence with 1,800-byte chunks, SHA-256 integrity manifests, `WHEN_UNLOCKED` access, and no biometric prompt or plaintext fallback.
- Additive `GET /api/client/bootstrap` boundary that accepts only an active `client` role, derives identity from the bearer session, retains RLS, and returns a minimal shared profile/client DTO.
- Expo Router protected groups for startup/recovery, signed-out, and server-verified client states.
- BridgeCart login form with Zod/React Hook Form validation, secure password entry, loading, invalid-credential, network, forbidden-role, configuration, and recoverable offline states.
- Device-local logout with secure-session and user-scoped Query cleanup; the Account placeholder now shows verified identity and the logout control only.
- No dashboard or other business feature implementation.

### Dependencies added

- `react-hook-form` and `@hookform/resolvers` for the architecture-approved form state/validation boundary.
- The existing `@bridgecart/contracts` workspace is now consumed by mobile for the client bootstrap DTO.

### Validation

- Focused mobile auth/session, route-guard, login-screen/schema, logout/lifecycle, and SecureStore tests — passed.
- Focused server bootstrap authorization/contract tests — passed: 2 tests.
- `npm run mobile:typecheck` — passed.
- `npm run mobile:lint` — passed with no warnings.
- `npm run mobile:test` — passed: 9 suites / 28 tests.
- `npm run typecheck` — passed.
- `npm run lint` — passed with one pre-existing `@next/next/no-img-element` warning in `components/client/client-product-statement.tsx`.
- `npm test` — passed: 166 tests. Existing Node module-type warnings remain.

### Known limitations

- SecureStore/Keychain/Keystore persistence, background transitions, and reinstall behavior require physical Android/iOS development builds; Windows cannot run the iOS Simulator.
- Live Supabase credentials, deployed RLS/migrations, real inactive/non-client accounts, and production network behavior are not verified by local mocked/static tests.
- Password recovery/deep links and global/all-device session revocation are outside Phase 6. Logout affects this mobile session only.
- `npm audit --omit=dev` reports 17 transitive findings (14 moderate, 3 high) in the existing Expo Router/Next.js dependency trees; the suggested remediations require breaking framework downgrades/upgrades and were not applied in this scoped phase.

---

## Phase 5 — Mobile Application Foundation

**Status:** Complete; superseded by the Phase 6 authentication layer above.

### Delivered

- Expo SDK 57 / Expo Router app at `mobile/` with strict TypeScript and managed/CNG configuration.
- Root npm workspace overlay with reserved React-free `packages/contracts` and `packages/domain` packages.
- Development, preview, and production environment pattern; public `.env.example`; no identifiers, EAS project ID, or credentials guessed or committed.
- Safe-area-aware startup, Login placeholder, and five-tab authenticated-shell preview.
- Premium Dark Accent Commerce tokens, system/SF-Pro-style typography mapping, core Screen/Text/Button/Card primitives, error boundary, loading-safe shell, connectivity provider, query client, secure-storage interface, redacting logger, and typed API envelope parser.
- Jest, Expo lint, strict typecheck, mobile README, and unit coverage for configuration, API envelopes, and log redaction.

### Dependencies

- Expo Router, Expo development client, SecureStore, Crypto, AsyncStorage, NetInfo, TanStack Query/persistence, Supabase client with URL polyfill, Zod, Jest Expo, React Native Testing Library, ESLint, and Expo ESLint configuration.
- No notifications, image cache, Sentry, Redux, WebView, finance engine, server credentials, or business APIs were added.

### Validation

- `npm run typecheck` — passed (existing web application remains isolated from mobile sources).
- `npm run lint` — passed with one pre-existing web warning for `components/client/client-product-statement.tsx` using a plain `<img>`; mobile files are ignored by the web configuration.
- `npm test` — passed: 164 existing web tests.
- `npm run mobile:typecheck` — passed.
- `npm run mobile:lint` — passed.
- `npm run mobile:test` — passed: 3 suites / 5 tests (runtime environment validation, API envelope parsing, log redaction).
- `npm run mobile:doctor` — passed: 21/21 Expo checks. The mobile workspace intentionally shares React 19.2.8 with the existing web workspace; Expo Doctor excludes those semver-compatible patch versions to avoid duplicate native React installations.
- `npx expo export --platform android --output-dir .expo-validation/android` — passed. This validates Android JavaScript bundling and Expo Router configuration without a credentialed build.

### Historical limitations / next decisions

- Canonical multi-SKU quote, typed order list/detail, wallet/statement DTO alignment, and Favorites/Repeat Order remain blocked by documented P0 contracts.
- Windows supports Android tooling and EAS cloud builds; iOS Simulator/Xcode validation requires macOS. Production builds also need owner-supplied bundle identifiers, EAS project configuration, and store accounts.
- Premium Dark Accent Commerce was approved through the standalone visual review pack; it supersedes the older light Stitch visual direction for future mobile work.
