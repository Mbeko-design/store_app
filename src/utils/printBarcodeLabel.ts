import type { Product } from "../shop/types";

export function reserveBarcodePrintWindow(): Window | null {
  return window.open("", "_blank", "popup,width=420,height=320");
}

export async function printBarcodeLabel(printWindow: Window, product: Pick<Product, "barcode" | "name">): Promise<void> {
  const { default: JsBarcode } = await import("jsbarcode");
  const document = printWindow.document;
  document.open();
  document.write("<!doctype html><html lang=\"ar\" dir=\"rtl\"><head><meta charset=\"utf-8\"><title></title></head><body></body></html>");
  document.close();
  document.title = `باركود ${product.name}`;

  const style = document.createElement("style");
  style.textContent = `
    @page { size: 50mm 30mm; margin: 0; }
    * { box-sizing: border-box; }
    html, body { width: 50mm; height: 30mm; margin: 0; }
    body { font-family: Arial, sans-serif; }
    .label {
      width: 50mm; height: 30mm; padding: 1mm;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      overflow: hidden; text-align: center;
    }
    .name {
      max-width: 100%; margin: 0 0 1mm; overflow: hidden;
      font-size: 8pt; font-weight: 700; text-overflow: ellipsis; white-space: nowrap;
    }
    svg { display: block; max-width: 100%; max-height: 20mm; }
    @media screen {
      body { display: grid; place-items: center; background: #eee; }
      .label { background: white; }
    }
  `;
  document.head.append(style);

  const label = document.createElement("main");
  label.className = "label";
  const name = document.createElement("p");
  name.className = "name";
  name.textContent = product.name;
  const barcode = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  barcode.setAttribute("aria-label", `باركود ${product.name}`);
  JsBarcode(barcode, product.barcode, {
    format: "CODE128",
    width: 0.8,
    height: 42,
    displayValue: true,
    fontSize: 10,
    margin: 0,
    textMargin: 1,
  });
  label.append(name, barcode);
  document.body.append(label);

  printWindow.opener = null;
  printWindow.focus();
  printWindow.setTimeout(() => printWindow.print(), 250);
}
