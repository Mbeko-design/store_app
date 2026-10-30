import type { Account, Operation, OperationType } from "../accounting/types";
import type { PaymentMethod, Product, Receipt, StockMove } from "../shop/types";
import { db } from "./db";
import { getDemoFlag, setDemoFlag } from "./settingsService";

/**
 * DEMO / SEED DATA — fake data for the public demo, NEVER presented as real.
 * Every row carries deterministic ids (demo-*) so seeding is idempotent, and
 * the app shows a persistent "وضع العرض التجريبي" banner while it is active
 * (see components/DemoBanner.tsx). A reset button re-creates it fresh.
 */

interface SeedOp {
  a: number; // account index
  t: OperationType;
  egp: number;
  d: number; // days ago
  h: number; // hour (local)
}

const SEED_OPS: SeedOp[] = [
  { a: 0, t: "deposit", egp: 10000, d: 60, h: 9 },
  { a: 1, t: "deposit", egp: 8000, d: 58, h: 10 },
  { a: 2, t: "deposit", egp: 12000, d: 55, h: 12 },
  { a: 0, t: "withdraw", egp: 4000, d: 52, h: 11 },
  { a: 0, t: "cash", egp: 5000, d: 50, h: 14 },
  { a: 3, t: "deposit", egp: 6000, d: 48, h: 9 },
  { a: 1, t: "withdraw", egp: 3000, d: 45, h: 16 },
  { a: 2, t: "cash", egp: 2500, d: 44, h: 13 },
  { a: 0, t: "deposit", egp: 7500, d: 40, h: 10 },
  { a: 3, t: "withdraw", egp: 2500, d: 38, h: 15 },
  { a: 1, t: "deposit", egp: 9000, d: 35, h: 11 },
  { a: 2, t: "withdraw", egp: 6000, d: 33, h: 12 },
  { a: 0, t: "withdraw", egp: 5500, d: 30, h: 17 },
  { a: 1, t: "cash", egp: 3000, d: 28, h: 14 },
  { a: 3, t: "deposit", egp: 4500, d: 25, h: 9 },
  { a: 2, t: "deposit", egp: 5000, d: 22, h: 10 },
  { a: 0, t: "deposit", egp: 12000, d: 20, h: 11 }, // current month
  { a: 1, t: "withdraw", egp: 7000, d: 18, h: 13 },
  { a: 3, t: "cash", egp: 1500, d: 16, h: 15 },
  { a: 2, t: "withdraw", egp: 4500, d: 14, h: 16 },
  { a: 0, t: "withdraw", egp: 6500, d: 12, h: 12 },
  { a: 1, t: "deposit", egp: 6500, d: 10, h: 9 },
  { a: 2, t: "cash", egp: 4000, d: 8, h: 14 },
  { a: 0, t: "cash", egp: 3500, d: 6, h: 10 },
  { a: 3, t: "withdraw", egp: 3500, d: 5, h: 17 },
  { a: 1, t: "deposit", egp: 5500, d: 4, h: 11 },
  { a: 2, t: "deposit", egp: 7000, d: 3, h: 13 },
  { a: 0, t: "withdraw", egp: 2000, d: 2, h: 15 },
  { a: 3, t: "deposit", egp: 3000, d: 1, h: 10 },
  { a: 1, t: "withdraw", egp: 4500, d: 0, h: 12 },
];

const SEED_ACCOUNTS: Array<{ phone: string; label: string; limitEgp: number; openingEgp: number }> = [
  { phone: "01012345678", label: "خزنة المحل الرئيسية", limitEgp: 40000, openingEgp: 12000 },
  { phone: "01112345678", label: "حساب التوصيل", limitEgp: 30000, openingEgp: 5000 },
  { phone: "01212345678", label: "حساب المخازن", limitEgp: 40000, openingEgp: 8000 },
  { phone: "01512345678", label: "حساب المحاسبة", limitEgp: 25000, openingEgp: 0 },
];

// ---------- Shop demo data (phone shop: products + receipts) ----------

interface SeedProduct {
  name: string;
  barcode: string;
  priceEgp: number;
  initialQty: number;
}

