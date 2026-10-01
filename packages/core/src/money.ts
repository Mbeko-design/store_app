/**
 * Money primitives.
 *
 * All amounts in the system are INTEGER piastres (1 EGP = 100 piastres).
 * Integers only — floating point drift is how deficits appear.
 */
export type Piastres = number;

export const PIASTRES_PER_EGP = 100;

/** Convert a human EGP amount (e.g. 50.5) to integer piastres (5050). */
export function toPiastres(amountEgp: number): Piastres {
  if (!Number.isFinite(amountEgp)) throw new Error("invalid_amount");
  return Math.round(amountEgp * PIASTRES_PER_EGP);
}

/** Convert integer piastres back to EGP for display. */
export function fromPiastres(amountPiastres: Piastres): number {
  return amountPiastres / PIASTRES_PER_EGP;
}

/** Guard: values stored in postings must be integer piastres. */
export function assertIntegerPiastres(value: number, label = "amount"): Piastres {
  if (!Number.isInteger(value)) throw new Error(`non_integer_${label}`);
  if (!Number.isFinite(value)) throw new Error(`invalid_${label}`);
  return value;
}

/** Format piastres as EGP currency for a locale ("ar" → ٥١٠٫٠٠ ج.م). */
export function formatEgp(amountPiastres: Piastres, lang: "ar" | "en"): string {
  const locale = lang === "ar" ? "ar-EG" : "en-EG";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EGP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(fromPiastres(amountPiastres));
}

/** Parse user-typed text ("1,250.50" or Arabic-Indic digits) to piastres. Returns null if unparseable. */
export function parseEgpInput(text: string): Piastres | null {
  const normalized = text
    .trim()
    // Arabic-Indic digits → Latin
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    // Arabic thousands marks (٬ ,) and spaces → strip; Arabic separators (٫ ،) → decimal point
    .replace(/[٬,\u200f\u200e\s]/g, "")
    .replace(/[٫،]/g, ".");
  if (normalized === "") return null;
  if (!/^-?\d*(\.\d*)?$/.test(normalized)) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return toPiastres(n);
}

/** Format piastres as plain decimal EGP text for inputs (5050 → "50.50"). */
export function piastresToInput(amountPiastres: Piastres): string {
  return fromPiastres(amountPiastres).toFixed(2);
}
