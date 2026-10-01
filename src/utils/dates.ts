/** Date helpers. Storage is always UTC ISO; display is always the user's local timezone. */

export function toUtcIso(date: Date): string {
  return date.toISOString();
}

/** "YYYY-MM-DDTHH:mm" (datetime-local, local time) → UTC ISO. */
export function localInputToUtcIso(localValue: string): string | null {
  const d = new Date(localValue);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** Current local time as a datetime-local default value. */
export function nowLocalInputValue(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/** Local-timezone calendar month window containing `now`: [start, end). */
export function localMonthRange(now: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  return { start, end };
}

/** Is a UTC ISO instant inside [start, end)? Compared as real timestamps (timezone-safe). */
export function isWithin(iso: string, start: Date, end: Date): boolean {
  const t = Date.parse(iso);
  return t >= start.getTime() && t < end.getTime();
}

/** "YYYY-MM-DD" (date input, local) → UTC ISO of local start-of-day. */
export function localDayStartIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** "YYYY-MM-DD" → UTC ISO of the START of the NEXT local day (exclusive end for inclusive date filters). */
export function localDayEndExclusiveIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}
