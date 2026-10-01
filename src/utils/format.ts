import { piastresToEgp } from "./money";

const LATIN_DIGITS = "en-US";

/** "12,500 جنيه" — spec currency format (Latin digits, Arabic unit). */
export function formatEgp(piastres: number): string {
  const value = piastresToEgp(piastres);
  const grouped = new Intl.NumberFormat(LATIN_DIGITS, {
    maximumFractionDigits: 2,
  }).format(value);
  return `${grouped} جنيه`;
}

/** Presentation-only sign by operation type (سحب −, إيداع/فلوس +). No accounting logic. */
export function formatSignedEgp(type: "withdraw" | "deposit" | "cash", piastres: number): string {
  const sign = type === "withdraw" ? "−" : "+";
  return `${sign}${formatEgp(piastres)}`;
}

const DATE_LOCALE = "ar-EG-u-nu-latn";

/** UTC ISO → local date, e.g. "2 أكتوبر 2026" (Latin digits). */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(DATE_LOCALE, { dateStyle: "medium" }).format(new Date(iso));
}

/** UTC ISO → local date + time. */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat(DATE_LOCALE, { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

/** UTC ISO → local time only (for dense lists). */
export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat(DATE_LOCALE, { timeStyle: "short" }).format(new Date(iso));
}

/** Avatar initials from a name (first letters of first two words). */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "؟";
  return parts.slice(0, 2).map((p) => p[0] ?? "").join("");
}
