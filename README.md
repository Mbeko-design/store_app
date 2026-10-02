# CASHY

> دفتر محاسبة شخصي لحسابات فيودافون كاش — **CASHY** is a responsive, Arabic-first (RTL) personal
> bookkeeping web app for tracking multiple Vodafone Cash accounts in Egypt.
>
> **It is NOT a banking app.** CASHY never connects to Vodafone, never executes real transactions,
> and never claims to. It is a local ledger you fill in manually.

---

## How to run

```bash
pnpm install        # install dependencies
pnpm dev            # start dev server → http://localhost:5173
```

Other commands:

```bash
pnpm test           # unit tests (accounting + validation) — vitest
pnpm typecheck      # TypeScript, strict
pnpm build          # production build → dist/   (npm run build works too)
pnpm preview        # serve the production build
pnpm icons          # regenerate the PWA icons (scripts/gen-icons.mjs, zero deps)
```

Requirements: Node ≥ 20, pnpm. No backend, no database server — data lives in the browser
(IndexedDB).

---

## Screens

| # | Screen | Route | Notes |
|---|--------|-------|-------|
| 1 | لوحة التحكم (Dashboard) | `/` | summary cards, deficit meter card, accounts, recent ops, donut overview, quick actions |
| 2 | الحسابات (Accounts) | `/accounts` | account grid, add/edit, archive (confirm dialog), restore, empty state |
| 3 | تفاصيل الحساب (Account details) | `/accounts/:id` | balance, remaining limit, category buttons, tabs (ملخص/سحب/إيداع/فلوس) |
| 4 | سجل العمليات (Category history) | `/history/:category` | big total, filters (date range/account/type), table on desktop, list on mobile, pagination |
| 5 | إضافة عملية (Add operation) | `/add` | يدوي/تلقائي segmented control, type toggle, source, amount, date-time, note |
| 6 | ملخص الحسابات (Summary table) | `/summary` | totals + detailed table with expandable rows + pagination |
| 7 | مقياس العجز (Deficit meter) | `/deficit` | equation, progress bar, itemized inputs, auditable result line |
| 8 | الإعدادات (Settings) | `/settings` | profile, list items (unimplemented ⇒ disabled "قريباً"), preference cards, data/storage |

Responsive: right-side navy **sidebar on desktop**, collapsible drawer on tablet, compact header +
**bottom navigation on mobile** (≥44px targets, no horizontal overflow).

---

## Folder structure

```
src/
├── accounting/          # ★ THE accounting service — pure, no I/O, no React
│   ├── types.ts         # Account, Operation, OperationType, CASH_ACCOUNT_ID
│   ├── totals.ts        # totalsByType / totalsForAccount / grandTotal
│   ├── deficit.ts       # computeDeficit — the مقياس العجز rule
│   ├── balance.ts       # accountBalance — opening + history
│   ├── limit.ts         # remainingLimit — monthly withdrawal limit
│   └── accounting.test.ts
├── components/          # reusable UI (AppShell, Sidebar, TopHeader, BottomNav, cards,
│                        # inputs, dialogs, toasts, tables, charts…). Display ONLY.
├── pages/               # one file per screen; wires data + accounting → components
├── hooks/useData.ts     # glue: IndexedDB live queries → accounting results → props
├── services/            # persistence (Dexie/IndexedDB): accounts, operations, settings, seed
├── validation/          # phone (01XXXXXXXXX), money parsing (piastres), form validation
├── utils/               # money (piastres), dates (UTC↔local), formatting, labels, ids
└── styles/tokens.css    # design tokens (CSS variables) + Tailwind @theme
```

**Rule enforced throughout:** all accounting math lives in `src/accounting/`. Components receive
formatted results and never contain formulas.

---

## Accounting model

All money is stored as **integer piastres** (1 EGP = 100 piastres). Timestamps are stored as
**UTC ISO** and displayed in the device's local timezone. Relationships use stable IDs (never
phone numbers).

### Account balance (transaction-derived, editable opening)

```
balance = openingBalance + Σ(deposits) − Σ(withdrawals)
```

- The **opening balance is an editable input** — changing it immediately shifts the derived
  balance; recorded history is never rewritten.
- **`فلوس` (cash) operations never change a wallet balance.** They are cash-side records
  (optionally tagged to an account for reporting) and are counted only in the deficit meter.

### Deficit meter (مقياس العجز)

```
Difference = (إجمالي الفلوس + إجمالي الإيداعات) − إجمالي المسحوبات
   < 0  →  عجز   (red, icon + text)
   > 0  →  زيادة (green, icon + text)
   = 0  →  تمام  (green, icon + text)
```

Every operation is counted **exactly once**, under its own type (enforced by construction in
`totalsByType` and covered by tests). Status is always shown with **icon + word**, never color
alone.

### Remaining limit (المتبقي من الليميت)

```
remaining = monthlyLimit(account) − Σ(withdrawals on that account in the current local month)
```

- Per-account configurable limit (default **40,000 EGP**), resets every calendar month.
- May go negative → badge "تجاوز الليميت" (red, icon + text).

### Data entry rules

- Phone: Egyptian mobile `010/011/012/015` + 8 digits; duplicates are blocked per account.
- سحب / إيداع require a wallet account as source; فلوس defaults to `(Cash) فلوس`.
- Amounts must be > 0; Arabic-Indic digits and `٬ ٫ ,` separators are accepted.
- Corrections: no editing/deletion of operations in v1 (see limitations).

