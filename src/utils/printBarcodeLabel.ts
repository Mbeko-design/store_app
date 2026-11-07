import type { Product } from "../shop/types";

export function reserveBarcodePrintWindow(): Window | null {
  return window.open("", "_blank", "popup,width=420,height=320");
}

export async function printBarcodeLabel(
  printWindow: Window,
  product: Pick<Product, "barcode" | "name">,
  copies = 1,
): Promise<void> {
  if (!Number.isSafeInteger(copies) || copies < 1) throw new Error("invalid_label_quantity");

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
    .label {
      width: 38mm; height: 25mm; padding: 1mm; overflow: hidden;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      text-align: center; break-after: page; page-break-after: always;
    }
    .label:last-child { break-after: auto; page-break-after: auto; }
    .name {
      max-width: 100%; margin: 0 0 1mm; overflow: hidden;
      font-size: 7pt; font-weight: 700; text-overflow: ellipsis; white-space: nowrap;
    }
    svg {
      display: block; width: auto; height: auto; max-width: 36mm; max-height: 16mm;
      shape-rendering: crispEdges;
    }
    @media screen {
      body { display: flex; flex-direction: column; align-items: center; gap: 8px; background: #eee; }
      .label { background: white; }
    }
  `;
  document.head.append(style);

  const labels = document.createDocumentFragment();
  for (let i = 0; i < copies; i += 1) {
    const label = document.createElement("main");
    label.className = "label";
    const name = document.createElement("p");
    name.className = "name";
    name.textContent = product.name;
    const barcode = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    barcode.setAttribute("aria-label", `باركود ${product.name}`);
    JsBarcode(barcode, product.barcode, {
      format: /^\d{12}$/.test(product.barcode) ? "CODE128C" : "CODE128",
      width: 1.2,
      height: 38,
      displayValue: true,
      fontSize: 9,
      margin: 0,
      textMargin: 1,
    });
    label.append(name, barcode);
    labels.append(label);
  }
  document.body.append(labels);

  printWindow.opener = null;
  printWindow.focus();
  printWindow.setTimeout(() => printWindow.print(), 250);
}
