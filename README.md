# ميزان — Mizan

**Offline-first system for a phone store: e-wallet cashier, BASATA balance distribution, inventory/POS, and daily cash control — with one unified money ledger so nothing gets lost.**

عربي · English

---

## Why one ledger?

Every movement of value (a wallet transfer, a fee, a BASATA load, a drawer count) is recorded
as **balanced double-entry postings** across named accounts. Balances are never typed in —
they are *derived*. Any shortage therefore shows up as a gap between what the ledger says and
what was counted, instead of silently disappearing.

- All amounts are **integer piastres** (1 EGP = 100 piastres) — no floating-point drift.
- Entries are **append-only**; corrections are reversal entries, history is never edited.
- Every entry is validated: `Σ debits = Σ credits > 0` before it can be saved or synced.

## Status

| Step | Module | Status |
|------|--------|--------|
| 0 | Foundation: ledger core, sync engine, auth, AR/EN RTL shell | ✅ done |
| 1 | E-wallet cashier (send/receive/deposit/withdraw, fees, float ledgers) + opening balances | ✅ done |
| 2 | BASATA distributor credit accounts (load = debt, collections, statements) | ⬜ next |
| 3 | Inventory + retail POS | ⬜ |
| 4 | Cash register / Z-read + reconciliation reports | ⬜ |
| 5 | Mobile app (Expo) with the same sync | ⬜ |
| 6 | Hardening: backups, audit log, deployment | ⬜ |

## Architecture

```
mizan/
├── packages/core        @mizan/core — pure ledger domain (money, accounts, entries,
│                        wallet ops, sync protocol) + 36 unit tests
├── apps/server          Fastify + Postgres (PGlite) — auth (scrypt+JWT) and the
│                        append-only event sync API (push/pull, idempotent by UUID)
└── apps/web             Vite + React + Tailwind + Dexie (IndexedDB) PWA —
                         works fully offline, syncs when online
```

**Sync model:** each device keeps a local SQLite-class database (IndexedDB). New entries are
queued as unsynced events; on connectivity they are pushed (server dedupes by event UUID) and
pulled by cursor (`seq`). Because money events are immutable, offline devices merge by plain
union — no conflicts, no lost entries.

## Quick start

```bash
pnpm install

# terminal 1 — sync server (data lands in apps/server/data/)
pnpm --filter @mizan/server dev

# terminal 2 — web app
pnpm --filter @mizan/web dev
```

Open http://localhost:5173 — the first account you create becomes the owner account.

Optional configuration: see `apps/server/.env.example` and `apps/web/.env.example`.

## Commands

```bash
pnpm test          # unit tests (ledger invariants, money math, sync validation)
pnpm typecheck     # strict TypeScript across all packages
pnpm build         # production build (web emits a PWA with offline service worker)
```

## Data & backup

The server stores everything in **one Postgres data directory**
(`apps/server/data` by default, or `MIZAN_DATA_DIR`). Back it up by copying that folder
while the server is stopped, or with `pg_dump`-style tooling after the PGlite → full Postgres
migration. The web app additionally holds an offline copy on each device and can rebuild its
state from the server at any time (clear site data → login → full resync).

## Notes

- UI is Arabic-first (RTL) with a full English toggle.
- EPG amounts display via `Intl` with the `EGP` currency for the active language.
- The web app installs as a PWA (Android/iOS/desktop) and keeps working with no internet;
  the sync chip in the header always shows pending/online state.
