import type { PaymentMethod, ReturnLine, SaleReturn, StockMove } from "../shop/types";
import { returnableQuantity } from "../shop/sales";
import { newId } from "../utils/labels";
import { db } from "./db";

export interface SaveReturnInput {
  lines: Array<{ productId: string; qty: number }>;
  paymentMethod: PaymentMethod;
}

const SEQ_KEY = "returnSeq";

/** Save a return and its stock-in moves atomically. */
export async function saveReturn(input: SaveReturnInput): Promise<SaleReturn> {
  if (input.lines.length === 0) throw new Error("empty_return");
  if (input.paymentMethod !== "cash" && input.paymentMethod !== "vodafone") {
    throw new Error("invalid_payment_method");
  }
  const seen = new Set<string>();
  for (const line of input.lines) {
    if (!line.productId || seen.has(line.productId)) throw new Error("invalid_return_lines");
    if (!Number.isSafeInteger(line.qty) || line.qty <= 0) throw new Error("invalid_return_qty");
    seen.add(line.productId);
  }

  return db.transaction("rw", db.products, db.receipts, db.returns, db.stockMoves, db.settings, async () => {
    const [receipts, returns] = await Promise.all([db.receipts.toArray(), db.returns.toArray()]);
    const returnLines: ReturnLine[] = [];

    for (const requested of input.lines) {
      const product = await db.products.get(requested.productId);
      if (!product) throw new Error("product_missing");
      if (requested.qty > returnableQuantity(product.id, receipts, returns)) {
        throw new Error("return_qty_exceeded");
      }
      returnLines.push({
        productId: product.id,
        barcode: product.barcode,
        name: product.name,
        pricePiastres: product.pricePiastres,
        ...(product.costPiastres !== undefined ? { costPiastres: product.costPiastres } : {}),
        qty: requested.qty,
      });
    }

    const seqRow = await db.settings.get(SEQ_KEY);
    const number = (seqRow ? Number(seqRow.value) || 0 : 0) + 1;
    const nowIso = new Date().toISOString();
    const record: SaleReturn = {
      id: newId(),
      number,
      lines: returnLines,
      totalPiastres: returnLines.reduce((sum, line) => sum + line.pricePiastres * line.qty, 0),
      paymentMethod: input.paymentMethod,
      createdAtIso: nowIso,
    };
    const moves: StockMove[] = returnLines.map((line) => ({
      id: newId(),
      productId: line.productId,
      type: "return",
      qty: line.qty,
      refReturnId: record.id,
      createdAtIso: nowIso,
    }));

    await db.returns.put(record);
    await db.stockMoves.bulkPut(moves);
    await db.settings.put({ key: SEQ_KEY, value: String(number) });
    return record;
  });
}

export async function listReturns(): Promise<SaleReturn[]> {
  const returns = await db.returns.toArray();
  return returns.sort((a, b) => {
    const time = b.createdAtIso.localeCompare(a.createdAtIso);
    return time !== 0 ? time : b.number - a.number;
  });
}
