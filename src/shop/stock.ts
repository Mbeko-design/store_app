import { LOW_STOCK_THRESHOLD, type Product, type StockMove, type StockStatus } from "./types";

/**
 * Stock math — THE single place stock is computed.
 * stock = Σ(in) + Σ(adjust, signed) − Σ(sale).  Every move counts once.
 */
export function stockOnHand(moves: StockMove[], productId: string): number {
  let stock = 0;
  for (const m of moves) {
    if (m.productId !== productId) continue;
    if (m.type === "in") stock += m.qty;
    else if (m.type === "sale") stock -= m.qty;
    else stock += m.qty; // adjust (signed)
  }
  return stock;
}

export interface StockRow {
  product: Product;
  stock: number;
  status: StockStatus;
}

export function stockStatus(stock: number): StockStatus {
  if (stock <= 0) return "out";
  if (stock <= LOW_STOCK_THRESHOLD) return "low";
  return "ok";
}

/** Every product with its computed stock + status (single pass per product). */
export function stockTable(products: Product[], moves: StockMove[]): StockRow[] {
  return products.map((product) => {
    const stock = stockOnHand(moves, product.id);
    return { product, stock, status: stockStatus(stock) };
  });
}

/** Total pieces on hand (Σ stocks). */
export function totalPieces(rows: StockRow[]): number {
  return rows.reduce((sum, r) => sum + r.stock, 0);
}

/** Stock value at SELL price (v1 tracks sell price only). */
export function stockValue(rows: StockRow[]): number {
  return rows.reduce((sum, r) => sum + r.product.pricePiastres * Math.max(0, r.stock), 0);
}

/** Rows that need restocking (نفد / منخفض), stock ascending. */
export function lowStockRows(rows: StockRow[]): StockRow[] {
  return rows
    .filter((r) => r.status !== "ok")
    .sort((a, b) => a.stock - b.stock || a.product.name.localeCompare(b.product.name, "ar"));
}