/** initialQty always ≥ total sold in SEED_RECEIPTS (stock never goes negative). */
const SEED_PRODUCTS: SeedProduct[] = [
  { name: "موبايل Samsung A15", barcode: "622110000001", priceEgp: 8500, initialQty: 6 },
  { name: "موبايل Redmi Note 13", barcode: "622110000002", priceEgp: 12000, initialQty: 5 },
  { name: "كفر شفاف iPhone 13", barcode: "622110000003", priceEgp: 120, initialQty: 40 },
  { name: "زجاج حماية Samsung A15", barcode: "622110000004", priceEgp: 80, initialQty: 50 },
  { name: "شاحن أصلي 20W", barcode: "622110000005", priceEgp: 450, initialQty: 20 },
  { name: "كابل USB-C متين", barcode: "622110000006", priceEgp: 150, initialQty: 30 },
  { name: "باور بانك 10000mAh", barcode: "622110000007", priceEgp: 750, initialQty: 10 },
  { name: "سماعة بلوتوث", barcode: "622110000008", priceEgp: 600, initialQty: 12 },
  { name: "خرطوشة شحن 50 جنيه", barcode: "622110000009", priceEgp: 50, initialQty: 60 },
  { name: "كابل Lightning", barcode: "622110000010", priceEgp: 180, initialQty: 0 }, // نفد من البداية (للعرض)
];

interface SeedReceipt {
  d: number; // days ago
  h: number; // hour (local)
  method: PaymentMethod;
  lines: Array<[productIndex: number, qty: number]>;
}

/** Chronological (oldest first) → receipt numbers increase with time. */
const SEED_RECEIPTS: SeedReceipt[] = [
  { d: 18, h: 11, method: "cash", lines: [[8, 10], [2, 3], [5, 3]] },
  { d: 16, h: 13, method: "vodafone", lines: [[0, 1], [2, 4], [3, 4]] },
  { d: 14, h: 16, method: "cash", lines: [[3, 6], [4, 2], [8, 15]] },
  { d: 12, h: 10, method: "cash", lines: [[1, 1], [5, 2], [7, 1]] },
  { d: 10, h: 12, method: "vodafone", lines: [[2, 5], [6, 1]] },
  { d: 8, h: 14, method: "cash", lines: [[8, 8], [4, 1], [3, 3]] },
  { d: 6, h: 11, method: "cash", lines: [[0, 1], [4, 3]] },
  { d: 5, h: 17, method: "vodafone", lines: [[1, 1], [7, 2]] },
  { d: 4, h: 15, method: "cash", lines: [[5, 4], [2, 2]] },
  { d: 3, h: 13, method: "cash", lines: [[0, 2], [6, 1]] },
  { d: 2, h: 12, method: "vodafone", lines: [[2, 2], [3, 2]] },
  { d: 0, h: 10, method: "cash", lines: [[0, 1], [2, 2], [8, 5]] }, // today
  { d: 0, h: 12, method: "vodafone", lines: [[4, 2], [6, 1], [7, 1]] }, // today
];

/** Products + receipts + derived stock moves (initial "in" + per-line "sale"). */
function buildShopSeed(now: Date): { products: Product[]; receipts: Receipt[]; moves: StockMove[] } {
  const products: Product[] = SEED_PRODUCTS.map((s, i) => ({
    id: `demo-prod-${i + 1}`,
    barcode: s.barcode,
    name: s.name,
    pricePiastres: s.priceEgp * 100,
    createdAtIso: new Date(now.getTime() - 65 * 86400_000).toISOString(),
  }));

  const moves: StockMove[] = [];
  let moveSeq = 0;
  products.forEach((prod, i) => {
    const qty = SEED_PRODUCTS[i]!.initialQty;
    if (qty > 0) {
      moves.push({
        id: `demo-move-${++moveSeq}`,
        productId: prod.id,
        type: "in",
        qty,
        note: "رصيد افتتاحي",
        createdAtIso: prod.createdAtIso,
      });
    }
  });

  const receipts: Receipt[] = SEED_RECEIPTS.map((r, i) => {
    const when = new Date(now.getFullYear(), now.getMonth(), now.getDate(), r.h, (i * 11) % 60, 0, 0);
    when.setDate(when.getDate() - r.d);
    const lines = r.lines.map(([pi, qty]) => {
      const prod = products[pi]!;
      return { productId: prod.id, barcode: prod.barcode, name: prod.name, pricePiastres: prod.pricePiastres, qty };
    });
    const createdAtIso = when.toISOString();
    for (const line of lines) {
      moves.push({
        id: `demo-move-${++moveSeq}`,
        productId: line.productId,
        type: "sale",
        qty: line.qty,
        refReceiptId: `demo-receipt-${i + 1}`,
        createdAtIso,
      });
    }
    return {
      id: `demo-receipt-${i + 1}`,
      number: i + 1,
      lines,
      totalPiastres: lines.reduce((s, l) => s + l.pricePiastres * l.qty, 0),
      paymentMethod: r.method,
      createdAtIso,
    } satisfies Receipt;
  });

  return { products, receipts, moves };
}

