import { describe, expect, it } from "vitest";
import { receiptPrintHtml } from "./printReceipt";
import type { Receipt } from "../shop/types";

const example: Receipt = {
  id: "receipt-1",
  number: 12,
  lines: [
    { productId: "product-1", barcode: "123", name: "<محول & كابل>", pricePiastres: 12500, qty: 2 },
  ],
  totalPiastres: 25000,
  paymentMethod: "cash",
  createdAtIso: "2026-11-10T10:00:00.000Z",
};

describe("80 mm receipt print layout", () => {
  it("includes the invoice details and thermal paper width", () => {
    const html = receiptPrintHtml(example);
    expect(html).toContain("@page { margin: 3mm; }");
    expect(html).toContain("width: 74mm");
    expect(html).toContain("فاتورة رقم 12");
    expect(html).toContain("2 × 125 جنيه");
    expect(html).toContain("250 جنيه");
    expect(html).toContain("نقدًا");
  });

  it("escapes product names before inserting them into the printable document", () => {
    const html = receiptPrintHtml(example);
    expect(html).toContain("&lt;محول &amp; كابل&gt;");
    expect(html).not.toContain("<محول & كابل>");
  });

  it("prints the discount code and amount on discounted receipts", () => {
    const html = receiptPrintHtml({
      ...example,
      subtotalPiastres: 25000,
      discountCode: "SAVE10",
      discountPercent: 10,
      discountPiastres: 2500,
      totalPiastres: 22500,
    });
    expect(html).toContain("خصم SAVE10 (10%)");
    expect(html).toContain("25 جنيه");
    expect(html).toContain("−25 جنيه");
    expect(html).toContain("225 جنيه");
  });
});
