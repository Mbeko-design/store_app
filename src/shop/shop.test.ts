import { describe, expect, it } from "vitest";
import {
  addToCart,
  averageReceipt,
  cartCount,
  cartStockConflict,
  cartTotal,
  lowStockRows,
  PAYMENT_LABEL,
  receiptTotal,
  receiptsByMethod,
  receiptsInRange,
  removeLine,
  setLineQty,
  soldCount,
  soldItems,
  salesTotal,
  stockOnHand,
  stockStatus,
  stockTable,
  stockValue,
  todayRange,
  totalPieces,
} from "./index";
import type { Product, Receipt, StockMove } from "./types";

// ---------- fixtures ----------

const p = (id: string, priceEgp = 100, barcode = `BC${id}`): Product => ({
  id,
  barcode,
  name: `منتج ${id}`,
  pricePiastres: priceEgp * 100,
  createdAtIso: "2026-10-01T10:00:00.000Z",
});

let moveSeq = 0;
const move = (productId: string, type: StockMove["type"], qty: number): StockMove => ({
  id: `m${++moveSeq}`,
  productId,
  type,
  qty,
  createdAtIso: "2026-10-01T10:00:00.000Z",
});

const receipt = (
  id: string,
  lines: Array<[productId: string, qty: number, priceEgp: number]>,
  method: "cash" | "vodafone" = "cash",
  iso = "2026-10-02T12:00:00.000Z",
): Receipt => ({
  id,
  number: Number(id.replace(/\D/g, "")),
  lines: lines.map(([productId, qty, priceEgp]) => ({
    productId,
    barcode: `BC${productId}`,
    name: `منتج ${productId}`,
    pricePiastres: priceEgp * 100,
    qty,
  })),
  totalPiastres: lines.reduce((s, [, qty, priceEgp]) => s + qty * priceEgp * 100, 0),
  paymentMethod: method,
  createdAtIso: iso,
});

// ---------- stock ----------

describe("stockOnHand", () => {
  it("starts at 0 with no moves", () => {
    expect(stockOnHand([], "a")).toBe(0);
  });

  it("in − sale + signed adjust", () => {
    const moves = [
      move("a", "in", 10), // stock-in
      move("a", "sale", 3), // sold
      move("a", "adjust", -2), // correction down
      move("a", "in", 5),
      move("b", "in", 99), // other product — ignored
    ];
    expect(stockOnHand(moves, "a")).toBe(10 - 3 - 2 + 5);
  });

  it("each move counted exactly once (no double counting)", () => {
    const moves = [move("a", "in", 4), move("a", "sale", 1)];
    const total = stockOnHand(moves, "a");
    expect(total).toBe(3);
    expect(stockOnHand(moves, "a")).toBe(total); // deterministic
  });

  it("goes negative when corrections exceed stock (reported honestly)", () => {
    expect(stockOnHand([move("a", "in", 2), move("a", "adjust", -5)], "a")).toBe(-3);
  });
});

describe("stock status / table / value", () => {
  it("status: 0 → out, ≤5 → low, >5 → ok", () => {
    expect(stockStatus(0)).toBe("out");
    expect(stockStatus(5)).toBe("low");
    expect(stockStatus(6)).toBe("ok");
    expect(stockStatus(-1)).toBe("out");
  });

  it("stockTable derives stock + status per product", () => {
    const rows = stockTable([p("a"), p("b"), p("c")], [move("a", "in", 8), move("b", "in", 2)]);
    expect(rows.map((r) => [r.stock, r.status])).toEqual([
      [8, "ok"],
      [2, "low"],
      [0, "out"],
    ]);
    expect(totalPieces(rows)).toBe(10);
  });

  it("stockValue = Σ price × stock at sell price", () => {
    // a: 8 × 100 EGP, b: 2 × 100 EGP
    const rows = stockTable([p("a", 100), p("b", 100)], [move("a", "in", 8), move("b", "in", 2)]);
    expect(stockValue(rows)).toBe(100_000); // 1,000 EGP in piastres
  });

  it("stockValue never counts negative stock as value", () => {
    const rows = stockTable([p("a", 50)], [move("a", "adjust", -3)]);
    expect(stockValue(rows)).toBe(0);
  });

  it("lowStockRows lists out/low first, lowest stock first", () => {
    const rows = stockTable(
      [p("a"), p("b"), p("c")],
      [move("a", "in", 0), move("b", "in", 3), move("c", "in", 20)],
    );
    const low = lowStockRows(rows);
    expect(low.map((r) => r.product.id)).toEqual(["a", "b"]);
  });
});

// ---------- receipts / sales ----------

