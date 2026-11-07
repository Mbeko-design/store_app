import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import {
  capitalBreakdown,
  lowStockRows,
  receiptsInRange,
  salesTotal,
  soldCount,
  soldItems,
  stockTable,
  stockValue,
  todayRange,
  totalPieces,
  type CapitalBreakdown,
  type Product,
  type Receipt,
  type ShopAsset,
  type SoldItem,
  type StockRow,
} from "../shop";
import { listAssets } from "../services/assetsService";
import { listProducts } from "../services/productsService";
import { allStockMoves, listReceipts } from "../services/receiptsService";

/**
 * Shop data hooks — glue between IndexedDB and the PURE shop module.
 * Same rule as useLedger: math happens once here, components get results.
 */

export function useProducts(): Product[] | undefined {
  return useLiveQuery(() => listProducts(), []);
}

/** Fixed equipment (رأس المال الثابت) — ماسح باركود, طابعة… */
export function useAssets(): ShopAsset[] | undefined {
  return useLiveQuery(() => listAssets(), []);
}

export function useReceipts(): Receipt[] | undefined {
  return useLiveQuery(() => listReceipts(), []);
}

export interface ShopView {
  /** Products with derived stock + status. */
  rows: StockRow[];
  receipts: Receipt[]; // newest first
  sold: SoldItem[]; // aggregated, qty desc
  low: StockRow[]; // نفد / منخفض
  assets: ShopAsset[]; // fixed equipment
  capital: CapitalBreakdown; // رأس المال (تكلفة المخزون + معدات)
  totals: {
    salesAll: number;
    salesToday: number;
    receiptsToday: number;
    piecesToday: number;
    pieces: number;
    stockValue: number;
    products: number;
    receipts: number;
  };
}

export function useShopView(): ShopView | undefined {
  const data = useLiveQuery(async () => {
    const [products, receipts, moves, assets] = await Promise.all([listProducts(), listReceipts(), allStockMoves(), listAssets()]);
    return { products, receipts, moves, assets };
  }, []);

  return useMemo(() => {
    if (!data) return undefined;
    const rows = stockTable(data.products, data.moves);
    const { start, end } = todayRange();
    const todays = receiptsInRange(data.receipts, start, end);
    return {
      rows,
      receipts: data.receipts,
      sold: soldItems(data.receipts),
      low: lowStockRows(rows),
      assets: data.assets,
      capital: capitalBreakdown(rows, data.assets),
      totals: {
        salesAll: salesTotal(data.receipts),
        salesToday: salesTotal(todays),
        receiptsToday: todays.length,
        piecesToday: soldCount(todays),
        pieces: totalPieces(rows),
        stockValue: stockValue(rows),
        products: data.products.length,
        receipts: data.receipts.length,
      },
    };
  }, [data]);
}
