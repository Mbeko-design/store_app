import { egpToPiastres } from "../utils/money";

/**
 * Parse a user-typed amount (EGP) into integer piastres.
 * Accepts Arabic-Indic digits, Arabic/English separators: "12,500" / "12٫500" / "12500.50".
 * Values are rounded to the nearest piastre (max 2 decimals of intent — longer input still rounds).
 */
export type ParseAmountResult = { ok: true; piastres: number } | { ok: false; error: string };

const ARABIC_INDIC = /[٠-٩]/g;
const EXT_ARABIC_INDIC = /[۰-۹]/g;

export function parseAmountInput(raw: string): ParseAmountResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "المبلغ مطلوب" };

  let s = trimmed
    .replace(ARABIC_INDIC, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(EXT_ARABIC_INDIC, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٬,\s]/g, "") // thousands separators (Arabic, English, spaces)
    .replace(/[٫]/g, "."); // Arabic decimal separator

  if (s.startsWith("-")) return { ok: false, error: "المبلغ يجب أن يكون أكبر من صفر" };
  if (!/^\d+(\.\d+)?$/.test(s)) return { ok: false, error: "أدخل مبلغًا صحيحًا" };

  const value = Number(s);
  if (!Number.isFinite(value)) return { ok: false, error: "أدخل مبلغًا صحيحًا" };
  if (value <= 0) return { ok: false, error: "المبلغ يجب أن يكون أكبر من صفر" };

  const piastres = egpToPiastres(value);
  if (piastres <= 0) return { ok: false, error: "المبلغ يجب أن يكون أكبر من صفر" };
  if (piastres > 100_000_000_00) return { ok: false, error: "المبلغ كبير جدًا (الحد الأقصى 100 مليون جنيه)" };

  return { ok: true, piastres };
}
