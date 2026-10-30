import { parseAmountInput } from "./money";

/**
 * Shop form validation — barcode / product / stock / receipt rules.
 * Barcode: whatever the USB scanner reads, normalized to a trimmed, space-free,
 * uppercased token (EAN-13, Code-128, internal codes — all accepted).
 */

const BARCODE_RE = /^[A-Z0-9][A-Z0-9\-_/.]{2,39}$/;

export function normalizeBarcode(raw: string): string {
  return raw.trim().replace(/\s+/g, "").toUpperCase();
}

export function isValidBarcode(raw: string): boolean {
  return BARCODE_RE.test(normalizeBarcode(raw));
}

export interface ProductFormInput {
  barcode: string;
  name: string;
  priceEgp: string;
}

export interface ProductFormValues {
  barcode: string;
  name: string;
  pricePiastres: number;
}

/**
 * Validate the register-product form.
 * `existing` = all products (for the duplicate-barcode rule); `currentId` = product being edited.
 */
export function validateProductForm(
  input: ProductFormInput,
  existing: Array<{ id: string; barcode: string }>,
  currentId?: string,
): { errors: { barcode?: string; name?: string; price?: string }; values?: ProductFormValues } {
  const errors: { barcode?: string; name?: string; price?: string } = {};

  const barcode = normalizeBarcode(input.barcode);
  if (!barcode) errors.barcode = "الباركود مطلوب — امسحه بالماسح";
  else if (!isValidBarcode(barcode)) errors.barcode = "باركود غير صالح (3–40 رمزًا)";
  else if (existing.some((p) => p.barcode === barcode && p.id !== currentId)) {
    errors.barcode = "هذا الباركود مسجل لمنتج آخر";
  }

  const name = input.name.trim();
  if (!name) errors.name = "اسم المنتج مطلوب";
  else if (name.length > 60) errors.name = "الاسم طويل جدًا (60 حرفًا كحد أقصى)";

  const price = parseAmountInput(input.priceEgp);
  if (!price.ok) errors.price = price.error;

  if (Object.keys(errors).length > 0) return { errors };
  return { errors, values: { barcode, name, pricePiastres: price.ok ? price.piastres : 0 } };
}

/** Positive integer quantity (stock-in / initial stock). */
export function parseQty(raw: string): { ok: true; qty: number } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "الكمية مطلوبة" };
  if (!/^\d+$/.test(trimmed)) return { ok: false, error: "أدخل عددًا صحيحًا (0 أو أكثر)" };
  const qty = Number(trimmed);
  if (!Number.isSafeInteger(qty)) return { ok: false, error: "أدخل عددًا صحيحًا" };
  return { ok: true, qty };
}

/** Stock-in: must add at least 1 piece. */
export function parseStockInQty(raw: string): { ok: true; qty: number } | { ok: false; error: string } {
  const res = parseQty(raw);
  if (!res.ok) return res;
  if (res.qty < 1) return { ok: false, error: "الكمية يجب أن تكون 1 على الأقل" };
  return res;
}

/** Physical-count correction: target on-hand ≥ 0 (the delta is computed by the service). */
export function parseCountQty(raw: string): { ok: true; qty: number } | { ok: false; error: string } {
  return parseQty(raw);
}
