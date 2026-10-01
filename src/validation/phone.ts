/** Egyptian mobile: 010 / 011 / 012 / 015 + 8 digits = 11 total. */
export const EGYPTIAN_MOBILE_RE = /^01[0125]\d{8}$/;

/** Strip separators and convert +20 / 0020 / 20 prefixes to the local 0-form. */
export function normalizePhone(raw: string): string {
  let p = raw.replace(/[\s\-().+]/g, "");
  if (p.startsWith("0020")) p = p.slice(4);
  else if (p.startsWith("20")) p = p.slice(2);
  if (!p.startsWith("0")) p = "0" + p;
  return p;
}

/** Returns an Arabic error message, or null when valid. */
export function validatePhone(raw: string): string | null {
  const p = normalizePhone(raw.trim());
  if (!p) return "رقم الموبايل مطلوب";
  if (!EGYPTIAN_MOBILE_RE.test(p)) return "أدخل رقم موبايل مصري صحيح مثل 01XXXXXXXXX";
  return null;
}
