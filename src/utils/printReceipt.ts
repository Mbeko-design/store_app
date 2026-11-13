import { PAYMENT_LABEL, type Receipt } from "../shop/types";
import { formatDateTime, formatEgp } from "./format";

export function reserveReceiptPrintWindow(): Window | null {
  return window.open("", "_blank", "popup,width=420,height=700");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function receiptPrintHtml(receipt: Receipt): string {
  const subtotalPiastres = receipt.subtotalPiastres ?? receipt.totalPiastres;
  const discountRow = receipt.discountPiastres
    ? `<div class="summary-row"><span>قبل الخصم</span><strong>${escapeHtml(formatEgp(subtotalPiastres))}</strong></div>
       <div class="summary-row"><span>خصم ${escapeHtml(receipt.discountCode ?? "")} (${receipt.discountPercent ?? 0}%)</span>
       <strong>−${escapeHtml(formatEgp(receipt.discountPiastres))}</strong></div>`
    : "";
  const rows = receipt.lines
    .map(
      (line) => `
        <li class="line">
          <p class="name">${escapeHtml(line.name)}</p>
          <div class="line-details">
            <span>${line.qty} × ${escapeHtml(formatEgp(line.pricePiastres))}</span>
            <strong>${escapeHtml(formatEgp(line.pricePiastres * line.qty))}</strong>
          </div>
        </li>`,
    )
    .join("");

  return `<!doctype html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>فاتورة ${receipt.number}</title>
        <style>
          @page { margin: 3mm; }
          * { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; }
          body { width: 74mm; margin: 0 auto; color: #000; background: #fff; font: 10pt/1.45 Arial, sans-serif; }
          .receipt { width: 100%; padding: 1mm; }
          header, .meta, .thanks { text-align: center; }
          header { padding-bottom: 3mm; border-bottom: 1px dashed #555; }
          h1 { margin: 0; font-size: 15pt; }
          .subtitle { margin: 1mm 0 0; font-size: 9pt; }
          .meta { display: grid; gap: 1mm; padding: 3mm 0; font-size: 9pt; }
          .lines { margin: 0; padding: 0; list-style: none; }
          .line { padding: 2mm 0; border-top: 1px dashed #999; break-inside: avoid; }
          .name { margin: 0 0 1mm; font-weight: 700; overflow-wrap: anywhere; }
          .line-details, .total { display: flex; justify-content: space-between; gap: 2mm; }
          .line-details { font-size: 9pt; }
          .summary-row { display: flex; justify-content: space-between; gap: 2mm; margin-top: 1.5mm; font-size: 9pt; }
          .total { margin-top: 2mm; padding-top: 2mm; border-top: 1px solid #000; font-size: 12pt; font-weight: 700; }
          .thanks { margin: 4mm 0 0; padding-top: 2mm; border-top: 1px dashed #555; font-size: 9pt; }
          @media screen {
            body { margin: 12px auto; padding: 8px; background: #eee; }
            .receipt { background: white; }
          }
        </style>
      </head>
      <body>
        <main class="receipt">
          <header><h1>بساطه تك</h1><p class="subtitle">إيصال بيع</p></header>
          <div class="meta">
            <strong>فاتورة رقم ${receipt.number}</strong>
            <span>${escapeHtml(formatDateTime(receipt.createdAtIso))}</span>
            <span>طريقة الدفع: ${escapeHtml(PAYMENT_LABEL[receipt.paymentMethod])}</span>
          </div>
          <ul class="lines">${rows}</ul>
          ${discountRow}
          <div class="total"><span>الإجمالي</span><span>${escapeHtml(formatEgp(receipt.totalPiastres))}</span></div>
          <p class="thanks">شكرًا لزيارتكم</p>
        </main>
      </body>
    </html>`;
}

export function printReceipt(printWindow: Window, receipt: Receipt): void {
  const document = printWindow.document;
  document.open();
  document.write(receiptPrintHtml(receipt));
  document.close();
  printWindow.opener = null;
  printWindow.focus();
  printWindow.setTimeout(() => printWindow.print(), 250);
}
