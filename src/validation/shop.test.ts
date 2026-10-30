import { describe, expect, it } from "vitest";
import { isValidBarcode, normalizeBarcode, parseCountQty, parseStockInQty, validateProductForm } from "./shop";

describe("barcode rules", () => {
  it("normalizes scanner input (trim, strip spaces, uppercase)", () => {
    expect(normalizeBarcode("  622 1100000011 ")).toBe("6221100000011");
    expect(normalizeBarcode("abc-def")).toBe("ABC-DEF");
  });

  it("accepts EAN-13, Code-128 and internal codes (3–40 chars)", () => {
    expect(isValidBarcode("6221100000011")).toBe(true);
    expect(isValidBarcode("ABC-123_x")).toBe(true);
    expect(isValidBarcode("123")).toBe(true);
  });

  it("rejects empty / too short / bad characters", () => {
    expect(isValidBarcode("")).toBe(false);
    expect(isValidBarcode("12")).toBe(false);
    expect(isValidBarcode("a b c")).toBe(true); // internal spaces stripped → "ABC" (scanner-friendly)
    expect(isValidBarcode("!!invalid!!")).toBe(false);
  });
});

describe("validateProductForm", () => {
  const existing = [{ id: "p1", barcode: "6221100000011" }];

  it("accepts a valid new product and returns normalized values", () => {
    const { errors, values } = validateProductForm(
      { barcode: " 6221100000099 ", name: "  كفر شفاف  ", priceEgp: "120" },
      existing,
    );
    expect(errors).toEqual({});
    expect(values).toEqual({ barcode: "6221100000099", name: "كفر شفاف", pricePiastres: 12_000 });
  });

  it("blocks duplicate barcode (except when editing the same product)", () => {
    expect(
      validateProductForm({ barcode: "6221100000011", name: "x", priceEgp: "10" }, existing).errors.barcode,
    ).toMatch(/مسجل/);
    expect(
      validateProductForm({ barcode: "6221100000011", name: "x", priceEgp: "10" }, existing, "p1").errors.barcode,
    ).toBeUndefined();
  });

  it("reports field errors for missing barcode/name and bad price", () => {
    const { errors } = validateProductForm({ barcode: "", name: "", priceEgp: "0" }, []);
    expect(errors.barcode).toBeTruthy();
    expect(errors.name).toBeTruthy();
    expect(errors.price).toBeTruthy();
  });

  it("rejects overlong names", () => {
    expect(validateProductForm({ barcode: "111", name: "أ".repeat(61), priceEgp: "5" }, []).errors.name).toBeTruthy();
  });
});

describe("quantity parsing", () => {
  it("stock-in requires a positive integer", () => {
    expect(parseStockInQty("5")).toEqual({ ok: true, qty: 5 });
    expect(parseStockInQty("0").ok).toBe(false);
    expect(parseStockInQty("2.5").ok).toBe(false);
    expect(parseStockInQty("").ok).toBe(false);
  });

  it("physical count allows 0 (item is out of stock)", () => {
    expect(parseCountQty("0")).toEqual({ ok: true, qty: 0 });
    expect(parseCountQty("-1").ok).toBe(false);
  });
});
