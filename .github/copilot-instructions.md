# Copilot instructions for CASHY

## Project overview

This repo is a Vite + React + TypeScript SPA for a local-only personal bookkeeping app for Vodafone Cash accounts in Egypt. It is Arabic-first, RTL, and browser-only: no backend, no auth, and no external financial service integrations. Data lives in IndexedDB via Dexie, so persistence is local to the current browser/device.

## Build, test, and validation commands

Use the repo scripts in `package.json`:

```bash
pnpm install
pnpm dev                # start the Vite dev server
pnpm build              # production build to dist/
pnpm preview            # preview the production build
pnpm typecheck          # strict TypeScript check
pnpm test               # run the Vitest suite
```

For a single test file or a targeted test:

```bash
pnpm vitest run src/accounting/accounting.test.ts
pnpm vitest run src/validation/phone.test.ts
pnpm vitest run src/accounting/accounting.test.ts -t "monthly limit"
```

There is no `lint` script in this repository. The main validation path is `pnpm typecheck` plus `pnpm test`.

## High-level architecture

- `src/App.tsx` is the app bootstrap: it sets up the router, the demo-mode banner, and the app shell. It also triggers first-run demo seeding.
- `src/services/db.ts` defines the Dexie database schema and the low-level read helpers for accounts and operations. `src/services/seed.ts` creates the demo ledger; other files in `src/services/` handle settings/profile persistence.
- `src/hooks/useData.ts` is the integration layer between IndexedDB and the accounting domain. This is where live queries are composed and accounting results are computed before being passed to UI components.
- `src/accounting/` is the core business logic: totals, deficit calculations, account balances, and per-account monthly limits. These functions are pure and should not import React or browser APIs.
- `src/pages/` contains route-level screens (dashboard, accounts, history, add operation, summary, deficit, settings).
- `src/components/` holds reusable display components; keep them presentation-focused and avoid embedding account math or business logic there.
- `src/validation/` contains the rules for Egyptian mobile numbers, money parsing, and form validation; tests live beside the validators.
- `src/styles/tokens.css` defines the design system and theme tokens used across the app.

The important project rule is: accounting math belongs in `src/accounting/`, not in components.

## Key conventions specific to this codebase

- Money is stored as integer piastres, not floating-point numbers. Treat values as whole numbers (for example, 1 EGP = 100 piastres).
- Timestamps are stored as UTC ISO strings and displayed in the device local timezone.
- Relations should use stable IDs; do not use phone numbers as the primary identifier for accounts or operations.
- `فلوس` (cash) is a special category: it does not change wallet balances, but it is still included in the deficit calculation and reporting.
- Opening balances are editable inputs; changing an opening balance updates the derived balance without rewriting historical operations.
- The app is intentionally append-only in v1 for operations. Do not introduce mutation/deletion flows unless the relevant design or README explicitly calls for them.
- Use Dexie `useLiveQuery` for live data binding instead of ad hoc local state or custom manual subscriptions.
- The product is Arabic-first and RTL. Keep UI behavior and wording aligned with the app’s existing locale and responsive patterns.
- Demo mode is a real feature: first-time visits auto-seed clearly marked fake data, and the banner/reseed behavior is intentionally visible and safe.
- Keep the app client-only; do not add backend APIs or storage services without a clear design requirement.

## Working style in this repo

- Prefer the existing `src/accounting/` APIs and validation utilities instead of introducing new parallel logic.
- If a change affects money math, update the matching tests in `src/accounting/` or `src/validation/`.
- Keep UI changes consistent with the existing RTL/mobile-first layout, especially on the account and history flows.
- Respect the local-only nature of the application: no network calls, no server-side state, and no persistence outside the browser.
