import type { Product } from "../shop/types";

export function labelsPerPage(copies: number): number[] {
  if (!Number.isSafeInteger(copies) || copies < 1) throw new Error("invalid_label_quantity");
  return Array.from({ length: Math.ceil(copies / 2) }, (_, index) => Math.min(2, copies - index * 2));
}

export function reserveBarcodePrintWindow(): Window | null {
  return window.open("", "_blank", "popup,width=420,height=320");
}

export async function printBarcodeLabel(
  printWindow: Window,
  product: Pick<Product, "barcode" | "name">,
  copies = 1,
): Promise<void> {
  const pageCopies = labelsPerPage(copies);

  const { default: JsBarcode } = await import("jsbarcode");
  const document = printWindow.document;
  document.open();
  document.write("<!doctype html><html lang=\"ar\" dir=\"rtl\"><head><meta charset=\"utf-8\"><title></title></head><body></body></html>");
  document.close();
  document.title = `باركود ${product.name}`;

  const style = document.createElement("style");
  style.textContent = `
    @page { size: 38mm 25mm; margin: 0; }
    * { box-sizing: border-box; }
    html, body { width: 38mm; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; }
    .sheet {
      width: 38mm; height: 25mm; overflow: hidden;
      display: flex; flex-direction: column;
      break-after: page; page-break-after: always;
    }
    .sheet:last-child { break-after: auto; page-break-after: auto; }
    .label {
      width: 38mm; height: 12.5mm; padding: 0.4mm 0.8mm; overflow: hidden;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      flex: 0 0 12.5mm; text-align: center;
      border-bottom: 0.15mm dashed #aaa;
    }
    .label:last-child { border-bottom: 0; }
    .name {
      max-width: 100%; margin: 0; overflow: hidden;
      font-size: 6pt; line-height: 1; font-weight: 700; text-overflow: ellipsis; white-space: nowrap;
    }
    svg {
      display: block; width: auto; height: auto; max-width: 36mm; max-height: 9mm;
      shape-rendering: crispEdges;
    }
    @media screen {
      body { display: flex; flex-direction: column; align-items: center; gap: 8px; background: #eee; }
      .sheet { background: white; }
      .label { border-bottom-color: #ddd; }
    }
  `;
  document.head.append(style);

  const labels = document.createDocumentFragment();
  for (const labelsOnPage of pageCopies) {
    const sheet = document.createElement("main");
    sheet.className = "sheet";
    for (let labelIndex = 0; labelIndex < labelsOnPage; labelIndex += 1) {
      const label = document.createElement("section");
      label.className = "label";
      const name = document.createElement("p");
      name.className = "name";
      name.textContent = product.name;
      const barcode = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      barcode.setAttribute("aria-label", `باركود ${product.name}`);
      JsBarcode(barcode, product.barcode, {
        format: /^\d{12}$/.test(product.barcode) ? "CODE128C" : "CODE128",
        width: 1.2,
        height: 24,
        displayValue: true,
        fontSize: 7,
        margin: 0,
        textMargin: 0,
      });
      label.append(name, barcode);
      sheet.append(label);
    }
    labels.append(sheet);
  }
  document.body.append(labels);

  printWindow.opener = null;
  printWindow.focus();
  printWindow.setTimeout(() => printWindow.print(), 250);
}
