import { describe, expect, it } from "vitest";
import { labelsPerPage } from "./printBarcodeLabel";

describe("barcode label page layout", () => {
  it("places two labels on each physical 38 × 25 mm page", () => {
    expect(labelsPerPage(6)).toEqual([2, 2, 2]);
    expect(labelsPerPage(4)).toEqual([2, 2]);
  });

  it("uses only one half of the final page for an odd copy count", () => {
    expect(labelsPerPage(5)).toEqual([2, 2, 1]);
    expect(labelsPerPage(1)).toEqual([1]);
  });

  it("rejects zero, negative, and fractional copy counts", () => {
    expect(() => labelsPerPage(0)).toThrow("invalid_label_quantity");
    expect(() => labelsPerPage(-1)).toThrow("invalid_label_quantity");
    expect(() => labelsPerPage(1.5)).toThrow("invalid_label_quantity");
  });
});
