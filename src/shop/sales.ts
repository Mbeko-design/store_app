import { isWithin } from "../utils/dates";
import type { PaymentMethod, Receipt, ReceiptLine } from "./types";

/**
 * Sales/report math — derived ONLY from receipts (append-only source of truth).
 * UI receives these results and never contains aggregation formulas.
 */

/** Σ line totals of one receipt (recomputed — stored total is just a cache). */
export function receiptTotal(lines: ReceiptLine[]): number {
  return lines.reduce((sum, l) => sum + l.pricePiastres * l.qty, 0);
}

export function receiptsInRange(receipts: Receipt[], start: Date, end: Date): Receipt[] {
  return receipts.filter((r) => isWithin(r.createdAtIso, start, end));
}

export function salesTotal(receipts: Receipt[]): number {
  return receipts.reduce((sum, r) => sum + r.totalPiastres, 0);
}

export function receiptsByMethod(receipts: Receipt[], method: PaymentMethod): Receipt[] {
  return receipts.filter((r) => r.paymentMethod === method);
}

export function soldCount(receipts: Receipt[]): number {
  return receipts.reduce((sum, r) => sum + r.lines.reduce((s, l) => s + l.qty, 0), 0);
}

/** Average receipt value (0 when empty — callers guard the display). */
export function averageReceipt(receipts: Receipt[]): number {
  return receipts.length === 0 ? 0 : Math.round(salesTotal(receipts) / receipts.length);
}

export interface SoldItem {
  productId: string;
  name: string;
  barcode: string;
  qty: number;
  revenuePiastres: number;
  receiptsCount: number;
}

/** Aggregated sold items across receipts — qty desc, then revenue desc. */
export function soldItems(receipts: Receipt[]): SoldItem[] {
  const byId = new Map<string, SoldItem & { receiptIds: Set<string> }>();
  for (const r of receipts) {
    for (const l of r.lines) {
      let row = byId.get(l.productId);
      if (!row) {
        row = {
          productId: l.productId,
          name: l.name,
          barcode: l.barcode,
          qty: 0,
          revenuePiastres: 0,
          receiptsCount: 0,
          receiptIds: new Set(),
        };
        byId.set(l.productId, row);
      }
      row.qty += l.qty;
      row.revenuePiastres += l.pricePiastres * l.qty;
      row.receiptIds.add(r.id);
    }
  }
  return [...byId.values()]
    .map(({ receiptIds, ...row }) => ({ ...row, receiptsCount: receiptIds.size }))
    .sort((a, b) => b.qty - a.qty || b.revenuePiastres - a.revenuePiastres);
}

/** Local calendar-day window containing `now` → receipts of today. */
export function todayRange(now: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return { start, end };
}
