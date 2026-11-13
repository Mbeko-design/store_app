# بساطه تك (Basata Tech)

> دفتر محاسبة شخصي لحسابات فيودافون كاش مع إدارة متجر — **بساطه تك (Basata Tech)** is a responsive, Arabic-first (RTL) personal
> bookkeeping web app for tracking multiple Vodafone Cash accounts in Egypt.
>
> **It is NOT a banking app.** بساطه تك never connects to Vodafone, never executes real transactions,
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
pnpm icons          # regenerate the PWA icons (scripts/gen-icons.py, needs Pillow)
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
| 9 | لوحة المتجر (Shop dashboard) | `/shop` | stock value, sales snapshot, restock alerts, recent receipts |
| 10 | المنتجات (Products) | `/shop/products` | register by **barcode scan**, edit name/price, stock shortcuts, search |
| 11 | نقطة البيع (POS) | `/shop/pos` | scan → cart → save receipt; unknown barcode opens registration (prefilled) |
| 12 | المخزون (Inventory) | `/shop/inventory` | stock levels, stock-in (إدخال), physical count (جرد), low/out filters |
| 13 | المبيعات (Sales) | `/shop/sales` | receipts (expandable lines), **sold-items report**, period/payment filters |

Responsive: right-side **brand-red sidebar on desktop** (labelled sections «إدارة الكاش» / «إدارة المتجر»), collapsible
drawer on tablet, compact header + **bottom navigation on mobile** (الرئيسية / الحسابات / المتجر /
إضافة عملية — ≥44px targets, no horizontal overflow).

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
├── shop/                # ★ PURE shop logic — stock/receipt/cart math (separate domain)
│   ├── types.ts         # Product, Receipt, StockMove, PaymentMethod
│   ├── stock.ts         # stockOnHand / stockValue / status (in + adjust − sale)
│   ├── sales.ts         # totals, sold-items aggregation, today/month windows
│   ├── cart.ts          # scan→cart rules (increment, stock limit, conflicts)
│   └── shop.test.ts
├── components/          # reusable UI (AppShell, Sidebar, TopHeader, BottomNav, cards,
│                        # inputs, dialogs, toasts, tables, charts…). Display ONLY.
│                        # Shop: BarcodeInput, ProductFormDialog, StockDialog, ShopBadges
├── pages/               # one file per screen; wires data + accounting → components
│                        # Shop: ShopDashboard/Products/Pos/Inventory/Sales
├── hooks/useData.ts     # glue: IndexedDB live queries → accounting results → props
├── hooks/useShop.ts     # same for the shop domain (stock table, sold items, totals)
├── services/            # persistence (Dexie/IndexedDB): accounts, operations, settings,
│                        # productsService, receiptsService (shop)
├── validation/          # phone (01XXXXXXXXX), money parsing (piastres), forms, shop/barcode
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

## Shop management model (إدارة المتجر)

A **separate section** for a phone shop — its own tables (`products`, `receipts`, `stockMoves`)
and its own pure module (`src/shop/`). Shop activity **never touches** the Vodafone Cash ledger
(decision confirmed for v1).

### Barcode workflow (USB scanner, laptop)

- The scanner is a **keyboard-wedge device**: it types the code then `Enter`.
  `BarcodeInput` listens for Enter → scan handled → field clears and keeps focus.
- **Products:** archive a product to hide it from the active catalog, inventory, and POS without
  deleting its receipt or stock history. Archived products can be restored from the products page.
- **Register:** scan → form (name, wholesale cost, sell price, initial qty). If a product has no
  barcode, leave the field blank; the app generates an internal Code 128 barcode and opens a
  browser print dialog. Entering an initial quantity of 6 prints six labels, two 38 × 12.5 mm
  labels per 38 × 25 mm page; an odd final copy uses the first half of a page. Quantity 0 skips
  printing. Stock-in movements also print one label per incoming piece;
  physical stock counts do not print. Existing labels can be printed again from the product list
  (one per piece currently in stock). The Xprinter XP-233B must be installed as a system printer
  and configured for the matching label stock.
- Wholesale cost is used for رأس المال only; the POS uses and displays the sell price only.
  Inventory shows wholesale stock value and the detailed list of fixed equipment/assets.
- Scanning an already-registered barcode opens a stock-in shortcut instead of failing; duplicates
  are blocked on submit.
- **POS:** scan → cart line (re-scan increments qty, clamped to stock) → payment method
  (نقدًا / فودافون كاش), optional manually entered discount code + percentage → save. Discount
  details and the net total are stored on the receipt. An **unknown barcode opens the registration dialog prefilled**.
- **Receipt printing:** print the saved invoice from POS or expand an invoice in Sales and
  reprint it. The receipt is formatted for 80 mm thermal rolls; choose the Xprinter and 80 mm
  paper in the browser print dialog (the exact paper option depends on its installed driver).

### Stock

```
stock = Σ(stock-in) + Σ(corrections, signed) − Σ(sales)
```

- Computed only in `src/shop/stock.ts` from `stockMoves` (each move counted once).
- Registration writes the initial `in` move; every receipt line writes a `sale` move
  referencing the receipt; جرد stores the signed difference to the counted quantity.
