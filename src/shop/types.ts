/**
 * Shop management domain (phone shop) — SEPARATE from the money ledger:
 * products / receipts / stock. Never touches CASHY accounts or operations.
 * All money values are integer piastres (same rule as the accounting module).
 */

export type PaymentMethod = "cash" | "vodafone";

/** "in" = stock-in (registration / supplier), "sale" = receipt line, "adjust" = correction (signed). */
export type StockMoveType = "in" | "sale" | "adjust";

export const PAYMENT_METHODS: readonly PaymentMethod[] = ["cash", "vodafone"] as const;

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: "نقدًا",
  vodafone: "فودافون كاش",
};

/** Catalog row — the product itself. Stock is derived from StockMoves, never stored here. */
export interface Product {
  id: string;
  barcode: string; // unique, scanned via the USB barcode scanner
  name: string;
  pricePiastres: number; // sell price (v1: no cost/profit tracking, per decision)
  createdAtIso: string;
}

/** One line of a receipt. name/price/barcode are SNAPSHOTS at sale time. */
export interface ReceiptLine {
  productId: string;
  barcode: string;
  name: string;
  pricePiastres: number;
  qty: number;
}

export interface Receipt {
  id: string;
  number: number; // sequential receipt number (1, 2, 3 …)
  lines: ReceiptLine[];
  totalPiastres: number; // derived from lines at save time (stored for fast lists)
  paymentMethod: PaymentMethod;
  createdAtIso: string;
}

export interface StockMove {
  id: string;
  productId: string;
  type: StockMoveType;
  /** in/sale: positive; adjust: signed correction. */
  qty: number;
  /** Receipt that produced a "sale" move (audit trail). */
  refReceiptId?: string;
  note?: string;
  createdAtIso: string;
}

/** Stock status — icon + word in the UI, never color alone. */
export type StockStatus = "out" | "low" | "ok";

/** Products at or below this count are flagged "منخفض" (0 is "نفد"). */
export const LOW_STOCK_THRESHOLD = 5;

/** A cart line while building a receipt (same shape as ReceiptLine). */
export type CartLine = ReceiptLine;
