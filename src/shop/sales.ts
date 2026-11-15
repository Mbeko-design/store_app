import { isWithin } from "../utils/dates";
import type { PaymentMethod, Product, Receipt, ReceiptLine, SaleReturn } from "./types";

/**
 * Sales/report math — derived from append-only receipts and return records.
 * UI receives these results and never contains aggregation formulas.
 */

/** Σ line totals of one receipt (recomputed — stored total is just a cache). */
export function receiptTotal(lines: ReceiptLine[]): number {
  return lines.reduce((sum, l) => sum + l.pricePiastres * l.qty, 0);
}

export function totalAfterDiscount(subtotalPiastres: number, discountPiastres: number): number {
  if (
    !Number.isSafeInteger(subtotalPiastres) ||
    subtotalPiastres < 0 ||
    !Number.isSafeInteger(discountPiastres) ||
    discountPiastres < 0 ||
    discountPiastres > subtotalPiastres
  ) {
    throw new Error("invalid_discount");
  }
  return subtotalPiastres - discountPiastres;
}

export function receiptsInRange(receipts: Receipt[], start: Date, end: Date): Receipt[] {
  return receipts.filter((r) => isWithin(r.createdAtIso, start, end));
}

export function returnsInRange(returns: SaleReturn[], start: Date, end: Date): SaleReturn[] {
  return returns.filter((r) => isWithin(r.createdAtIso, start, end));
}

export function returnableQuantity(productId: string, receipts: Receipt[], returns: SaleReturn[]): number {
  const sold = receipts.reduce(
    (sum, receipt) => sum + receipt.lines.reduce((lineSum, line) => lineSum + (line.productId === productId ? line.qty : 0), 0),
    0,
  );
  const returned = returns.reduce(
    (sum, record) => sum + record.lines.reduce((lineSum, line) => lineSum + (line.productId === productId ? line.qty : 0), 0),
    0,
  );
  return Math.max(0, sold - returned);
}

export function returnsTotal(returns: SaleReturn[]): number {
  return returns.reduce((sum, record) => sum + record.totalPiastres, 0);
}

export interface RecentShopInvoice {
  id: string;
  kind: "sale" | "return";
  number: number;
  totalPiastres: number;
  paymentMethod: PaymentMethod;
  createdAtIso: string;
  lineCount: number;
  pieces: number;
}

/** Latest sale and return documents together for the shop dashboard. */
export function recentShopInvoices(
  receipts: Receipt[],
  returns: SaleReturn[],
  limit = 5,
): RecentShopInvoice[] {
  return [
    ...receipts.map((receipt): RecentShopInvoice => ({
      id: receipt.id,
      kind: "sale",
      number: receipt.number,
      totalPiastres: receipt.totalPiastres,
      paymentMethod: receipt.paymentMethod,
      createdAtIso: receipt.createdAtIso,
      lineCount: receipt.lines.length,
      pieces: receipt.lines.reduce((sum, line) => sum + line.qty, 0),
    })),
    ...returns.map((record): RecentShopInvoice => ({
      id: record.id,
      kind: "return",
      number: record.number,
      totalPiastres: record.totalPiastres,
      paymentMethod: record.paymentMethod,
      createdAtIso: record.createdAtIso,
      lineCount: record.lines.length,
      pieces: record.lines.reduce((sum, line) => sum + line.qty, 0),
    })),
  ]
    .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso) || b.number - a.number)
    .slice(0, Math.max(0, limit));
}

export function salesTotal(receipts: Receipt[], returns: SaleReturn[] = []): number {
  return receipts.reduce((sum, r) => sum + r.totalPiastres, 0) - returnsTotal(returns);
}

export interface SalesProfit {
  profitPiastres: number;
  uncostedLineCount: number;
  estimatedLegacyLineCount: number;
}

/**
 * Gross profit from sale-time cost snapshots; legacy receipts fall back to the
 * product's current cost and are explicitly counted as estimates.
 */
export function salesProfit(receipts: Receipt[], products: Product[], returns: SaleReturn[] = []): SalesProfit {
  const costByProduct = new Map(products.map((product) => [product.id, product.costPiastres]));
  let profitPiastres = 0;
  let uncostedLineCount = 0;
  let estimatedLegacyLineCount = 0;

  for (const receipt of receipts) {
    profitPiastres -= receipt.discountPiastres ?? 0;
    for (const line of receipt.lines) {
      const legacy = line.costPiastres === undefined;
      const cost = legacy ? costByProduct.get(line.productId) : line.costPiastres;
      if (cost === undefined || cost <= 0) {
        uncostedLineCount += 1;
        continue;
      }
      if (legacy) estimatedLegacyLineCount += 1;
      profitPiastres += (line.pricePiastres - cost) * line.qty;
    }
  }

  for (const record of returns) {
    for (const line of record.lines) {
      if (line.costPiastres === undefined) {
        uncostedLineCount += 1;
        continue;
      }
      if (line.costPiastres <= 0) {
        uncostedLineCount += 1;
        continue;
      }
      profitPiastres -= (line.pricePiastres - line.costPiastres) * line.qty;
    }
  }

  return { profitPiastres, uncostedLineCount, estimatedLegacyLineCount };
}

export function receiptsByMethod(receipts: Receipt[], method: PaymentMethod): Receipt[] {
  return receipts.filter((r) => r.paymentMethod === method);
}

export function soldCount(receipts: Receipt[]): number {
  return receipts.reduce((sum, r) => sum + r.lines.reduce((s, l) => s + l.qty, 0), 0);
}

/** Average receipt value (0 when empty — callers guard the display). */
export function averageReceipt(receipts: Receipt[], returns: SaleReturn[] = []): number {
  return receipts.length === 0 ? 0 : Math.round(salesTotal(receipts, returns) / receipts.length);
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
export function soldItems(receipts: Receipt[], returns: SaleReturn[] = []): SoldItem[] {
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
  for (const record of returns) {
    for (const line of record.lines) {
      let row = byId.get(line.productId);
      if (!row) {
        row = {
          productId: line.productId,
          name: line.name,
          barcode: line.barcode,
          qty: 0,
          revenuePiastres: 0,
          receiptsCount: 0,
          receiptIds: new Set(),
        };
        byId.set(line.productId, row);
      }
      row.qty -= line.qty;
      row.revenuePiastres -= line.pricePiastres * line.qty;
    }
  }
  return [...byId.values()]
    .map(({ receiptIds, ...row }) => ({ ...row, receiptsCount: receiptIds.size }))
    .filter((row) => row.qty !== 0 || row.revenuePiastres !== 0)
    .sort((a, b) => b.qty - a.qty || b.revenuePiastres - a.revenuePiastres);
}

/** Local calendar-day window containing `now` → receipts of today. */
export function todayRange(now: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return { start, end };
}