- Status: `0 → نفد` (red), `≤5 → منخفض` (amber), else `متوفر` — always icon + word.

### Receipts

- Append-only, **sequential numbers** (`settings.receiptSeq`), lines snapshot name/price/barcode
  and wholesale cost at sale time; optional discount code and percentage are recorded with the
  pre-discount subtotal, discount amount, and final total, all in integer piastres.
- Stock is re-checked **inside the save transaction** (UI checks are UX only) — an over-stock
  scan can never write a receipt.
- Sold-items report = aggregation over receipts (`soldItems`), filterable by period and
  payment method. The sales summary defaults to today, and supports this month, a selected date
  range, or all receipts. Gross profit uses the saved sale-time cost when available; older
  receipts without cost snapshots are estimated using the product's current wholesale cost and
  are marked as estimates.

Fixed equipment records its funding owner (فؤاد or سعد); existing equipment is assigned to فؤاد
during the additive database upgrade and can be reassigned from the inventory equipment editor.

---

## Tests

`pnpm test` — 63 assertions covering:

- deficit: negative (عجز) / zero (تمام) / positive (زيادة) cases, computed from raw operations
- balance: initial opening vs. historical operations; editing opening shifts balance without
  touching history; cash ops don't change balances
- no double-counting: every op counted once globally and per account
- monthly limit: current-month window, reset behavior, ignores deposits/cash, over-limit negative
- validation: Egyptian phone formats, duplicates, amount parsing (Latin + Arabic digits), form rules
- **shop**: stock math (in + adjust − sale, each move once), stock value/status, receipt totals,
  sold-items aggregation, payment/period filters, cart rules (scan increments, stock clamped,
  conflicts), barcode normalization/duplicates, quantity parsing

---

## Production data behavior

- The app does not create sample records for new users.
- Updates preserve all existing accounts, operations, products, receipts, settings, and profile
  information in IndexedDB. No startup migration deletes local records.
- Data remains local to each browser/device in IndexedDB; it does not sync between devices.

---

## PWA

- `public/manifest.webmanifest` — name **بساطه تك**, `theme_color #E30713`,
  `background_color #FFFFFF`, `dir: rtl`, standalone display.
- Icons in `public/icons/` (`192`, `512`, `maskable-512`) plus `public/favicon.png` and the
  `public/logo.png` brand tile, generated with **Pillow** by `scripts/gen-icons.py` → `npm run icons`
  (white brand mark on #E30713; source master: `scripts/assets/basata-mark.png`).
- `index.html` links the manifest, an apple-touch-icon, and the `theme-color` meta.

---

## Deploying to production (Vercel)

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

- `/` opens to an empty ledger for new users, with no sample data. Existing local data remains intact after updates.
- Refreshing `/deficit` (or any route) still loads the app → SPA rewrite works.
- `/manifest.webmanifest` returns the manifest; `/icons/icon-512.png` → 200.

---

## Security & environment

- The repository contains **no secrets and no API keys** — بساطه تك calls no external services
  and stores nothing server-side (all data lives in the visitor's browser, IndexedDB).
- `.env.example` documents that **zero variables are needed**; real `.env*` files are
  git-ignored — only `.env.example` is committed.
- Reminder for contributors: Vite exposes only `VITE_*`-prefixed variables to client code —
  never place anything sensitive there.

---

## Known limitations

1. **Local-only storage.** Everything lives in this browser's IndexedDB. There is no server or
   automatic sync. Settings can export and restore a versioned JSON backup; keep that file in a
   safe location (for example, Google Drive). Clearing browser data deletes the local copy.
2. **One device, one browser profile.** Opening the app in another browser shows an empty ledger.
3. **No operation editing/deletion.** Entries are append-only in v1; fix mistakes by recording the
   opposite entry (or wait for a future reversal feature).
4. **Logout is disabled** (shown as "قريباً") — there is no authentication in a single-user local app.
5. **Auto entry mode** in the add-operation form is disabled ("قريباً") — manual entry only.
6. **Theme/language:** light theme and Arabic only for now.
7. **The `فلوس`-doesn't-affect-balance rule** and the meter equation were confirmed for v1; both
   are isolated in `src/accounting/` so a rule change is a one-file change (plus tests).
8. **Shop v1:** receipts are append-only (no delete — fix stock via جرد); profit is gross and
   estimated when legacy cost snapshots are unavailable; product barcode is immutable after
   registration; no barcode-label printing; shop data is never synced to the money ledger.

---

## Design tokens

`src/styles/tokens.css` defines the full set of CSS variables: brand red `#E30713`, page
`#FFFFFF` (white/neutral theme), semantic green/blue/red (positive / cash / negative — never used
as brand colors; the `neg` red is distinct from and must not be confused with brand red),
radius, 8px-based spacing, shadows, type scale (Cairo font, self-hosted via `@fontsource`).
Tailwind v4 maps them through `@theme`.

---

## Stack

React 19 · TypeScript (strict) · Vite · Tailwind CSS v4 · Dexie (IndexedDB) · React Router ·
vitest · Cairo (`@fontsource-variable/cairo`).