describe("receipt totals & aggregates", () => {
  const r1 = receipt("r1", [["a", 2, 100], ["b", 1, 50]], "cash");
  const r2 = receipt("r2", [["a", 1, 100]], "vodafone", "2026-10-03T09:00:00.000Z");

  it("receiptTotal = Σ price × qty", () => {
    expect(receiptTotal(r1.lines)).toBe(2 * 100_00 + 1 * 50_00);
    expect(cartTotal(r1.lines)).toBe(receiptTotal(r1.lines)); // cart uses the same rule
  });

  it("salesTotal & soldCount & average", () => {
    expect(salesTotal([r1, r2])).toBe(250_00 + 100_00);
    expect(soldCount([r1, r2])).toBe(4);
    expect(averageReceipt([r1, r2])).toBe(Math.round(350_00 / 2));
    expect(averageReceipt([])).toBe(0);
  });

  it("filter by payment method", () => {
    expect(receiptsByMethod([r1, r2], "cash")).toHaveLength(1);
    expect(receiptsByMethod([r1, r2], "vodafone")[0]?.id).toBe("r2");
    expect(PAYMENT_LABEL.cash).toBe("نقدًا");
  });

  it("range filter uses real timestamps", () => {
    const inRange = receiptsInRange([r1, r2], new Date("2026-10-01"), new Date("2026-10-03T00:00:00"));
    expect(inRange.map((r) => r.id)).toEqual(["r1"]);
  });

  it("todayRange spans the local calendar day", () => {
    const { start, end } = todayRange(new Date(2026, 9, 30, 15, 30));
    expect(start.getDate()).toBe(30);
    expect(end.getDate()).toBe(31);
    expect(end.getTime() - start.getTime()).toBe(86_400_000);
  });
});

describe("soldItems aggregation", () => {
  it("aggregates across receipts: qty, revenue, receipts count — sorted by qty", () => {
    const receipts = [
      receipt("r1", [["a", 2, 100], ["b", 5, 20]]),
      receipt("r2", [["a", 3, 100]], "vodafone"),
    ];
    const items = soldItems(receipts);
    expect(items[0]).toMatchObject({ productId: "a", qty: 5, revenuePiastres: 500_00, receiptsCount: 2 });
    expect(items[1]).toMatchObject({ productId: "b", qty: 5, revenuePiastres: 100_00, receiptsCount: 1 });
    expect(items[0]!.revenuePiastres).toBeGreaterThan(items[1]!.revenuePiastres); // tie broken by revenue
  });

  it("empty receipts → no items", () => {
    expect(soldItems([])).toEqual([]);
  });
});

// ---------- cart (POS scan rules) ----------

describe("cart rules", () => {
  it("scan adds qty 1, re-scan increments", () => {
    const prod = p("a", 100, "111");
    let { cart } = addToCart([], prod, 10);
    expect(cart).toHaveLength(1);
    expect(cart[0]!.qty).toBe(1);
    ({ cart } = addToCart(cart, prod, 10));
    expect(cart).toHaveLength(1);
    expect(cart[0]!.qty).toBe(2);
    expect(cartCount(cart)).toBe(2);
  });

  it("scan blocked when stock is exhausted", () => {
    const prod = p("a", 100, "111");
    const res = addToCart([], prod, 0);
    expect(res.error).toBe("out_of_stock");
    expect(res.cart).toHaveLength(0);
  });

  it("cannot scan beyond available stock", () => {
    const prod = p("a", 100, "111");
    let { cart } = addToCart([], prod, 1);
    const second = addToCart(cart, prod, 1);
    expect(second.error).toBe("out_of_stock");
    expect(second.cart[0]!.qty).toBe(1);
  });

  it("setLineQty clamps to stock; qty 0 removes", () => {
    const prod = p("a", 100, "111");
    const { cart } = addToCart([], prod, 3);
    expect(setLineQty(cart, "a", 99, 3)[0]!.qty).toBe(3);
    expect(setLineQty(cart, "a", 0, 3)).toHaveLength(0);
    expect(removeLine(cart, "a")).toHaveLength(0);
  });

  it("cartStockConflict finds the first over-stock line", () => {
    const cart = [
      { productId: "a", barcode: "1", name: "x", pricePiastres: 100, qty: 2 },
      { productId: "b", barcode: "2", name: "y", pricePiastres: 100, qty: 5 },
    ];
    const conflict = cartStockConflict(cart, (id) => (id === "b" ? 4 : 10));
    expect(conflict).toMatchObject({ productId: "b", requested: 5, available: 4 });
    expect(cartStockConflict(cart, () => 10)).toBeNull();
  });
});
