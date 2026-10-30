import type { Product, StockMove } from "../shop/types";
import { stockOnHand } from "../shop/stock";
import { normalizeBarcode, parseStockInQty } from "../validation/shop";
import { newId } from "../utils/labels";
import { db } from "./db";

/** Catalog service — product registration (via barcode scanner), edit, stock-in. */

export interface CreateProductInput {
  barcode: string;
  name: string;
  pricePiastres: number;
  /** Initial quantity at registration (0 → no stock move needed). */
  initialQty: number;
}

async function assertBarcodeUnique(barcode: string, currentId?: string): Promise<void> {
  const normalized = normalizeBarcode(barcode);
  const all = await db.products.toArray();
  if (all.some((p) => p.barcode === normalized && p.id !== currentId)) {
    throw new Error("duplicate_barcode");
  }
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
  const barcode = normalizeBarcode(input.barcode);
  await assertBarcodeUnique(barcode);
  const product: Product = {
    id: newId(),
    barcode,
    name: input.name.trim(),
    pricePiastres: input.pricePiastres,
    createdAtIso: new Date().toISOString(),
  };
  await db.transaction("rw", db.products, db.stockMoves, async () => {
    await db.products.put(product);
    if (input.initialQty > 0) {
      await db.stockMoves.put({
        id: newId(),
        productId: product.id,
        type: "in",
        qty: input.initialQty,
        note: "رصيد افتتاحي",
        createdAtIso: new Date().toISOString(),
      } satisfies StockMove);
    }
  });
  return product;
}

/** Edit name/price only — barcode is immutable once registered (audit integrity). */
export async function updateProduct(id: string, patch: { name?: string; pricePiastres?: number }): Promise<Product> {
  const existing = await db.products.get(id);
  if (!existing) throw new Error("not_found");
  const updated: Product = {
    ...existing,
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    ...(patch.pricePiastres !== undefined ? { pricePiastres: patch.pricePiastres } : {}),
  };
  await db.products.put(updated);
  return updated;
}

export async function findByBarcode(rawBarcode: string): Promise<Product | undefined> {
  const barcode = normalizeBarcode(rawBarcode);
  if (!barcode) return undefined;
  return db.products.where("barcode").equals(barcode).first();
}

/** All products, Arabic name order. */
export async function listProducts(): Promise<Product[]> {
  const products = await db.products.toArray();
  return products.sort((a, b) => a.name.localeCompare(b.name, "ar"));
}

/**
 * Physical count correction: store a signed "adjust" move so on-hand equals `targetQty`.
 * Delta computed from the same pure stock formula (no ad-hoc math in services beyond this).
 */
export async function applyStockCount(
  productId: string,
  targetQty: number,
): Promise<{ delta: number }> {
  return db.transaction("rw", db.products, db.stockMoves, async () => {
    const product = await db.products.get(productId);
    if (!product) throw new Error("not_found");
    const moves = await db.stockMoves.where("productId").equals(productId).toArray();
    const delta = targetQty - stockOnHand(moves, productId);
    if (delta !== 0) {
      await db.stockMoves.put({
        id: newId(),
        productId,
        type: "adjust",
        qty: delta,
        note: "جرد",
        createdAtIso: new Date().toISOString(),
      } satisfies StockMove);
    }
    return { delta };
  });
}

/** Supplier/registration stock-in (positive qty, validated). */
export async function stockIn(productId: string, qtyRaw: string, note?: string): Promise<number> {
  const parsed = parseStockInQty(qtyRaw);
  if (!parsed.ok) throw new Error(parsed.error);
  return db.transaction("rw", db.products, db.stockMoves, async () => {
    const product = await db.products.get(productId);
    if (!product) throw new Error("not_found");
    await db.stockMoves.put({
      id: newId(),
      productId,
      type: "in",
      qty: parsed.qty,
      ...(note?.trim() ? { note: note.trim() } : {}),
      createdAtIso: new Date().toISOString(),
    } satisfies StockMove);
    return parsed.qty;
  });
}
