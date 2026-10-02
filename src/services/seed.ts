import type { Account, Operation, OperationType } from "../accounting/types";
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

/** Wipe accounts + operations (demo flag and profile are untouched). */
async function clearDemoRecords(): Promise<void> {
  await db.transaction("rw", db.accounts, db.operations, async () => {
    await db.accounts.clear();
    await db.operations.clear();
  });
}

/**
 * Seed the demo dataset into an EMPTY app and switch demo mode ON.
 * Throws "not_empty" if real records exist (manual/preview loads only).
 */
export async function loadPreviewData(): Promise<void> {
  const hasAccounts = (await db.accounts.count()) > 0;
  const hasOps = (await db.operations.count()) > 0;
  if (hasAccounts || hasOps) throw new Error("not_empty");

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

  await db.transaction("rw", db.accounts, db.operations, db.settings, async () => {
    await db.accounts.bulkPut(accounts);
    await db.operations.bulkPut(ops);
    await db.settings.put({ key: "previewData", value: "1" });
  });
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
    const hasAccounts = (await db.accounts.count()) > 0;
    const hasOps = (await db.operations.count()) > 0;
    if (hasAccounts || hasOps) {
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
