import type { ShopAsset } from "./types";
import type { StockRow } from "./stock";

/**
 * Capital (رأس المال) math — pure, no React / browser APIs.
 * رأس المال = تكلفة المخزون (كمية × سعر الجملة) + قيمة المعدات والأجهزة.
 * Cost of a product defaults to 0 when absent (rows saved before the field existed).
 */

const costOf = (p: StockRow["product"]): number => p.costPiastres ?? 0;

/** Stock value at WHOLESALE cost: Σ (cost × on-hand qty, clamped ≥ 0). */
export function stockCostValue(rows: StockRow[]): number {
  return rows.reduce((sum, r) => sum + costOf(r.product) * Math.max(0, r.stock), 0);
}

/** Per-product capital lines, cost descending (for the detailed breakdown UI). */
export interface CapitalLine {
  productId: string;
  name: string;
  qty: number;
  costPiastres: number;
  lineCost: number;
}

export function capitalLines(rows: StockRow[]): CapitalLine[] {
  return rows
    .map((r) => {
      const costPiastres = costOf(r.product);
      return {
        productId: r.product.id,
        name: r.product.name,
        qty: Math.max(0, r.stock),
        costPiastres,
        lineCost: costPiastres * Math.max(0, r.stock),
      };
    })
    .sort((a, b) => b.lineCost - a.lineCost || a.name.localeCompare(b.name, "ar"));
}

/** Fixed equipment value (Σ asset prices). */
export function assetsTotal(assets: ShopAsset[]): number {
  return assets.reduce((sum, a) => sum + a.pricePiastres, 0);
}

/** The full breakdown object the inventory UI renders. */
export interface CapitalBreakdown {
  /** تكلفة المخزون الكلية (تُحتسب المنتجات التي لها تكلفة فقط). */
  stockCost: number;
  /** قيمة المعدات والأجهزة. */
  assets: number;
  /** الإجمالي: stockCost + assets. */
  total: number;
  lines: CapitalLine[];
}

export function capitalBreakdown(rows: StockRow[], assets: ShopAsset[]): CapitalBreakdown {
  const stockCost = stockCostValue(rows);
  const assetsValue = assetsTotal(assets);
  return { stockCost, assets: assetsValue, total: stockCost + assetsValue, lines: capitalLines(rows) };
}