---

## Tests

`pnpm test` — 33 assertions covering:

- deficit: negative (عجز) / zero (تمام) / positive (زيادة) cases, computed from raw operations
- balance: initial opening vs. historical operations; editing opening shifts balance without
  touching history; cash ops don't change balances
- no double-counting: every op counted once globally and per account
- monthly limit: current-month window, reset behavior, ignores deposits/cash, over-limit negative
- validation: Egyptian phone formats, duplicates, amount parsing (Latin + Arabic digits), form rules

A full browser e2e (Playwright + system Chrome) additionally verifies the whole flow: first-run
demo auto-seed + banner wording → PWA manifest & icons → demo reset button → deep-link refresh →
wipe (auto-seed must NOT resurrect data) → add account (duplicate phone blocked) → record
operations (zero amount blocked) → dashboard math → mobile layout (no overflow) → bottom
navigation → zero console/page errors.

---

## Demo mode (وضع العرض التجريبي)

CASHY is prepared as a **public demo** driven by clearly-marked fake data:

- **First visit auto-seeds** a demo ledger (4 accounts / 30 operations). The seed uses
  deterministic `demo-*` ids, so it is idempotent and safe across tabs.
- A persistent **banner** states in Arabic that the data is **وهمية للتجربة فقط** and that the
  app is **غير متصل بشبكة فيودافون** — it never connects to Vodafone and never executes real
  transactions.
- **«إعادة ضبط البيانات التجريبية»** (in the banner and in الإعدادات) deletes everything and
  re-creates a fresh demo dataset.
- **«مسح كل البيانات»** wipes the ledger and turns demo mode **off permanently** — the app will
  *not* auto-seed again afterwards (you start from a genuinely empty ledger).

---

## PWA

- `public/manifest.webmanifest` — name **CASHY**, `theme_color #0B1F3A`,
  `background_color #F3F6FA`, `dir: rtl`, standalone display.
- Icons in `public/icons/` (`192`, `512`, `maskable-512`), generated with **zero dependencies**
  by `scripts/gen-icons.mjs` → `pnpm icons` (white "C" arc on navy, matching `public/icon.svg`).
- `index.html` links the manifest, an apple-touch-icon, and the `theme-color` meta.

---

## Deploying the public demo (Vercel)

SPA fallback is pre-configured, so refreshing on **any** deep link works:

- `vercel.json` → `rewrites: ["/(.*)", "/index.html"]` (Vercel)
- `public/_redirects` → `/*  /index.html  200` (Netlify / Cloudflare Pages, copied into `dist/`)

### Option A — Git integration (recommended)

1. Push this repository to GitHub / GitLab / Bitbucket.
2. Go to [vercel.com/new](https://vercel.com/new) and **Import** the repository.
3. Vercel auto-detects **Vite** — confirm the defaults:
   - Framework preset: `Vite`
   - Build Command: `npm run build` (or `pnpm build`)
   - Output directory: `dist`
4. **No environment variables are required** (fully client-side — see `.env.example`).
5. Press **Deploy**, wait for the green check, open the printed URL.

### Option B — Vercel CLI

```bash
npm i -g vercel        # or: pnpm add -g vercel
vercel                 # create/link the project — accept defaults (vercel.json applies)
vercel --prod          # production deploy
```

### Post-deploy checklist

- `/` shows the Arabic demo banner **وضع العرض التجريبي** with seeded data.
- Refreshing `/deficit` (or any route) still loads the app → SPA rewrite works.
- `/manifest.webmanifest` returns the manifest; `/icons/icon-512.png` → 200.

---

## Security & environment

- The repository contains **no secrets and no API keys** — CASHY calls no external services
  and stores nothing server-side (all data lives in the visitor's browser, IndexedDB).
- `.env.example` documents that **zero variables are needed**; real `.env*` files are
  git-ignored — only `.env.example` is committed.
- Reminder for contributors: Vite exposes only `VITE_*`-prefixed variables to client code —
  never place anything sensitive there.

---

## Known limitations

1. **Local-only storage.** Everything lives in this browser's IndexedDB. There is no server, no
   sync, no backup. Clearing browser data deletes the ledger. Export/backup is not yet available.
2. **One device, one browser profile.** Opening the app in another browser shows an empty ledger.
3. **No operation editing/deletion.** Entries are append-only in v1; fix mistakes by recording the
   opposite entry (or wait for a future reversal feature).
4. **Logout is disabled** (shown as "قريباً") — there is no authentication in a single-user local app.
5. **Auto entry mode** in the add-operation form is disabled ("قريباً") — manual entry only.
6. **Theme/language:** light theme and Arabic only for now.
7. **The `فلوس`-doesn't-affect-balance rule** and the meter equation were confirmed for v1; both
   are isolated in `src/accounting/` so a rule change is a one-file change (plus tests).

---

## Design tokens

`src/styles/tokens.css` defines the full set of CSS variables: brand navy `#0B1F3A`, page
`#F3F6FA`, semantic green/blue/red (positive / cash / deficit — never used as brand colors),
radius, 8px-based spacing, shadows, type scale (Cairo font, self-hosted via `@fontsource`).
Tailwind v4 maps them through `@theme`.

---

## Stack

React 19 · TypeScript (strict) · Vite · Tailwind CSS v4 · Dexie (IndexedDB) · React Router ·
vitest · Cairo (`@fontsource-variable/cairo`).
