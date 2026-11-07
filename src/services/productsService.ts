import type { Product, StockMove } from "../shop/types";
import { stockOnHand } from "../shop/stock";
import { createInternalBarcode, normalizeBarcode, parseStockInQty } from "../validation/shop";
import { newId } from "../utils/labels";
import { db } from "./db";

/** Catalog service — product registration (via barcode scanner), edit, stock-in. */

export interface CreateProductInput {
  barcode: string;
  name: string;
  pricePiastres: number;
  /** Wholesale price (سعر الجملة) — capital tracking only; 0 = unknown. */
  costPiastres: number;
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

async function createUniqueInternalBarcode(): Promise<{ id: string; barcode: string }> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const id = newId();
    const barcode = createInternalBarcode(id);
    try {
      await assertBarcodeUnique(barcode);
      return { id, barcode };
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "duplicate_barcode") throw error;
    }
  }
  throw new Error("barcode_generation_failed");
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
  const requestedBarcode = normalizeBarcode(input.barcode);
  return db.transaction("rw", db.products, db.stockMoves, async () => {
    const generated = requestedBarcode ? undefined : await createUniqueInternalBarcode();
    const id = generated?.id ?? newId();
    const barcode = requestedBarcode || generated!.barcode;
    if (requestedBarcode) await assertBarcodeUnique(barcode);
    const product: Product = {
      id,
      barcode,
      name: input.name.trim(),
      pricePiastres: input.pricePiastres,
      costPiastres: input.costPiastres,
      createdAtIso: new Date().toISOString(),
    };
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
    return product;
  });
}

/** Edit name/sell-price/wholesale-cost only — barcode is immutable once registered (audit integrity). */
export async function updateProduct(
  id: string,
  patch: { name?: string; pricePiastres?: number; costPiastres?: number },
): Promise<Product> {
  const existing = await db.products.get(id);
  if (!existing) throw new Error("not_found");
  if (existing.archivedAtIso) throw new Error("product_archived");
  const updated: Product = {
    ...existing,
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    ...(patch.pricePiastres !== undefined ? { pricePiastres: patch.pricePiastres } : {}),
    ...(patch.costPiastres !== undefined ? { costPiastres: patch.costPiastres } : {}),
  };
  await db.products.put(updated);
  return updated;
}

/** Archive a product from the active catalog without changing stock or sales history. */
export async function archiveProduct(id: string): Promise<void> {
  await db.transaction("rw", db.products, async () => {
    const product = await db.products.get(id);
    if (!product) throw new Error("not_found");
    if (product.archivedAtIso) return;
    await db.products.put({ ...product, archivedAtIso: new Date().toISOString() });
  });
}

/** Restore an archived product with its original barcode, stock moves, and history. */
export async function restoreProduct(id: string): Promise<Product> {
  return db.transaction("rw", db.products, async () => {
    const product = await db.products.get(id);
    if (!product) throw new Error("not_found");
    if (!product.archivedAtIso) return product;
    const restored = { ...product };
    delete restored.archivedAtIso;
    await db.products.put(restored);
    return restored;
  });
}

export async function findByBarcode(rawBarcode: string): Promise<Product | undefined> {
  const barcode = normalizeBarcode(rawBarcode);
  if (!barcode) return undefined;
  return db.products.where("barcode").equals(barcode).first();
}

/** All products, Arabic name order. */
export async function listProducts(includeArchived = false): Promise<Product[]> {
  const products = await db.products.toArray();
  return products
    .filter((product) => includeArchived || !product.archivedAtIso)
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));
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
    if (product.archivedAtIso) throw new Error("product_archived");
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
    if (product.archivedAtIso) throw new Error("product_archived");
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
