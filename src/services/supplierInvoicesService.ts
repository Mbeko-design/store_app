import type { SupplierInvoice, SupplierInvoiceLine, StockMove } from "../shop/types";
import { db } from "./db";
import { newId } from "../utils/labels";

export interface SaveSupplierInvoiceInput {
  supplierName: string;
  reference?: string;
  lines: Array<{ productId: string; qty: number; unitCostPiastres: number }>;
  paidPiastres: number;
}

export async function saveSupplierInvoice(input: SaveSupplierInvoiceInput): Promise<SupplierInvoice> {
  const supplierName = input.supplierName.trim();
  if (!supplierName || supplierName.length > 80) throw new Error("invalid_supplier");
  if (!input.lines.length) throw new Error("empty_invoice");
  if (!Number.isSafeInteger(input.paidPiastres) || input.paidPiastres < 0) throw new Error("invalid_paid");

  return db.transaction("rw", db.products, db.stockMoves, db.supplierInvoices, db.settings, async () => {
    const invoiceLines: SupplierInvoiceLine[] = [];
    let totalPiastres = 0;

    for (const line of input.lines) {
      if (!Number.isSafeInteger(line.qty) || line.qty < 1) throw new Error("invalid_qty");
      if (!Number.isSafeInteger(line.unitCostPiastres) || line.unitCostPiastres < 0) throw new Error("invalid_cost");
      const product = await db.products.get(line.productId);
      if (!product) throw new Error("product_missing");
      if (product.archivedAtIso) throw new Error("product_archived");
      const lineTotalPiastres = line.unitCostPiastres * line.qty;
      if (!Number.isSafeInteger(lineTotalPiastres)) throw new Error("invalid_total");
      totalPiastres += lineTotalPiastres;
      invoiceLines.push({
        productId: product.id,
        name: product.name,
        barcode: product.barcode,
        qty: line.qty,
        unitCostPiastres: line.unitCostPiastres,
        lineTotalPiastres,
      });
      await db.products.put({ ...product, costPiastres: line.unitCostPiastres });
    }

    if (!Number.isSafeInteger(totalPiastres) || totalPiastres < 1) throw new Error("invalid_total");
    if (input.paidPiastres > totalPiastres) throw new Error("paid_exceeds_total");

    const seqRow = await db.settings.get("supplierInvoiceSeq");
    const number = (seqRow ? Number(seqRow.value) || 0 : 0) + 1;
    const nowIso = new Date().toISOString();
    const invoice: SupplierInvoice = {
      id: newId(),
      number,
      supplierName,
      ...(input.reference?.trim() ? { reference: input.reference.trim() } : {}),
      lines: invoiceLines,
      totalPiastres,
      paidPiastres: input.paidPiastres,
      remainingPiastres: totalPiastres - input.paidPiastres,
      createdAtIso: nowIso,
    };

    await db.supplierInvoices.put(invoice);
    const moves: StockMove[] = invoiceLines.map((line) => ({
      id: newId(),
      productId: line.productId,
      type: "in",
      qty: line.qty,
      refSupplierInvoiceId: invoice.id,
      supplierName,
      note: `فاتورة مورد رقم ${number}`,
      createdAtIso: nowIso,
    }));
    await db.stockMoves.bulkPut(moves);
    await db.settings.put({ key: "supplierInvoiceSeq", value: String(number) });
    return invoice;
  });
}

export async function listSupplierInvoices(): Promise<SupplierInvoice[]> {
  const invoices = await db.supplierInvoices.toArray();
  return invoices.sort((a, b) =>
    b.createdAtIso.localeCompare(a.createdAtIso) || b.number - a.number,
  );
}
