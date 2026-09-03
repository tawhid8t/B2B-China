# BridgeCart client mobile

This directory contains the Expo React Native foundation and Phase 6 client authentication for BridgeCart. Product ordering, estimates, orders, wallet, Favorites, and dashboard data remain intentionally unimplemented.

## Commands

Run commands from the repository root:

```bash
npm run mobile:start
npm run mobile:typecheck
npm run mobile:lint
npm run mobile:test
npm run mobile:doctor
```

For Android development, configure Android Studio/JDK and run `npm --workspace @bridgecart/mobile run android`. iOS Simulator builds require macOS; use EAS development builds after approved identifiers and credentials are supplied.

## Environment

Copy `.env.example` to `.env.local`. Public values only are allowed. Set the existing backend `/api/` base URL, Supabase project URL, and publishable key. Authentication displays a configuration error until all three values are present.

Never place service-role keys, OTAPI/provider credentials, signing secrets, or private server values in Expo public variables or app source.

## Foundation boundaries

- Expo Router owns route structure and prevents entry to client tabs until the backend verifies an active client account.
- Supabase is used directly only for authentication. The bearer-authenticated backend remains the boundary for profile verification and all future business data.
- Supabase sessions use chunked Expo SecureStore persistence; ordinary AsyncStorage is never used for tokens.
- `packages/contracts` contains the minimal client-bootstrap DTO. `packages/domain` remains reserved for approved framework-neutral domain code.