/** Wipe accounts + operations + shop data (demo flag and profile are untouched). */
async function clearDemoRecords(): Promise<void> {
  await db.transaction("rw", [db.accounts, db.operations, db.products, db.receipts, db.stockMoves], async () => {
    await db.accounts.clear();
    await db.operations.clear();
    await db.products.clear();
    await db.receipts.clear();
    await db.stockMoves.clear();
  });
}

async function storeIsEmpty(): Promise<boolean> {
  const [accounts, ops, products, receipts] = await Promise.all([
    db.accounts.count(),
    db.operations.count(),
    db.products.count(),
    db.receipts.count(),
  ]);
  return accounts === 0 && ops === 0 && products === 0 && receipts === 0;
}

/**
 * Seed the demo dataset into an EMPTY app and switch demo mode ON.
 * Throws "not_empty" if real records exist (manual/preview loads only).
 */
export async function loadPreviewData(): Promise<void> {
  if (!(await storeIsEmpty())) throw new Error("not_empty");

  const accounts: Account[] = SEED_ACCOUNTS.map((s, i) => ({
    id: `demo-acc-${i + 1}`,
    phone: s.phone,
    label: s.label,
    limitMonthlyPiastres: s.limitEgp * 100,
    openingBalancePiastres: s.openingEgp * 100,
    createdAtIso: new Date(Date.now() - 70 * 86400_000).toISOString(),
    archivedAtIso: null,
  }));

  const now = new Date();
  const ops: Operation[] = SEED_OPS.map((s, i) => {
    const when = new Date(now.getFullYear(), now.getMonth(), now.getDate(), s.h, (i * 7) % 60, 0, 0);
    when.setDate(when.getDate() - s.d);
    return {
      id: `demo-op-${i + 1}`,
      accountId: accounts[s.a]!.id,
      type: s.t,
      amountPiastres: s.egp * 100,
      occurredAtIso: when.toISOString(),
      note: "بيانات تجريبية",
      createdAtIso: when.toISOString(),
    };
  });

  const shop = buildShopSeed(now);

  await db.transaction(
    "rw",
    [db.accounts, db.operations, db.products, db.receipts, db.stockMoves, db.settings],
    async () => {
      await db.accounts.bulkPut(accounts);
      await db.operations.bulkPut(ops);
      await db.products.bulkPut(shop.products);
      await db.receipts.bulkPut(shop.receipts);
      await db.stockMoves.bulkPut(shop.moves);
      await db.settings.put({ key: "previewData", value: "1" });
      await db.settings.put({ key: "receiptSeq", value: String(SEED_RECEIPTS.length) });
    },
  );
}

let ensurePromise: Promise<void> | null = null;

/**
 * First-run auto-seed: if the demo flag has NEVER been set and the store is
 * empty → seed demo data. If the user previously wiped (flag "0") → do nothing.
 * Idempotent: returns a shared promise (safe under StrictMode double-effect)
 * and uses deterministic ids (safe across concurrent tabs).
 */
export function ensureDemoData(): Promise<void> {
  ensurePromise ??= (async () => {
    const flag = await getDemoFlag();
    if (flag !== null) return; // already decided (demo ON, or user-wiped)
    if (!(await storeIsEmpty())) {
      await setDemoFlag(false); // pre-existing data → not demo
      return;
    }
    await loadPreviewData();
  })().catch((e) => {
    ensurePromise = null;
    throw e;
  });
  return ensurePromise;
}

/**
 * "إعادة ضبط البيانات التجريبية" — delete whatever is there and re-create a
 * fresh demo dataset, demo mode ON.
 */
export async function resetDemoData(): Promise<void> {
  await clearDemoRecords();
  await loadPreviewData();
}
