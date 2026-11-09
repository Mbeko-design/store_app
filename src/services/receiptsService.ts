import {
  cartStockConflict,
  cartTotal,
  type CartLine,
  type PaymentMethod,
  type Product,
  type Receipt,
  type StockMove,
} from "../shop";
import { stockOnHand } from "../shop/stock";
import { newId } from "../utils/labels";
import { db } from "./db";

/** Receipts service — saving a sale (scan→cart→commit) with stock enforcement. */

export interface SaveReceiptInput {
  lines: CartLine[];
  paymentMethod: PaymentMethod;
}

const SEQ_KEY = "receiptSeq";

/**
 * Save a receipt + its "sale" stock moves atomically.
 * Stock is re-checked INSIDE the transaction (UI checks are UX only).
 * Sequential receipt numbers come from settings.receiptSeq.
 */
export async function saveReceipt(input: SaveReceiptInput): Promise<Receipt> {
  if (input.lines.length === 0) throw new Error("empty_receipt");

  return db.transaction("rw", db.products, db.receipts, db.stockMoves, db.settings, async () => {
    // Snapshot stock for the referenced products, then re-validate the cart.
    const productIds = [...new Set(input.lines.map((l) => l.productId))];
    const stocks = new Map<string, number>();
    const products = new Map<string, Product>();
    for (const id of productIds) {
      const product = await db.products.get(id);
      if (!product) throw new Error("product_missing");
      if (product.archivedAtIso) throw new Error("product_archived");
      const moves = await db.stockMoves.where("productId").equals(id).toArray();
      stocks.set(id, stockOnHand(moves, id));
      products.set(id, product);
    }
    const conflict = cartStockConflict(input.lines, (id) => stocks.get(id) ?? 0);
    if (conflict) throw new Error("insufficient_stock");

    const seqRow = await db.settings.get(SEQ_KEY);
    const number = (seqRow ? Number(seqRow.value) || 0 : 0) + 1;
    const nowIso = new Date().toISOString();
    const receipt: Receipt = {
      id: newId(),
      number,
      lines: input.lines.map((line) => {
        const costPiastres = products.get(line.productId)?.costPiastres;
        return { ...line, ...(costPiastres !== undefined ? { costPiastres } : {}) };
      }), // snapshot lines (including current wholesale cost)
      totalPiastres: cartTotal(input.lines),
      paymentMethod: input.paymentMethod,
      createdAtIso: nowIso,
    };
    const moves: StockMove[] = input.lines.map((l) => ({
      id: newId(),
      productId: l.productId,
      type: "sale" as const,
      qty: l.qty,
      refReceiptId: receipt.id,
      createdAtIso: nowIso,
    }));

    await db.receipts.put(receipt);
    await db.stockMoves.bulkPut(moves);
    await db.settings.put({ key: SEQ_KEY, value: String(number) });
    return receipt;
  });
}

/** All receipts, newest first (createdAt desc, number desc as tie-break). */
export async function listReceipts(): Promise<Receipt[]> {
  const receipts = await db.receipts.toArray();
  return receipts.sort((a, b) => {
    const t = b.createdAtIso.localeCompare(a.createdAtIso);
    return t !== 0 ? t : b.number - a.number;
  });
}

export async function getReceipt(id: string): Promise<Receipt | undefined> {
  return db.receipts.get(id);
}

/** All stock moves (the shop hooks compute stock via the pure shop module). */
export async function allStockMoves(): Promise<StockMove[]> {
  return db.stockMoves.toArray();
}
